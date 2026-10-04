import express from 'express';
import jwt from 'jsonwebtoken';
import { logAudit } from '../utils/auditLogger.js';
import crypto from 'crypto';
import User from '../models/User.js';
import RoleConfig from '../models/RoleConfig.js';
import Organization from '../models/Organization.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Admin Register (Initial setup)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'User already exists' });

    const newUser = new User({ name, email, password, role });
    await newUser.save();

    await logAudit(req, 'CREATE_USER', newUser._id, 'User', { email: newUser.email, role: newUser.role });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('❌ Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // Include organizationId in JWT so all subsequent requests are org-scoped
    const token = jwt.sign(
      { 
        id:             user._id, 
        role:           user.role,
        organizationId: user.organizationId || null,
      }, 
      process.env.JWT_SECRET, 
      { expiresIn: '8h' }  // 8 hours — one working session, no persistent login
    );

    // Set token as HttpOnly cookie (XSS-safe, not accessible via JS)
    res.cookie('hp_admin_token', token, {
      httpOnly: true,                                         // JS cannot read it
      secure:   process.env.NODE_ENV === 'production',       // HTTPS only in prod
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // cross-site in prod (Vercel)
      maxAge:   8 * 60 * 60 * 1000,                         // 8 hours in ms
      path:     '/',
    });
    
    // Calculate effective permissions for frontend
    let effectivePermissions = [];
    if (user.role === 'OWNER') {
      effectivePermissions = ['*'];
    } else if (user.useCustomPermissions) {
      effectivePermissions = user.customPermissions || [];
    } else {
      const roleConfig = await RoleConfig.findOne({ role: user.role });
      if (roleConfig) {
        effectivePermissions = roleConfig.permissions || [];
      } else {
        const fallbacks = {
          'ADMIN': ['manage_clients', 'manage_devices', 'manage_support', 'manage_audit', 'manage_templates'],
          'MANAGER': ['view_clients', 'view_devices', 'manage_support'],
          'CLIENT_ADMIN': ['manage_events', 'manage_devices', 'manage_payments', 'manage_coupons', 'manage_branding', 'manage_templates', 'manage_settings', 'manage_support', 'view_gallery'],
          'CLIENT_MANAGER': ['manage_events', 'view_devices', 'manage_support'],
          'BOOTH_OPERATOR': []
        };
        effectivePermissions = fallbacks[user.role] || [];
      }
    }

    res.json({
      token,   // also return token for API clients / Authorization header use
      user: { 
        id:             user._id, 
        name:           user.name, 
        email:          user.email, 
        role:           user.role,
        organizationId: user.organizationId || null,
        permissions:    effectivePermissions,
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me — verify cookie and return current user (used on page refresh)
router.get('/me', authenticate, (req, res) => {
  res.json({
    user: {
      id:             req.user._id,
      name:           req.user.name,
      email:          req.user.email,
      role:           req.user.role,
      organizationId: req.user.organizationId || null,
      phoneNumber:    req.user.phoneNumber,
      profilePhotoUrl: req.user.profilePhotoUrl,
      createdAt:      req.user.createdAt,
      permissions:    req.permissions || [],
    }
  });
});

// ─── Update Profile ───────────────────────────────────────────
// PUT /api/auth/profile
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, phoneNumber, profilePhotoUrl } = req.body;
    
    // We intentionally ignore email updates to prevent breaking login flow or org isolation.
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (profilePhotoUrl !== undefined) updateData.profilePhotoUrl = profilePhotoUrl;

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      _id:            updatedUser._id,
      name:           updatedUser.name,
      email:          updatedUser.email,
      role:           updatedUser.role,
      organizationId: updatedUser.organizationId,
      phoneNumber:    updatedUser.phoneNumber,
      profilePhotoUrl: updatedUser.profilePhotoUrl,
      createdAt:      updatedUser.createdAt,
    });
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Admin Logout — clears the HttpOnly cookie
router.post('/logout', (req, res) => {
  res.clearCookie('hp_admin_token', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path:     '/',
  });
  res.json({ message: 'Logged out successfully' });
});

// ─── User Management (Role-based) ─────────────────
// Removed as per old CRM cleanup

// ─── Forgot Password (generate reset token) ─────────────────
// POST /api/auth/forgot-password
// Returns a reset token — superadmin can share it with the client.
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    // Always respond success to avoid email enumeration
    if (!user) {
      return res.json({ message: 'If that email exists, a reset token has been generated.' });
    }

    // Generate a secure 32-byte hex token (64 char string)
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken   = token;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    res.json({
      message: 'Reset token generated.',
      resetToken: token,           // superadmin shares this
      expiresIn: '1 hour',
    });
  } catch (err) {
    console.error('\u274C Forgot password error:', err);
    res.status(500).json({ error: 'Failed to generate reset token' });
  }
});

// ─── Reset Password (validate token + set new password) ──────
// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await User.findOne({
      resetPasswordToken:   token,
      resetPasswordExpires: { $gt: new Date() }, // not expired
    });
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password             = password; // pre-save hook will hash it
    user.resetPasswordToken   = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error('\u274C Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

export default router;
