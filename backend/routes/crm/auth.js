// ============================================================
// CRM authentication — v2 contract.
//
// Fixes:
//   #1  suspended organizations CAN log in (limited + read-only)
//   #2  banned organizations CANNOT log in / are logged out immediately
//   #26 lastLoginAt is stored and returned correctly (real Date → ISO)
//   #29/#30 banned detection happens during session validation
//   #14 normalised roles in the session payload
// ============================================================

import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import sgMail from '@sendgrid/mail';
import User from '../../models/User.js';
import Organization from '../../models/Organization.js';
import Subscription from '../../models/Subscription.js';
import { requireAuth, issueToken, bumpSessionVersion } from '../../middleware/auth.js';
import { normalizeRole, permissionsFor, ROLE_LABELS } from '../../config/permissions.js';
import { planSummary } from '../../services/planService.js';
import { writeAudit } from '../../utils/auditLogger.js';
import { asyncRoute } from '../../utils/httpError.js';

const router = express.Router();

// Cryptographically secure 6-digit OTP generator
const generateOTP = () => crypto.randomInt(100000, 1000000).toString();

async function sendOtpEmail(to, otp, purpose = 'Password Reset') {
  if (!process.env.SENDGRID_API_KEY) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV OTP] ${purpose} code for ${to}: ${otp}`);
    }
    return;
  }
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM_ADDRESS || 'noreply@happypix.in',
      subject: `HappyPix — ${purpose} Code`,
      text: `Your HappyPix ${purpose.toLowerCase()} code is: ${otp}. It will expire in 10 minutes. Do not share this code with anyone.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #111;">
          <h2>HappyPix ${purpose}</h2>
          <p>Your one-time verification code is:</p>
          <div style="font-size: 28px; font-weight: bold; letter-spacing: 4px; padding: 12px 24px; background: #f4f4f5; display: inline-block; border-radius: 6px;">${otp}</div>
          <p style="margin-top: 16px; color: #666; font-size: 14px;">This code will expire in 10 minutes. If you did not request this, please contact support.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error(`[Auth] Failed to send ${purpose} email:`, err.message);
  }
}

// Rate limiters for brute-force defense
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Please try again in 15 minutes.' },
});

const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset code requests. Please wait 15 minutes before requesting again.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification attempts. Please wait 15 minutes.' },
});

const SESSION_MIN = Math.max(5, Number(process.env.SESSION_TTL_MIN) || 480);

function passwordPolicyError(password) {
  const value = String(password || '');
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return 'Password must contain at least one letter and one number.';
  return null;
}

function normalizeIp(req) {
  const raw = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
  if (!raw) return null;
  const first = String(raw).split(',')[0].trim();
  return first === '::1' ? '127.0.0.1' : first;
}

/** Public user shape — issue #26: lastLoginAt returned from storage. */
function userView(user) {
  const role = normalizeRole(user.role) || user.role;
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role,
    roleLabel: ROLE_LABELS[role] || role,
    organizationId: user.organizationId ? String(user.organizationId) : null,
    status: user.status,
    phoneNumber: user.phoneNumber || null,
    profilePhotoUrl: user.profilePhotoUrl || user.photoUrl || null,
    createdAt: user.createdAt ? new Date(user.createdAt).toISOString() : null,
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
  };
}

function setSessionCookie(res, token) {
  res.cookie('hp_admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: SESSION_MIN * 60 * 1000,
  });
}

