import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  emailError, loginFail, loginGuard, loginOk, passwordPolicyError,
  safeMediaUrl, safeStr, userPublic, writeAudit,
} from '../../lib/helpers.js';
import { SESSION_TTL_MIN } from '../../lib/constants.js';
import { sendOtpEmail } from '../../lib/mailService.js';

const router = express.Router();

// Helper to generate a 6-digit numeric OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Generate JWT token (embeds tokenVersion for stateless revocation)
const generateToken = (user) => {
  return jwt.sign({ id: user._id, tv: user.tokenVersion ?? 0 }, process.env.JWT_SECRET, {
    expiresIn: `${SESSION_TTL_MIN}m`,
  });
};

const setSessionCookie = (res, token) => {
  res.cookie('hp_admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: SESSION_TTL_MIN * 60 * 1000,
  });
};

// ─── LOGIN & SESSION ────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const email = safeStr(req.body?.email, 120).toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    try {
      loginGuard(email); // 429 while locked — even for correct passwords
    } catch (e) {
      return res.status(e.status || 429).json({ error: e.message });
    }

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      loginFail(email);
      await writeAudit({
        actorId: user?._id || null,
        action: 'platform.auth.login_failed',
        entity: 'user',
        summary: `Failed sign-in attempt for ${email}`,
        severity: 'warn',
        req,
      });
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    loginOk(email);

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = generateToken(user);
    setSessionCookie(res, token);

    await writeAudit({
      actorId: user._id,
      organizationId: user.organizationId,
      action: `${user.organizationId ? 'organization' : 'platform'}.auth.login`,
      entity: 'user',
      summary: `${user.name} signed in to CRM`,
      req,
    });

    res.json({ token, user: userPublic(user), expiresInMin: SESSION_TTL_MIN });
  } catch (error) {
    console.error('Login error:', error.message);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const token = req.cookies?.hp_admin_token || req.headers.authorization?.split(' ')[1] || null;
  res.json({ token, user: userPublic(req.user) });
});

