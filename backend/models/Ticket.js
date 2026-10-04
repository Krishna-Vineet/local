import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  author: { type: String, required: true },
  at: { type: Date, default: Date.now },
  text: { type: String, required: true }
}, { _id: true }); // keep _id for messages

const ticketSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      default: null,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      default: null,
    },
    category: {
      type: String,
      enum: ['device', 'payment', 'photo', 'event', 'general'],
      default: 'general',
    },
    subject: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'closed'],
      default: 'open',
    },
    
    // Guest info collected at the booth
    guest: {
      name: { type: String, trim: true, default: '' },
      contact: { type: String, trim: true, default: '' },
    },
    
    // Extensible session snapshot pushed from the booth
    session: { type: mongoose.Schema.Types.Mixed, default: {} },

    messages: [messageSchema],
    
    resolution: { type: String, default: null },
  },
  { timestamps: true }
);

ticketSchema.index({ organizationId: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });

const Ticket = mongoose.model('Ticket', ticketSchema);
export default Ticket;
