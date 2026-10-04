import TogetherImageProvider from './TogetherImageProvider.js';
import { uploadToS3 } from '../../utils/s3.js';

export default class TemplateGenerationService {
  constructor() {
    this.imageProvider = new TogetherImageProvider();
    this.groqApiKey = process.env.GROQ_API_KEY;
  }

  /**
   * Generates a template specification and background image based on user prompt.
   * @param {string} prompt User's natural language request
   * @param {Object} options Options like photoCount, orientation
   * @returns {Promise<Object>} Template document data
   */
  async generate(prompt, options = {}) {
    if (!this.groqApiKey) {
      throw new Error('GROQ_API_KEY is missing.');
    }

    const { photoCount = 4, orientation = 'portrait', imageScope = 'specific' } = options;

    // STEP 1: Generate layout via Groq (LLaMA 3)
    const layoutSpec = await this.generateLayout(prompt, photoCount, orientation, imageScope);
    
    // STEP 2: Generate visual background via XAI
    // The visual prompt should be inferred from the original prompt, excluding layout technicalities
    const visualPrompt = layoutSpec.visualPrompt || prompt;
    const imageBuffer = await this.imageProvider.generateImage(visualPrompt);

    // STEP 3: Upload background to S3
    const uploadedAsset = await uploadToS3({
      buffer: imageBuffer,
      mimetype: 'image/png',
      folder: 'templates/backgrounds',
      originalname: `ai-bg-${Date.now()}.png`
    });

    // Construct final Template data
    return {
      name: layoutSpec.templateName || 'AI Generated Template',
      category: layoutSpec.category || 'AI Custom',
      orientation: orientation,
      canvas: layoutSpec.canvas,
      photoSlots: layoutSpec.photoSlots,
      background: {
        assetId: uploadedAsset.key,
        color: layoutSpec.background?.primaryColor || '#FFFFFF'
      },
      source: 'ai_generated',
      status: 'draft' // Always draft by default
    };
  }

  async generateLayout(prompt, photoCount, orientation, imageScope) {
    let constraints = '';
    
    if (imageScope === 'general' || orientation === 'universal') {
      constraints = `
Constraints:
- Orientation: Universal (Square/Seamless 1800x1800 recommended so it can be cropped to any ratio)
- IMPORTANT: The visualPrompt MUST instruct the image generator to create a seamless, universal background pattern or abstract design. It MUST NOT include any borders, empty photo boxes, or frames, as it needs to fit BEHIND any template layout regardless of slots or orientation.`;
    } else {
      constraints = `
Constraints:
- Orientation: ${orientation}
- For portrait, canvas is usually 1200x1800. For landscape, 1800x1200. For square, 1800x1800.
- IMPORTANT: The visualPrompt MUST instruct the image generator to create a high-quality, pure background art (like a wallpaper). It MUST NOT include any borders, empty photo boxes, or frames. The design should be continuous and edge-to-edge so that it can act as a global background behind any photo slot layout. Do not generate photo slots.`;
    }

    const systemPrompt = `You are a professional photo booth template designer AI. 
The user wants a photo booth template.
Return ONLY a valid JSON object matching this schema. Do NOT return markdown or explanation.
{
  "templateName": "Name of template",
  "category": "Event type",
  "visualPrompt": "A highly detailed prompt to send to an image generator for the background",
  "canvas": { "width": Number, "height": Number },
  "background": { "primaryColor": "Hex Code" }
}
${constraints}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqApiKey}`
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant', // Fast model for JSON generation
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API Error: ${errorText}`);
    }

    const data = await response.json();
    try {
      const parsed = JSON.parse(data.choices[0].message.content);
      this.validateLayout(parsed);
      return parsed;
    } catch (err) {
      throw new Error(`Failed to parse or validate Groq output: ${err.message}`);
    }
  }

  validateLayout(layout) {
    if (!layout.canvas || typeof layout.canvas.width !== 'number') {
      throw new Error('Invalid canvas dimensions');
    }
    // As templates are now global backgrounds, photoSlots are not required from AI
    if (!layout.photoSlots) {
      layout.photoSlots = [];
    }
  }
}