/** Shared session payload so /login and /me can never disagree. */
async function sessionPayload(req, user) {
  const role = normalizeRole(user.role) || user.role;
  const payload = {
    user: userView(user),
    permissions: permissionsFor(role),
    expiresInMin: SESSION_MIN,
  };

  if (!user.organizationId) {
    payload.organization = null;
    payload.user = { ...payload.user, orgName: null, planStatus: null };
    payload.orgStatus = 'active';
    payload.readOnly = false;
    return payload;
  }

  const org = req.organization || await Organization.findById(user.organizationId);
  if (!org) {
    const error = new Error('Your organization is no longer available.');
    error.status = 403;
    error.code = 'ORG_MISSING';
    throw error;
  }

  // Issue #2/#29: banned organizations are detected during session validation.
  if (org.status === 'banned') {
    const error = new Error('This organization has been banned. Contact HappyPix support.');
    error.status = 403;
    error.code = 'ORG_BANNED';
    error.banned = true;
    error.suspendReason = org.suspendReason || null;
    throw error;
  }

  const subscription = await Subscription.findOne({ organizationId: org._id }).sort({ createdAt: -1 });
  const plan = await planSummary(org, subscription);

  payload.organization = {
    id: String(org._id),
    name: org.name,
    ownerName: org.ownerName || user.name,
    email: org.email,
    country: org.country || 'IN',
    logoUrl: org.logoUrl || null,
    plan: plan.plan,
    planName: plan.planName,
    planStatus: plan.status,
    addons: plan.activeAddons || org.addons || [],
    aiCredits: Number(org.aiCredits) || 0,
    deviceLimit: plan.deviceLimit,
    eventLimit: plan.eventLimit,
  };
  // The CRM navbar/Profile read orgName/planStatus off the user object;
  // keep them on the session user so /login and /me always carry them
  // (previously only a separate `organization` field had the name, and
  // session revalidation wiped the frontend's backfilled copy).
  payload.user = {
    ...payload.user,
    orgName: payload.organization.name,
    plan: plan.plan,
    planStatus: payload.organization.planStatus,
    aiCredits: Number(org.aiCredits) || 0,
  };
  payload.orgStatus = org.status || 'active';
  // Issue #1: suspended organizations are read-only, not locked out.
  payload.readOnly = org.status === 'suspended';
  if (payload.readOnly) {
    payload.notice = {
      kind: 'suspended',
      title: 'Your organization is suspended',
      message: org.suspendReason
        ? `Reason: ${org.suspendReason}. Account details remain visible, but creating or editing events, devices, coupons, defaults, support requests and team members is disabled until HappyPix restores the organization.`
        : 'Account details remain visible, but creating or editing events, devices, coupons, defaults, support requests and team members is disabled until HappyPix restores the organization.',
    };
  }
  return payload;
}

// ─── LOGIN & SESSION ────────────────────────────────────────────
 
router.post('/login', authLimiter, asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const password = String(req.body.password || '');
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.', code: 'MISSING_CREDENTIALS' });
  }

  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    await writeAudit({
      actorId: user ? user._id : null,
      actorName: user ? user.name : email || 'unknown',
      actorRole: user ? user.role : 'GUEST',
      organizationId: user ? user.organizationId : null,
      action: 'platform.auth.login_failed',
      entity: 'user',
      summary: `Failed sign-in attempt for ${email || '(empty email)'}`,
      severity: 'warn',
      ip: normalizeIp(req),
    });
    return res.status(401).json({ error: 'Invalid email or password.', code: 'INVALID_CREDENTIALS' });
  }

  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Account is deactivated. Contact your administrator.', code: 'ACCOUNT_DEACTIVATED' });
  }

  // Issue #2: banned organizations are blocked at login with a clear message.
  if (user.organizationId) {
    const org = await Organization.findById(user.organizationId);
    if (!org) {
      return res.status(403).json({ error: 'Your organization is no longer available.', code: 'ORG_MISSING' });
    }
    if (org.status === 'banned') {
      await writeAudit({
        actorId: user._id,
        actorName: user.name,
        actorRole: user.role,
        organizationId: org._id,
        action: 'organization.auth.blocked',
        entity: 'organization',
        summary: `Blocked CRM sign-in — organization “${org.name}” is banned`,
        severity: 'danger',
        ip: normalizeIp(req),
      });
      return res.status(403).json({
        error: org.suspendReason
          ? `This organization has been banned: ${org.suspendReason}. Contact HappyPix support.`
          : 'This organization has been banned. Contact HappyPix support.',
        code: 'ORG_BANNED',
        banned: true,
        organization: { id: String(org._id), name: org.name },
      });
    }
  }

  // Issue #26: store the real login timestamp (Date) — never a placeholder.
  user.lastLoginAt = new Date();
  await user.save();

  const token = issueToken(user);
  setSessionCookie(res, token);

  req.user = user;
  req.organization = user.organizationId ? await Organization.findById(user.organizationId) : null;
  const payload = await sessionPayload(req, user);

  await writeAudit({
    actorId: user._id,
    actorName: user.name,
    actorRole: user.role,
    organizationId: user.organizationId || null,
    action: user.organizationId ? 'organization.auth.login' : 'platform.auth.login',
    entity: 'user',
    summary: `${user.name} signed in to CRM`,
    ip: normalizeIp(req),
  });

  res.json({ token, ...payload });
}));

