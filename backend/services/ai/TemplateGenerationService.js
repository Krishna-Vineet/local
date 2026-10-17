import TogetherImageProvider from './TogetherImageProvider.js';
import PromptClassifier from './PromptClassifier.js';
import { uploadToS3 } from '../../utils/s3.js';

export default class TemplateGenerationService {
  constructor() {
    this.imageProvider = new TogetherImageProvider();
    this.classifier = new PromptClassifier();
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.groqModel = 'openai/gpt-oss-120b';
  }

  /**
   * Generates or patches a design specification based on user prompt.
   * @param {string} prompt User's natural language request
   * @param {Object} context Context including current layout, slot geometry, and existing design.
   * @returns {Promise<Object>} Updated design, layout, and new assets
   */
  async generate(prompt, context = {}) {
    if (!this.groqApiKey) throw new Error('GROQ_API_KEY is missing.');

    const { layout = {}, currentDesign = {}, currentAssets = [] } = context;
    const isNew = Object.keys(currentDesign).length === 0;

    // STEP 1: Classify prompt
    const intent = await this.classifier.classify(prompt);
    
    if (intent === 'LAYOUT_CHANGE') {
      throw new Error('This request changes the layout structure. Please select another layout or use the layout editor.');
    }

    // STEP 2: Generate/Patch Design JSON via Groq
    let designSpec = {};
    if (isNew || intent === 'THEME_CHANGE') {
      designSpec = await this.generateFullDesign(prompt, layout);
    } else {
      designSpec = await this.patchDesign(prompt, currentDesign, intent, layout);
    }

    // STEP 3: Generate requested assets (Backgrounds/Decorations) via FLUX
    const finalAssets = [...currentAssets];
    const generatedDesignAssets = designSpec.assets || [];
    const newAssets = [];

    for (const assetReq of generatedDesignAssets) {
      if (assetReq.source === 'generate' && assetReq.prompt) {
        console.log(`Generating visual asset: ${assetReq.type}...`);
        
        // Use Flux
        const imageBuffer = await this.imageProvider.generateImage(assetReq.prompt);
        
        const ext = assetReq.type === 'decoration' ? 'png' : 'jpg'; // decorations need transparency if supported
        const mimetype = assetReq.type === 'decoration' ? 'image/png' : 'image/jpeg';
        
        // Return base64 URL directly, do NOT upload to S3 yet!
        const b64Data = imageBuffer.toString('base64');
        const dataUrl = `data:${mimetype};base64,${b64Data}`;
        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const assetRecord = {
          assetId: tempId,
          url: dataUrl,
          type: assetReq.type,
          role: assetReq.role || assetReq.type,
          mimeType: mimetype,
          isTemp: true
        };

        newAssets.push(assetRecord);
        finalAssets.push(assetRecord);
      }
    }

    // Map the new generated assets to the design spec
    if (designSpec.background && designSpec.background.type === 'generated') {
      const bgAsset = newAssets.find(a => a.type === 'background' || a.role === 'background');
      if (bgAsset) {
        designSpec.background.assetId = bgAsset.assetId;
        designSpec.background.url = bgAsset.url;
      }
    }

    // Handle decoration assets
    if (designSpec.decorations && Array.isArray(designSpec.decorations)) {
       for (let dec of designSpec.decorations) {
           if (dec.source === 'generate' && !dec.assetId) {
               const decAsset = newAssets.find(a => a.role === dec.type && !a.assigned);
               if (decAsset) {
                   dec.assetId = decAsset.assetId;
                   dec.url = decAsset.url;
                   decAsset.assigned = true;
               }
           }
       }
    }

    // Clean up temporary assets field from design spec
    delete designSpec.assets;

    return {
      design: designSpec,
      assets: newAssets,
      layout: layout // unchanged
    };
  }

  async generateFullDesign(prompt, layout) {
    const width = layout.width || 1200;
    const height = layout.height || 1800;
    
    const systemPrompt = `You are an expert Photo Booth Template Design AI.
The layout geometry (slots, canvas size) is IMMUTABLE and controlled by the HappyPix Layout Engine.
Your job is ONLY to create a stunning DESIGN JSON for the layout.

Return ONLY a valid JSON matching this schema:
{
  "theme": { "name": "string", "category": "string", "mood": ["string"] },
  "palette": { "primary": "hex", "secondary": "hex", "accent": "hex", "background": "hex", "text": "hex" },
  "background": { "required": true, "type": "generated", "style": "string", "density": "medium" },
  "decorations": [ { "type": "string", "position": "top-right|bottom-left|background", "source": "generate" } ],
  "photoTreatment": { "border": boolean, "borderWidth": number, "borderStyle": "solid|comic|elegant", "shadow": boolean, "glow": boolean },
  "typography": { "headingStyle": "string", "bodyStyle": "string" },
  "assets": [ 
    { 
      "type": "background", 
      "role": "background",
      "source": "generate", 
      "prompt": "Highly detailed visual prompt to send to FLUX image generator. MUST NOT include people, text, faces, or UI. Leave visually clean areas where photo slots will go." 
    }
  ]
}

Instructions for Asset Prompts:
- You MUST ALWAYS include at least one asset in the "assets" array for the background (type: "background", source: "generate", prompt: "..."). Ensure background.type is set to "generated".
- Background image prompt must specify size constraints implicitly (it will be used as a ${width}x${height} background).
- Mention 'decorative background without text or photo placeholders' to avoid the image generator making fake frames.
- IMPORTANT CONTENT MODERATION RULE: The image generator (FLUX) strictly blocks copyrighted/trademarked IP (e.g., Marvel, Disney, Star Wars). If the user asks for a specific brand, you MUST sanitize the 'prompt' field to use GENERIC equivalents (e.g., use "comic book superhero style with red and gold" instead of "Iron Man Marvel", or "magical fairy tale castle" instead of "Disney"). Never send trademarked names in the asset prompt!`;

    return this.callGroq(systemPrompt, prompt);
  }

  async patchDesign(prompt, currentDesign, intent, layout) {
    const systemPrompt = `You are a design modification AI.
The user wants to modify an EXISTING design. The current design is:
${JSON.stringify(currentDesign, null, 2)}

User Intent: ${intent}

Rules:
- DO NOT rewrite the entire design unless requested. Keep existing values if unrelated to the prompt.
- If the user wants a new background or mentions ANY visual elements (like flowers, lamps, themes), you MUST add a new background asset prompt to the "assets" array and set background.type = "generated".
- Return the ENTIRE updated design JSON object. Same schema as full generation.
- IMPORTANT CONTENT MODERATION RULE: The image generator (FLUX) strictly blocks copyrighted IP (Marvel, Disney). Sanitize asset prompts to use generic equivalents!`;

    return this.callGroq(systemPrompt, prompt);
  }

  async callGroq(systemPrompt, userPrompt) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqApiKey}`
      },
      body: JSON.stringify({
        model: this.groqModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq API Error: ${err}`);
    }

    const data = await response.json();
    try {
      return JSON.parse(data.choices[0].message.content);
    } catch (e) {
      throw new Error(`Failed to parse Groq JSON: ${e.message}`);
    }
  }
}
