export default class ImageProvider {
  /**
   * Generates an image based on the provided prompt and returns it as a Buffer.
   * @param {string} prompt 
   * @returns {Promise<Buffer>}
   */
  async generateImage(prompt) {
    throw new Error('generateImage() must be implemented by subclasses');
  }
}
