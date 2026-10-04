import mongoose from 'mongoose';

// The new v2 Template is global/platform-owned.
// It relies on a deterministic layoutId (e.g. "57-v3") mapped via the layout engine
// rather than carrying raw canvas/slot coordinates.
const templateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'Custom' },
    
    // REQUIRED — the pinned layout variant (from src/lib/layouts.js)
    layoutId: { type: String, required: true },
    
    // Designer templates only (code registry component mapping)
    componentId: { type: String, default: null },
    
    // Playground/AI templates only (configuration object for the generic renderer)
    design: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      // Expected shape:
      // {
      //   bg: { type: "gradient"|"solid"|"image", colors: ["hex"], url: "string" },
      //   accent: "string", textColor: "string", ornament: "string", font: "string",
      //   slotShape: "string", titleBand: "string", title: "string", tagline: "string"
      // }
    },

    source: {
      type: String,
      enum: ['designer', 'playground', 'ai_generated'],
      required: true,
    },
    
    // Publish gate — active: false hides it from organizations
    active: { type: Boolean, default: true },
    
    // Usage stats (sessions rendered — display only)
    usage: { type: Number, default: 0 },
    
    // Optional reference to who created/modified it (platform user)
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

const Template = mongoose.model('Template', templateSchema);
export default Template;
