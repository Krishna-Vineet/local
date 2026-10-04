import ImageProvider from './ImageProvider.js';

export default class XAIImageProvider extends ImageProvider {
  constructor() {
    super();
    this.apiKey = process.env.XAI_API_KEY;
    this.model = process.env.XAI_IMAGE_MODEL || 'grok-imagine-image-2.0';
    if (!this.apiKey) {
      console.warn('XAI_API_KEY is not set. Image generation will fail.');
    }
  }

  async generateImage(prompt) {
    if (!this.apiKey) {
      throw new Error('XAI API key is missing.');
    }

    // Since we don't have the exact XAI Node SDK structure handy,
    // we use a standard fetch to the assumed xAI API endpoint.
    // If the official SDK exists, this should be refactored to use it.
    
    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        prompt: prompt,
        model: this.model,
        response_format: 'b64_json',
        size: '1024x1024' // Default size, can be customized based on canvas ratio
      }),
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(60000) // 60s timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('XAI Image Generation failed:', errorText);
      throw new Error(`XAI API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      throw new Error('Invalid response structure from XAI API');
    }

    // Convert base64 to Buffer
    return Buffer.from(data.data[0].b64_json, 'base64');
  }
}