router.get('/me', requireAuth, asyncRoute(async (req, res) => {
  const payload = await sessionPayload(req, req.user);
  res.json(payload);
}));

router.post('/logout', requireAuth, asyncRoute(async (req, res) => {
  // Invalidate token server-side immediately
  req.user.sessionVersion = (Number(req.user.sessionVersion) || 0) + 1;
  await req.user.save();

  res.clearCookie('hp_admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  await writeAudit({
    req,
    action: req.user.organizationId ? 'organization.auth.logout' : 'platform.auth.logout',
    entity: 'user',
    summary: `${req.user.name} signed out of CRM`,
  });
  res.json({ ok: true });
}));

// ─── PROFILE & PASSWORD ─────────────────────────────────────────

router.put('/profile', requireAuth, asyncRoute(async (req, res) => {
  const { name, profilePhotoUrl, phoneNumber } = req.body;
  if (name) req.user.name = String(name).trim().slice(0, 80);
  if (profilePhotoUrl !== undefined) req.user.profilePhotoUrl = profilePhotoUrl || null;
  if (phoneNumber !== undefined) req.user.phoneNumber = phoneNumber ? String(phoneNumber).trim().slice(0, 20) : null;
  await req.user.save();
  res.json({ user: userView(req.user) });
}));

router.post('/password', requireAuth, asyncRoute(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new passwords required.' });
  const policy = passwordPolicyError(newPassword);
  if (policy) return res.status(400).json({ error: policy });
  if (!(await req.user.comparePassword(currentPassword))) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }
  req.user.password = newPassword;
  req.user.sessionVersion = (Number(req.user.sessionVersion) || 0) + 1; // other sessions sign out
  await req.user.save();
  const token = issueToken(req.user);
  setSessionCookie(res, token);
  await writeAudit({ req, action: 'platform.auth.password_change', entity: 'user', summary: `${req.user.name} changed their password`, severity: 'warn' });
  res.json({ ok: true, token });
}));

// ─── FORGOT PASSWORD / RESET ────────────────────────────────────

router.post('/forgot-password', otpRequestLimiter, asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const user = await User.findOne({ email });
  if (!user || user.status !== 'active') return res.status(200).json({ ok: true, delivery: 'email' });

  const otp = generateOTP();
  user.forgotPasswordCodeHash = await bcrypt.hash(otp, 10);
  user.forgotPasswordCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
  user.forgotPasswordAttempts = 0;
  await user.save();
  await sendOtpEmail(user.email, otp, 'Password Reset');
  await writeAudit({ req, actorId: user._id, actorName: user.name, actorRole: user.role, organizationId: user.organizationId, action: 'platform.auth.forgot_password', entity: 'user', summary: `Password reset code issued for ${user.name}`, severity: 'warn' });
  res.json({ ok: true, delivery: 'email' });
}));

