import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../../models/User.js';
import Organization from '../../models/Organization.js';
import { requireAuth, authenticateSession } from '../../middleware/auth.js';

const router = express.Router();

// Helper to generate a 6-digit numeric OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Generate JWT token (Helper)
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '8h', // SESSION_TTL_MIN default 480
  });
};

// ─── LOGIN & SESSION ────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password.' });

    if (user.status !== 'active') return res.status(403).json({ error: 'Account is deactivated.' });

    let org = null;
    if (user.organizationId) {
      org = await Organization.findById(user.organizationId);
      if (org && org.status === 'banned') {
        return res.status(403).json({ error: 'Your organization has been banned. Access denied.', code: 'ORG_BANNED' });
      }
    }

    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

    const token = generateToken(user._id);

    // Set secure HttpOnly cookie for CRM
    res.cookie('hp_admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    const sessionUser = user.toObject();
    delete sessionUser.password;
    res.json({
      token,
      user: {
        ...sessionUser,
        orgName: org?.name || null,
        planStatus: org?.status || null,
      },
      expiresInMin: 480,
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error during login.' });
  }
});

router.get('/me', authenticateSession, async (req, res) => {
  res.json({
    token: req.cookies?.hp_admin_token || req.headers.authorization?.split(' ')[1],
    user: {
      ...req.user.toObject(),
      orgName: req.organization?.name || null,
      planStatus: req.organization?.status || null,
    },
  });
});

router.post('/logout', requireAuth, (req, res) => {
  res.clearCookie('hp_admin_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ ok: true });
});

// ─── PROFILE & PASSWORD (Authenticated) ────────────────────────────────────

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, profilePhotoUrl } = req.body;
    if (name) req.user.name = name.trim();
    if (profilePhotoUrl !== undefined) req.user.profilePhotoUrl = profilePhotoUrl;
    
    await req.user.save();
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.post('/password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new passwords required.' });

    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res.status(400).json({ error: 'Password needs ≥ 8 chars, ≥ 1 letter, ≥ 1 digit.' });
    }

    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ error: 'Incorrect current password.' });

    req.user.password = newPassword;
    await req.user.save();

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ─── FORGOT PASSWORD (OTP Flow) ─────────────────────────────────────────────

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    // Always return 200 to prevent email enumeration
    if (!user) return res.status(200).json({ ok: true, delivery: "email" });

    const otp = generateOTP();
    // In production, we'd hash the OTP. For demo simplicity while matching contract:
    user.forgotPasswordCodeHash = await bcrypt.hash(otp, 10);
    user.forgotPasswordCodeExpires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save();

    // In a real app, send email/SMS here.
    // For sandbox preview, we return it if VITE_MOCK=true or running locally.
    const isDemo = process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true';
    res.status(200).json({ ok: true, delivery: isDemo ? 'demo' : 'email', code: isDemo ? otp : undefined });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ error: 'Missing fields.' });

    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return res.status(400).json({ error: 'Password needs ≥ 8 chars, ≥ 1 letter, ≥ 1 digit.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.forgotPasswordCodeHash || !user.forgotPasswordCodeExpires) {
      return res.status(400).json({ error: 'Invalid or expired code.' });
    }

    if (Date.now() > user.forgotPasswordCodeExpires) {
      return res.status(400).json({ error: 'Code has expired.' });
    }

    const isMatch = await bcrypt.compare(code, user.forgotPasswordCodeHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid code.' });

    user.password = newPassword;
    user.forgotPasswordCodeHash = null;
    user.forgotPasswordCodeExpires = null;
    await user.save();

    // Kill existing sessions by clearing cookie if they are the ones resetting
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
    if (!isMatch) return res.status(400).json({ error: 'Incorrect password.' });

    const existing = await User.findOne({ email: newEmail.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'Email already in use.' });

    const otp = generateOTP();
    req.user.emailChangeCodeHash = await bcrypt.hash(otp, 10);
    req.user.emailChangeCodeExpires = Date.now() + 10 * 60 * 1000;
    req.user.emailChangePending = newEmail.toLowerCase().trim();
    await req.user.save();

    const isDemo = process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === 'true';
    res.json({ ok: true, delivery: isDemo ? 'demo' : 'email', newEmail: req.user.emailChangePending, code: isDemo ? otp : undefined });
  } catch (error) {
    res.status(500).json({ error: 'Failed to request email change.' });
  }
});

router.post('/email/change-confirm', requireAuth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || !req.user.emailChangeCodeHash) return res.status(400).json({ error: 'Invalid or expired code.' });

    if (Date.now() > req.user.emailChangeCodeExpires) {
      return res.status(400).json({ error: 'Code has expired.' });
    }

    const isMatch = await bcrypt.compare(code, req.user.emailChangeCodeHash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid code.' });

    // Check again if taken
    const existing = await User.findOne({ email: req.user.emailChangePending });
    if (existing) return res.status(409).json({ error: 'Email already in use.' });

    req.user.email = req.user.emailChangePending;
    req.user.emailChangeCodeHash = null;
    req.user.emailChangeCodeExpires = null;
    req.user.emailChangePending = null;
    await req.user.save();

    res.json({ ok: true, user: req.user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm email change.' });
  }
});

export default router;
