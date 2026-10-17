import mongoose from 'mongoose';

const templateLayoutSchema = new mongoose.Schema(
  {
    codeword: { type: String, required: true, unique: true },
    grid: { type: Object, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const TemplateLayout = mongoose.models.TemplateLayout || mongoose.model('TemplateLayout', templateLayoutSchema);
export default TemplateLayout;