router.post('/logout', requireAuth, async (req, res) => {
  // Revoke every issued token for this user (stateless kill-all) and
  // clear the cookie.
  req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
  await req.user.save();
  res.clearCookie('hp_admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.json({ ok: true });
});

// ─── PROFILE & PASSWORD (Authenticated) ────────────────────────────────────

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, photoUrl, profilePhotoUrl } = req.body;
    if (name !== undefined) {
      const clean = safeStr(name, 80);
      if (!clean) return res.status(400).json({ error: 'Name cannot be empty.' });
      req.user.name = clean;
    }
    const photo = photoUrl !== undefined ? photoUrl : profilePhotoUrl;
    if (photo !== undefined) {
      const media = safeMediaUrl(photo);
      if (photo && !media) return res.status(400).json({ error: 'Photo must be an https:// or data:image/ URL.' });
      req.user.profilePhotoUrl = media;
    }
    await req.user.save();
    res.json({ user: userPublic(req.user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.post('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new passwords required.' });

    const policy = passwordPolicyError(newPassword);
    if (policy) return res.status(400).json({ error: policy });

    // Re-fetch with the password field (req.user is selected without it)
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ error: 'Your current password is incorrect.' });

    user.password = newPassword;
    // Kill every existing session (password change signs out all devices).
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await writeAudit({
      actorId: user._id,
      organizationId: user.organizationId,
      action: 'platform.auth.password_change',
      entity: 'user',
      summary: `${user.name} changed their password`,
      severity: 'warn',
      req,
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ─── FORGOT PASSWORD (OTP Flow) ─────────────────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  try {
    const email = safeStr(req.body?.email, 120).toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email });

    // Always return 200 to prevent email enumeration
    if (!user || user.status !== 'active') {
      return res.status(200).json({ ok: true, delivery: 'email' });
    }

    const otp = generateOTP();
    user.forgotPasswordCodeHash = await bcrypt.hash(otp, 10);
    user.forgotPasswordCodeExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await user.save();

    let delivery;
    try {
      delivery = await sendOtpEmail(user.email, otp, 'password-reset');
    } catch (mailError) {
      console.error('❌ Forgot-password mail failure:', mailError.message);
      return res.status(503).json({ error: 'Email delivery is temporarily unavailable. Please try again in a few minutes.' });
    }
    await writeAudit({
      actorId: user._id,
      organizationId: user.organizationId,
      action: 'platform.auth.forgot_password',
      entity: 'user',
      summary: `Password reset code issued for ${user.name}`,
      severity: 'warn',
      req,
    });

    res.status(200).json({
      ok: true,
      delivery,
      // Demo/sandbox mode only — never in production without DEMO_MODE.
      code: delivery === 'demo' ? otp : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Missing fields.' });

    const policy = passwordPolicyError(newPassword);
    if (policy) return res.status(400).json({ error: policy });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user || !user.forgotPasswordCodeHash || !user.forgotPasswordCodeExpires) {
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    if (Date.now() > new Date(user.forgotPasswordCodeExpires).getTime()) {
      return res.status(400).json({ error: 'Code has expired. Request a new one.' });
    }

    const isMatch = await bcrypt.compare(String(code), user.forgotPasswordCodeHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid code.' });

    user.password = newPassword;
    user.forgotPasswordCodeHash = null;
    user.forgotPasswordCodeExpires = null;
    // A reset signs out every existing session.
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await writeAudit({
      actorId: user._id,
      organizationId: user.organizationId,
      action: 'platform.auth.password_reset',
      entity: 'user',
      summary: `${user.name} reset their password via forgot-password`,
      severity: 'warn',
      req,
    });

    res.clearCookie('hp_admin_token');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Password reset failed.' });
  }
});

// ─── EMAIL CHANGE (OTP Flow) ────────────────────────────────────────────────

router.post('/email/change-request', requireAuth, async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;
    if (!newEmail || !currentPassword) return res.status(400).json({ error: 'Missing fields.' });

    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ error: 'Your current password is incorrect.' });

    const clean = String(newEmail).toLowerCase().trim();
    const fmt = emailError(clean);
    if (fmt) return res.status(400).json({ error: fmt });

    const existing = await User.findOne({ email: clean });
    if (existing) return res.status(409).json({ error: 'That email is already in use by another account.' });

    const otp = generateOTP();
    req.user.emailChangeCodeHash = await bcrypt.hash(otp, 10);
    req.user.emailChangeCodeExpires = new Date(Date.now() + 10 * 60 * 1000);
    req.user.emailChangePending = clean;
    await req.user.save();

    let delivery;
    try {
      delivery = await sendOtpEmail(clean, otp, 'email-change');
    } catch (mailError) {
      console.error('❌ Email-change mail failure:', mailError.message);
      return res.status(503).json({ error: 'Email delivery is temporarily unavailable. Please try again in a few minutes.' });
    }
    await writeAudit({
      actorId: req.user._id,
      organizationId: req.user.organizationId,
      action: 'platform.auth.email_change_requested',
      entity: 'user',
      summary: `Email change requested for ${req.user.name} → ${clean}`,
      severity: 'warn',
      req,
    });

    res.json({
      ok: true,
      delivery,
      newEmail: req.user.emailChangePending,
      code: delivery === 'demo' ? otp : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request email change.' });
  }
});

router.post('/email/change-confirm', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !req.user.emailChangeCodeHash) return res.status(400).json({ error: 'Invalid or expired code.' });

    if (Date.now() > new Date(req.user.emailChangeCodeExpires).getTime()) {
      return res.status(400).json({ error: 'Code has expired. Request a new one.' });
    }

    const isMatch = await bcrypt.compare(String(code), req.user.emailChangeCodeHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid code.' });

    // Check again if taken
    const existing = await User.findOne({ email: req.user.emailChangePending });
    if (existing) return res.status(409).json({ error: 'That email was just claimed by another account. Start again.' });

    const old = req.user.email;
    req.user.email = req.user.emailChangePending;
    req.user.emailChangeCodeHash = null;
    req.user.emailChangeCodeExpires = null;
    req.user.emailChangePending = null;
    // Other sessions were tied to the old identity — kill them all.
    req.user.tokenVersion = (req.user.tokenVersion || 0) + 1;
    await req.user.save();

    await writeAudit({
      actorId: req.user._id,
      organizationId: req.user.organizationId,
      action: 'platform.auth.email_changed',
      entity: 'user',
      summary: `Email changed for ${req.user.name}: ${old} → ${req.user.email}`,
      severity: 'warn',
      req,
    });

    res.json({ ok: true, user: userPublic(req.user) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm email change.' });
  }
});

export default router;
