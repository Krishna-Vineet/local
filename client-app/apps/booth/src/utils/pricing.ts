export const getTemplatePrice = (template: any, event: any): number => {
  if (!event) return 0;
  
  const templateId = template._id || template.id;

  // 1. Check per-template price override (highest priority)
  if (templateId && event.templatePrices) {
    // templatePrices can be a Mongoose Map (has .get) or a plain object
    const override = typeof event.templatePrices.get === 'function'
      ? event.templatePrices.get(String(templateId))
      : event.templatePrices[String(templateId)];
    if (override != null && override !== '') return Number(override);
  }

  // 2. Try individual template price (legacy field on the template itself)
  if (template.price != null) return template.price;

  // 3. Try media format price
  if (event.formatPrices && template.canvas) {
    const { width, height } = template.canvas;
    const ratio = width < height ? width / height : height / width; // always <= 1

    let formatKey = '';
    if (ratio > 0.95) {
      formatKey = 'square';
    } else if (ratio < 0.4) {
      formatKey = 'strip';
    } else if (ratio < 0.7) {
      formatKey = 'standard';
    } else {
      formatKey = 'large';
    }

    if (formatKey && event.formatPrices[formatKey] != null && event.formatPrices[formatKey] !== '') {
      return Number(event.formatPrices[formatKey]);
    }
  }

  // 4. Fallback to event printPrice
  if (event.printPrice != null && event.printPrice !== '') return Number(event.printPrice);

  // 5. Default to 0 (Free)
  return 0;
};
