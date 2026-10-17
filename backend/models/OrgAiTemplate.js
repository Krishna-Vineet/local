import mongoose from 'mongoose';

const orgAiTemplateSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true },
    layout: {
      code: { type: String, required: true },
      width: { type: Number },
      height: { type: Number },
      orientation: { type: String },
      slotCount: { type: Number }
    },
    slots: { type: Array, default: [] },
    design: { type: Object, default: {} },
    assets: { type: Array, default: [] },
    versions: { type: Array, default: [] },
    prompt: { type: String },
    source: { type: String, default: 'ai' },
    cache: {
      indexedDb: { type: Boolean, default: true }
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const OrgAiTemplate = mongoose.models.OrgAiTemplate || mongoose.model('OrgAiTemplate', orgAiTemplateSchema);
export default OrgAiTemplate;
