import mongoose from 'mongoose';

const adminNoteSchema = new mongoose.Schema({
  text:      { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// ─── Ticket Types ─────────────────────────────────────────────
// end_user = Raised by a booth guest (via booth app) → routed to client_admin
//            Auto-attached: session data, payment ref, device info
//
// client   = Raised by a client_admin (via admin panel) → routed to superadmin
//            About: software bugs, billing issues, feature requests

const supportTicketSchema = new mongoose.Schema(
  {
    // ─── Routing ──────────────────────────────────────────────
    ticketType: {
      type: String,
      enum: ['end_user', 'client'],
      default: 'end_user',
    },

    // ─── Multi-tenant: which org submitted this ticket ───────
    // For end_user tickets: the org whose device/event was used
    // For client tickets: the org raising the complaint
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null,
      index: true,
    },

    // ─── Submitter Info ───────────────────────────────────────
    name:    { type: String, required: true, trim: true },
    email:   { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },

    // ─── Event Context (end_user tickets only) ────────────────
    eventId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
    eventShortCode:{ type: String, default: null },
    deviceId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },

    // ─── Session & Payment Context (end_user tickets only) ───
    sessionId:        { type: String, default: null }, // unique session identifier
    paymentReference: { type: String, default: null }, // Razorpay payment ID
    // holdPhotos: if true → S3 lifecycle deletion is paused until ticket resolves
    holdPhotos:       { type: Boolean, default: false },

    // ─── Status & Priority ────────────────────────────────────
    status: {
      type: String,
      enum: ['open', 'in-progress', 'resolved', 'closed'],
      default: 'open',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },

    // Set when status → "resolved". MongoDB TTL index auto-deletes 24 hrs later.
    resolvedAt: { type: Date, default: null },

    // ─── Admin Notes (internal) ───────────────────────────────
    adminNotes: [adminNoteSchema],
  },
  { timestamps: true }
);

// ─── Indexes ─────────────────────────────────────────────────
supportTicketSchema.index({ ticketType: 1, status: 1 });
supportTicketSchema.index({ status: 1, priority: 1 });
supportTicketSchema.index({ email: 1 });
supportTicketSchema.index({ createdAt: -1 });

// TTL index: auto-delete 24 hours after resolvedAt is set
supportTicketSchema.index({ resolvedAt: 1 }, { expireAfterSeconds: 86400 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
export default SupportTicket;
