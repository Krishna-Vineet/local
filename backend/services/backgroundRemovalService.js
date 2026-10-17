import sharp from 'sharp';

/**
 * Intelligent background removal using Sharp and flood-fill/chroma detection.
 * Works out-of-the-box without requiring third-party API keys or credits.
 *
 * @param {Buffer} inputBuffer - Image buffer (PNG, JPEG, WebP)
 * @param {Object} options - Tuning options (tolerance, feather, mode)
 * @returns {Promise<Buffer>} - PNG buffer with transparent background
 */
export async function removeBackgroundBuffer(inputBuffer, options = {}) {
  const tolerance = options.tolerance !== undefined ? Number(options.tolerance) : 42;
  const feather = options.feather !== undefined ? Number(options.feather) : 14;
  const mode = options.mode || 'auto'; // 'auto' | 'white' | 'black' | 'edges'

  const original = sharp(inputBuffer);
  const meta = await original.metadata();

  // Resize very large uploads to reasonable resolution for high fidelity and fast processing
  const maxDim = 1800;
  let pipeline = original;
  if ((meta.width && meta.width > maxDim) || (meta.height && meta.height > maxDim)) {
    pipeline = pipeline.resize({ width: maxDim, height: maxDim, fit: 'inside', withoutEnlargement: true });
  }

  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const totalPixels = width * height;

  // 1. Sample perimeter border pixels to determine background characteristics
  const sampleIndices = [];
  const stepX = Math.max(1, Math.floor(width / 30));
  const stepY = Math.max(1, Math.floor(height / 30));

  for (let x = 0; x < width; x += stepX) {
    sampleIndices.push((0 * width + x) * 4); // top border
    sampleIndices.push(((height - 1) * width + x) * 4); // bottom border
  }
  for (let y = 0; y < height; y += stepY) {
    sampleIndices.push((y * width + 0) * 4); // left border
    sampleIndices.push((y * width + (width - 1)) * 4); // right border
  }

  // Check if image already has transparent borders
  let transparentBorderCount = 0;
  for (const idx of sampleIndices) {
    if (data[idx + 3] < 96) transparentBorderCount++;
  }

  // If borders are already mostly transparent (>35%), preserve as-is
  if (transparentBorderCount > sampleIndices.length * 0.35) {
    return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
  }

  // Determine target background color
  let bgR = 255, bgG = 255, bgB = 255;
  if (mode === 'white') {
    bgR = 255; bgG = 255; bgB = 255;
  } else if (mode === 'black') {
    bgR = 0; bgG = 0; bgB = 0;
  } else {
    // Auto: Calculate median/average color of opaque border pixels
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (const idx of sampleIndices) {
      if (data[idx + 3] >= 128) {
        rSum += data[idx];
        gSum += data[idx + 1];
        bSum += data[idx + 2];
        count++;
      }
    }
    if (count > 0) {
      bgR = Math.round(rSum / count);
      bgG = Math.round(gSum / count);
      bgB = Math.round(bSum / count);
    }
  }

  function colorDist(idx) {
    const dr = data[idx] - bgR;
    const dg = data[idx + 1] - bgG;
    const db = data[idx + 2] - bgB;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  }

  // 2. Flood Fill (BFS) from outer edges inward
  // This removes outer background without erasing internal matching colors (e.g. eyes, white shirts)
  const visited = new Uint8Array(totalPixels);
  const queue = new Int32Array(totalPixels);
  let qHead = 0;
  let qTail = 0;

  // Seed with outer perimeter pixels matching background
  for (let x = 0; x < width; x++) {
    const topIdx = 0 * width + x;
    const botIdx = (height - 1) * width + x;
    if (colorDist(topIdx * 4) <= tolerance + feather) {
      visited[topIdx] = 1;
      queue[qTail++] = topIdx;
    }
    if (colorDist(botIdx * 4) <= tolerance + feather) {
      visited[botIdx] = 1;
      queue[qTail++] = botIdx;
    }
  }

  for (let y = 0; y < height; y++) {
    const leftIdx = y * width + 0;
    const rightIdx = y * width + (width - 1);
    if (!visited[leftIdx] && colorDist(leftIdx * 4) <= tolerance + feather) {
      visited[leftIdx] = 1;
      queue[qTail++] = leftIdx;
    }
    if (!visited[rightIdx] && colorDist(rightIdx * 4) <= tolerance + feather) {
      visited[rightIdx] = 1;
      queue[qTail++] = rightIdx;
    }
  }

  // Process queue
  while (qHead < qTail) {
    const curr = queue[qHead++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);
    const byteIdx = curr * 4;

    const d = colorDist(byteIdx);
    if (d <= tolerance) {
      data[byteIdx + 3] = 0;
    } else if (d <= tolerance + feather) {
      const alphaFactor = (d - tolerance) / feather;
      data[byteIdx + 3] = Math.round(data[byteIdx + 3] * Math.max(0, Math.min(1, alphaFactor)));
    }

    // Check 4-connected neighbors
    if (cx > 0) {
      const n = curr - 1;
      if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
        visited[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (cx < width - 1) {
      const n = curr + 1;
      if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
        visited[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (cy > 0) {
      const n = curr - width;
      if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
        visited[n] = 1;
        queue[qTail++] = n;
      }
    }
    if (cy < height - 1) {
      const n = curr + width;
      if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
        visited[n] = 1;
        queue[qTail++] = n;
      }
    }
  }

  // 3. For frame overlays (where there's an inner window/hole in the center):
  // Check the center region (middle 30% x 30%)
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const midIdx = midY * width + midX;

  if (!visited[midIdx] && colorDist(midIdx * 4) <= tolerance) {
    // Inner window detected! Flood fill the center hole
    const innerQueue = new Int32Array(totalPixels);
    let iHead = 0;
    let iTail = 0;

    visited[midIdx] = 1;
    innerQueue[iTail++] = midIdx;

    while (iHead < iTail) {
      const curr = innerQueue[iHead++];
      const cx = curr % width;
      const cy = Math.floor(curr / width);
      const byteIdx = curr * 4;

      const d = colorDist(byteIdx);
      if (d <= tolerance) {
        data[byteIdx + 3] = 0;
      } else if (d <= tolerance + feather) {
        const alphaFactor = (d - tolerance) / feather;
        data[byteIdx + 3] = Math.round(data[byteIdx + 3] * Math.max(0, Math.min(1, alphaFactor)));
      }

      if (cx > 0) {
        const n = curr - 1;
        if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
          visited[n] = 1;
          innerQueue[iTail++] = n;
        }
      }
      if (cx < width - 1) {
        const n = curr + 1;
        if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
          visited[n] = 1;
          innerQueue[iTail++] = n;
        }
      }
      if (cy > 0) {
        const n = curr - width;
        if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
          visited[n] = 1;
          innerQueue[iTail++] = n;
        }
      }
      if (cy < height - 1) {
        const n = curr + width;
        if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
          visited[n] = 1;
          innerQueue[iTail++] = n;
        }
      }
    }
  }

  return sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

