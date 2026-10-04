import mongoose from 'mongoose';

/**
 * RoleConfig Schema
 * Stores the default permissions for each role globally.
 * This allows the OWNER to define what an 'ADMIN', 'MANAGER', or 'CLIENT_ADMIN' can do by default.
 */
const roleConfigSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['ADMIN', 'MANAGER', 'CLIENT_ADMIN', 'CLIENT_MANAGER', 'BOOTH_OPERATOR'],
    required: true,
    unique: true
  },
  permissions: [{ type: String }],
  updatedAt: { type: Date, default: Date.now }
});

const RoleConfig = mongoose.model('RoleConfig', roleConfigSchema);
export default RoleConfig;
