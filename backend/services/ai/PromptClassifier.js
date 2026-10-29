export default class PromptClassifier {
  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.model = 'openai/gpt-oss-120b'; 
  }

  /**
   * Classifies the user prompt into an intent type.
   * @param {string} prompt 
   * @returns {Promise<string>}
   */
  async classify(prompt) {
    if (!this.groqApiKey) throw new Error('GROQ_API_KEY is missing.');

    const systemPrompt = `You are a photo booth template prompt classifier. 
Classify the user's request into exactly one of the following categories:
- THEME_CHANGE (e.g., "Make it Marvel themed", "Superhero theme")
- COLOR_CHANGE (e.g., "Make the colors pastel", "Change primary to blue")
- BACKGROUND_CHANGE (e.g., "Change the background to starry night")
- FRAME_CHANGE (e.g., "Make the frames rounded", "Add thick borders")
- STYLE_REFINEMENT (e.g., "Make it more premium", "Make it look luxurious")
- DECORATION_CHANGE (e.g., "Add floral decorations", "Put some stars around")
- USER_ASSET_BACKGROUND (e.g., "Use this image as the background")
- LAYOUT_CHANGE (e.g., "Make the first photo larger", "Move slot 2 down", "Change to 4 slots", "Change to portrait")

Respond with ONLY the exact category name as a string. No explanation.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.groqApiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        max_tokens: 10
      })
    });

    if (!response.ok) {
      console.error('Classifier API Error:', await response.text());
      return 'THEME_CHANGE'; // fallback
    }

    const data = await response.json();
    const result = data.choices[0].message.content.trim().toUpperCase();
    
    // Ensure valid output
    const valid = [
      'THEME_CHANGE', 'COLOR_CHANGE', 'BACKGROUND_CHANGE', 
      'FRAME_CHANGE', 'STYLE_REFINEMENT', 'DECORATION_CHANGE', 
      'USER_ASSET_BACKGROUND', 'LAYOUT_CHANGE'
    ];
    
    if (valid.includes(result)) return result;
    return 'THEME_CHANGE'; // default fallback
  }
}