/**
 * Full handler that supports remove.bg API key when available, with automatic
 * local fallback to sharp algorithmic removal.
 */
export async function removeBackground(imageInput, options = {}) {
  let buffer;
  if (Buffer.isBuffer(imageInput)) {
    buffer = imageInput;
  } else if (typeof imageInput === 'string') {
    if (imageInput.startsWith('data:')) {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    } else if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
      const resp = await fetch(imageInput);
      const arrayBuf = await resp.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    } else {
      buffer = Buffer.from(imageInput, 'base64');
    }
  } else {
    throw new Error('Unsupported image input format');
  }

  // 1. Try external remove.bg API if key is set
  const apiKey = (process.env.REMOVE_BG_API_KEY || '').trim();
  if (apiKey) {
    try {
      const base64Data = buffer.toString('base64');
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_file_b64: base64Data,
          size: 'auto',
          format: 'png',
        }),
      });
      if (response.ok) {
        const resBuf = await response.arrayBuffer();
        const outB64 = Buffer.from(resBuf).toString('base64');
        return {
          url: `data:image/png;base64,${outB64}`,
          method: 'remove.bg'
        };
      }
      console.warn('[remove-bg] remove.bg returned status', response.status, '- falling back to local engine');
    } catch (e) {
      console.warn('[remove-bg] external remove.bg failed:', e.message, '- falling back to local engine');
    }
  }

  // 2. Local algorithmic fallback
  const outPngBuffer = await removeBackgroundBuffer(buffer, options);
  const outB64 = outPngBuffer.toString('base64');
  return {
    url: `data:image/png;base64,${outB64}`,
    method: 'sharp-smart-removal'
  };
}
