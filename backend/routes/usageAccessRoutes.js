import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import RoleConfig from '../models/RoleConfig.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// ─── ROLE DEFAULTS ────────────────────────────────────────────────────────

// GET all role defaults
router.get('/role-defaults', authenticate, authorize('OWNER', 'ADMIN'), async (req, res) => {
  try {
    const roles = await RoleConfig.find();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch role configurations' });
  }
});

// PUT update role defaults
router.put('/role-defaults/:role', authenticate, authorize('OWNER'), async (req, res) => {
  try {
    const { role } = req.params;
    const { permissions } = req.body;
    
    let roleConfig = await RoleConfig.findOne({ role });
    if (!roleConfig) {
      roleConfig = new RoleConfig({ role, permissions });
    } else {
      roleConfig.permissions = permissions;
      roleConfig.updatedAt = new Date();
    }
    
    await roleConfig.save();
    res.json({ success: true, roleConfig });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role configuration' });
  }
});

// ─── USER MANAGEMENT (RBAC) ───────────────────────────────────────────────

// GET all users (Owner sees all, Client Admin sees only their org users)
router.get('/users', authenticate, authorize('OWNER', 'ADMIN', 'CLIENT_ADMIN'), async (req, res) => {
  try {
    let filter = {};
    // If not OWNER/ADMIN, only show users for their organization
    if (['CLIENT_ADMIN'].includes(req.user.role)) {
      filter.organizationId = req.user.organizationId;
    }
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST create user with permissions
router.post('/users', authenticate, authorize('OWNER', 'ADMIN', 'CLIENT_ADMIN'), async (req, res) => {
  try {
    const { name, email, password, role, useCustomPermissions, customPermissions } = req.body;
    
    // Client Admins can only create Client Managers or Booth Operators for their own org
    if (req.user.role === 'CLIENT_ADMIN' && !['CLIENT_MANAGER', 'BOOTH_OPERATOR'].includes(role)) {
      return res.status(403).json({ error: 'Client Admins can only create Client Managers or Operators.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password,
      role,
      organizationId: req.user.role === 'CLIENT_ADMIN' ? req.user.organizationId : req.body.organizationId || null,
      useCustomPermissions: useCustomPermissions || false,
      customPermissions: customPermissions || []
    });

    await newUser.save();
    
    const userWithoutPassword = newUser.toObject();
    delete userWithoutPassword.password;
    
    res.status(201).json({ success: true, user: userWithoutPassword });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// PUT update user permissions
router.put('/users/:id', authenticate, authorize('OWNER', 'ADMIN', 'CLIENT_ADMIN'), async (req, res) => {
  try {
    const { useCustomPermissions, customPermissions, role, name, email, password } = req.body;
    
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });
    
    // Security check for Tenant Isolation
    if (req.user.role === 'CLIENT_ADMIN' && String(targetUser.organizationId) !== String(req.user.organizationId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Only owner can change a user to OWNER
    if (role === 'OWNER' && req.user.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only Owner can grant OWNER role.' });
    }

    if (useCustomPermissions !== undefined) targetUser.useCustomPermissions = useCustomPermissions;
    if (customPermissions !== undefined) targetUser.customPermissions = customPermissions;
    if (role !== undefined) targetUser.role = role;
    if (name !== undefined) targetUser.name = name;
    if (email !== undefined) targetUser.email = email.toLowerCase();
    if (password !== undefined && password.trim() !== '') targetUser.password = password;

    await targetUser.save();
    
    res.json({ success: true, user: targetUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: error.message || 'Failed to update user' });
  }
});

// DELETE a user
router.delete('/users/:id', authenticate, authorize('OWNER', 'ADMIN', 'CLIENT_ADMIN'), async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (req.user.role === 'CLIENT_ADMIN' && String(targetUser.organizationId) !== String(req.user.organizationId)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Owner cannot delete themselves easily this way (prevent accidental lockouts)
    if (targetUser.role === 'OWNER' && String(targetUser._id) === String(req.user._id)) {
      return res.status(400).json({ error: 'You cannot delete yourself.' });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
