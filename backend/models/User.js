import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String, required: true },
  phoneNumber: { type: String, trim: true, default: null },
  profilePhotoUrl: { type: String, default: null },

  // ─── Role Hierarchy ────────────────────────────────────────
  role: {
    type: String,
    enum: ['OWNER', 'PLATFORM_ADMIN', 'SUPPORT_MANAGER', 'ORG_ADMIN', 'ORG_MANAGER'],
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },

  // ─── Organization Link ─────────────────────────────────────
  // null     → internal roles (OWNER, PLATFORM_ADMIN, SUPPORT_MANAGER)
  // ObjectId → tenant roles (ORG_ADMIN, ORG_MANAGER)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true,
  },

  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: null },

  // ─── Session invalidation ─────────────────────────────────
  // Bumped on password change/reset, email change and deactivation.
  // JWTs embed the tokenVersion at issue time; any token with a stale
  // version is rejected (stateless "kill all sessions").
  tokenVersion: { type: Number, default: 0 },

  // ─── OTP Password & Email Reset ───────────────────────────────────────
  forgotPasswordCodeHash: { type: String, default: null },
  forgotPasswordCodeExpires: { type: Date, default: null },
  emailChangeCodeHash: { type: String, default: null },
  emailChangeCodeExpires: { type: Date, default: null },
  emailChangePending: { type: String, default: null, trim: true, lowercase: true }
});

// Validate Organization ID constraints based on role
userSchema.pre('validate', function() {
  // Only validate if it's a new document or role/organizationId has changed
  if (!this.isNew && !this.isModified('role') && !this.isModified('organizationId')) {
    return;
  }

  const internalRoles = ['OWNER', 'PLATFORM_ADMIN', 'SUPPORT_MANAGER'];
  const tenantRoles = ['ORG_ADMIN', 'ORG_MANAGER'];

  if (internalRoles.includes(this.role) && this.organizationId) {
    this.invalidate('organizationId', 'Internal roles cannot belong to an organization.');
  }
  
  if (tenantRoles.includes(this.role) && !this.organizationId) {
    this.invalidate('organizationId', 'Tenant roles must belong to an organization.');
  }
});

// Hash password before saving
userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
