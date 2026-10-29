import mongoose from 'mongoose';

/**
 * AuditLog — ONE schema for platform-level and organization-level records.
 *
 * Issues #21–#25:
 *   • the actor is always stored (denormalised name + role so a deleted
 *     user never blanks the audit trail)
 *   • the timestamp is `at` (aliased as `timestamp` in API responses)
 *   • sorting always happens on `at`, never on a non-existent `createdAt`
 *   • organization + platform writes use this same model/schema
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null, // null = system / booth-originated event
      index: true,
    },
    // Denormalised actor identity — captured at write time.
    actorName: { type: String, default: 'System', trim: true },
    actorRole: { type: String, default: 'SYSTEM', trim: true },

    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null, // null = platform scope
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      // e.g. "platform.organization.suspended", "event.updated"
    },
    entity: {
      type: String,
      required: true,
      // e.g. "organization", "template", "device"
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
      index: true,
    },
  },
  { timestamps: false } // `at` is the only timestamp (issue #24)
);

auditLogSchema.index({ organizationId: 1, at: -1 });
auditLogSchema.index({ actorId: 1, at: -1 });
auditLogSchema.index({ action: 1, at: -1 });

// Legacy field names kept readable for older callers (details/ipAddress/
// performedBy/targetModel) so nothing silently loses data.
auditLogSchema.virtual('ipAddress').get(function () {
  return this.ip;
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