router.post('/reset-password', otpVerifyLimiter, asyncRoute(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase().trim();
  const code = String(req.body.code || '').trim();
  const newPassword = String(req.body.newPassword || '');
  const user = await User.findOne({ email });
  if (!user || !user.forgotPasswordCodeHash || !user.forgotPasswordCodeExpires) {
    return res.status(400).json({ error: 'Invalid or expired reset code.' });
  }
  if (Date.now() > new Date(user.forgotPasswordCodeExpires).getTime()) {
    return res.status(400).json({ error: 'This reset code has expired. Request a new one.' });
  }
  if (!(await bcrypt.compare(code, user.forgotPasswordCodeHash))) {
    user.forgotPasswordAttempts = (user.forgotPasswordAttempts || 0) + 1;
    if (user.forgotPasswordAttempts >= 5) {
      user.forgotPasswordCodeHash = null;
      user.forgotPasswordCodeExpires = null;
      user.forgotPasswordAttempts = 0;
      await user.save();
      return res.status(400).json({ error: 'Too many incorrect attempts. This reset code has been invalidated for security. Please request a new code.' });
    }
    await user.save();
    return res.status(400).json({ error: `Invalid reset code. ${5 - user.forgotPasswordAttempts} attempt(s) remaining.` });
  }
  const policy = passwordPolicyError(newPassword);
  if (policy) return res.status(400).json({ error: policy });

  user.password = newPassword;
  user.forgotPasswordCodeHash = null;
  user.forgotPasswordCodeExpires = null;
  user.forgotPasswordAttempts = 0;
  await user.save();
  // A reset signs out every existing session (issue #30 sibling rule).
  if (user.organizationId) await bumpSessionVersion(user.organizationId).catch(() => {});
  res.clearCookie('hp_admin_token');
  await writeAudit({ req, actorId: user._id, actorName: user.name, actorRole: user.role, organizationId: user.organizationId, action: 'platform.auth.password_reset', entity: 'user', summary: `${user.name} reset their password`, severity: 'warn' });
  res.json({ ok: true });
}));

// ─── EMAIL CHANGE (OTP flow) ────────────────────────────────────

router.post('/email/change-request', requireAuth, otpRequestLimiter, asyncRoute(async (req, res) => {
  const { newEmail, currentPassword } = req.body;
  if (!newEmail || !currentPassword) return res.status(400).json({ error: 'Missing fields.' });
  if (!(await req.user.comparePassword(currentPassword))) {
    return res.status(400).json({ error: 'Your current password is incorrect.' });
  }
  const target = String(newEmail).toLowerCase().trim();
  if (await User.findOne({ email: target, _id: { $ne: req.user._id } })) {
    return res.status(409).json({ error: 'That email is already in use by another account.' });
  }
  const otp = generateOTP();
  req.user.emailChangeCodeHash = await bcrypt.hash(otp, 10);
  req.user.emailChangeCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
  req.user.emailChangePending = target;
  req.user.emailChangeAttempts = 0;
  await req.user.save();
  await sendOtpEmail(target, otp, 'Email Change');
  res.json({ ok: true, delivery: 'email', newEmail: target });
}));

router.post('/email/change-confirm', requireAuth, otpVerifyLimiter, asyncRoute(async (req, res) => {
  const { code } = req.body;
  if (!code || !req.user.emailChangeCodeHash) return res.status(400).json({ error: 'Invalid or expired verification code.' });
  if (Date.now() > new Date(req.user.emailChangeCodeExpires).getTime()) {
    return res.status(400).json({ error: 'This verification code has expired. Request a new one.' });
  }
  if (!(await bcrypt.compare(code, req.user.emailChangeCodeHash))) {
    req.user.emailChangeAttempts = (req.user.emailChangeAttempts || 0) + 1;
    if (req.user.emailChangeAttempts >= 5) {
      req.user.emailChangeCodeHash = null;
      req.user.emailChangeCodeExpires = null;
      req.user.emailChangePending = null;
      req.user.emailChangeAttempts = 0;
      await req.user.save();
      return res.status(400).json({ error: 'Too many incorrect attempts. This verification code has been invalidated for security.' });
    }
    await req.user.save();
    return res.status(400).json({ error: `Invalid verification code. ${5 - req.user.emailChangeAttempts} attempt(s) remaining.` });
  }
  const pending = req.user.emailChangePending;
  if (!pending) return res.status(400).json({ error: 'No email change is pending.' });
  if (await User.findOne({ email: pending, _id: { $ne: req.user._id } })) {
    return res.status(409).json({ error: 'That email was just claimed by another account. Start again.' });
  }
  req.user.email = pending;
  req.user.emailChangeCodeHash = null;
  req.user.emailChangeCodeExpires = null;
  req.user.emailChangePending = null;
  req.user.emailChangeAttempts = 0;
  await req.user.save();
  await writeAudit({ req, action: 'platform.auth.email_changed', entity: 'user', summary: `Email changed for ${req.user.name} → ${pending}`, severity: 'warn' });
  res.json({ ok: true, user: userView(req.user) });
}));

export default router;
export { userView, sessionPayload, passwordPolicyError };
