import ImageProvider from './ImageProvider.js';

export default class TogetherImageProvider extends ImageProvider {
  constructor() {
    super();
    // Trim API key to remove accidental spaces/newlines
    this.apiKey = (process.env.TOGETHER_API_KEY || '').trim();
    this.model = process.env.TOGETHER_IMAGE_MODEL || 'black-forest-labs/FLUX.1-dev';
    if (!this.apiKey) {
      console.warn('TOGETHER_API_KEY is not set. Image generation will fail.');
    }
  }

  async generateImage(prompt) {
    if (!this.apiKey) {
      throw new Error('Together API key is missing.');
    }

    const isSchnell = this.model.includes('schnell');

    const response = await fetch('https://api.together.xyz/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        prompt: prompt,
        model: this.model,
        response_format: 'b64_json',
        width: 1024,
        height: 1024,
        n: 1
      }),
      // Add timeout to prevent hanging (120s)
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Together AI Image Generation failed:', errorText);
      throw new Error(`Together AI API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      throw new Error('Invalid response structure from Together AI API');
    }

    // Convert base64 to Buffer
    return Buffer.from(data.data[0].b64_json, 'base64');
  }
}
