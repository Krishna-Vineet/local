import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = system
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null, // null = platform-level action
    },
    action: {
      type: String,
      required: true,
      trim: true,
      // e.g. "platform.org.suspended", "platform.auth.failed"
    },
    entity: {
      type: String,
      required: true,
      // e.g. "organization", "template"
    },
    summary: {
      type: String,
      required: true,
      // e.g. "Suspended vishal — reason: billing dispute"
    },
    severity: {
      type: String,
      enum: ['info', 'warn', 'danger'],
      default: 'info',
    },
    ip: {
      type: String,
      default: null,
    },
    at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false } // 'at' is used instead of createdAt/updatedAt
);

auditLogSchema.index({ organizationId: 1, at: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
