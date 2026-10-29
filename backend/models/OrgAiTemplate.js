import mongoose from 'mongoose';

const orgAiTemplateSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'Custom', trim: true },
    description: { type: String, default: '', trim: true },
    price: { type: Number, default: 0, min: 0 },
    layout: {
      code: { type: String, required: true },
      id: { type: String },
      name: { type: String },
      familyId: { type: String },
      width: { type: Number },
      height: { type: Number },
      orientation: { type: String },
      slotCount: { type: Number },
      slots: { type: Number },
      sheets: { type: Array },
      cutout: { type: Array },
      printSize: { type: String },
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
