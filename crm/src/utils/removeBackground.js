/**
 * Client-Side Intelligent Background Removal Engine for Photo Overlays & Cutouts.
 * 
 * Uses HTML5 Canvas + Perimeter Flood Fill + Alpha Feathering.
 * Leaves foreground elements (frames, graphics, logos, people) crisp while
 * converting solid / uniform backdrops to full transparency so underlying
 * photo slots show through clearly!
 */

export async function removeBackgroundCanvas(imageUrlOrDataUrl, options = {}) {
  const tolerance = options.tolerance !== undefined ? Number(options.tolerance) : 40;
  const feather = options.feather !== undefined ? Number(options.feather) : 12;
  const mode = options.mode || 'auto'; // 'auto' | 'white' | 'black'

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 1600;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const totalPixels = w * h;

        // 1. Sample border pixels
        const sampleIndices = [];
        const stepX = Math.max(1, Math.floor(w / 30));
        const stepY = Math.max(1, Math.floor(h / 30));

        for (let x = 0; x < w; x += stepX) {
          sampleIndices.push((0 * w + x) * 4); // top
          sampleIndices.push(((h - 1) * w + x) * 4); // bottom
        }
        for (let y = 0; y < h; y += stepY) {
          sampleIndices.push((y * w + 0) * 4); // left
          sampleIndices.push((y * w + (w - 1)) * 4); // right
        }

        // Check if already transparent
        let transCount = 0;
        for (const idx of sampleIndices) {
          if (data[idx + 3] < 96) transCount++;
        }
        if (transCount > sampleIndices.length * 0.4) {
          // Already transparent
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        // Determine background color
        let bgR = 255, bgG = 255, bgB = 255;
        if (mode === 'white') {
          bgR = 255; bgG = 255; bgB = 255;
        } else if (mode === 'black') {
          bgR = 0; bgG = 0; bgB = 0;
        } else {
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

        // 2. BFS Flood Fill from outer edges
        const visited = new Uint8Array(totalPixels);
        const queue = new Int32Array(totalPixels);
        let qHead = 0;
        let qTail = 0;

        for (let x = 0; x < w; x++) {
          const topIdx = 0 * w + x;
          const botIdx = (h - 1) * w + x;
          if (colorDist(topIdx * 4) <= tolerance + feather) {
            visited[topIdx] = 1;
            queue[qTail++] = topIdx;
          }
          if (colorDist(botIdx * 4) <= tolerance + feather) {
            visited[botIdx] = 1;
            queue[qTail++] = botIdx;
          }
        }

        for (let y = 0; y < h; y++) {
          const leftIdx = y * w + 0;
          const rightIdx = y * w + (w - 1);
          if (!visited[leftIdx] && colorDist(leftIdx * 4) <= tolerance + feather) {
            visited[leftIdx] = 1;
            queue[qTail++] = leftIdx;
          }
          if (!visited[rightIdx] && colorDist(rightIdx * 4) <= tolerance + feather) {
            visited[rightIdx] = 1;
            queue[qTail++] = rightIdx;
          }
        }

        while (qHead < qTail) {
          const curr = queue[qHead++];
          const cx = curr % w;
          const cy = Math.floor(curr / w);
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
              queue[qTail++] = n;
            }
          }
          if (cx < w - 1) {
            const n = curr + 1;
            if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
              visited[n] = 1;
              queue[qTail++] = n;
            }
          }
          if (cy > 0) {
            const n = curr - w;
            if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
              visited[n] = 1;
              queue[qTail++] = n;
            }
          }
          if (cy < h - 1) {
            const n = curr + w;
            if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
              visited[n] = 1;
              queue[qTail++] = n;
            }
          }
        }

        // 3. Inner center window flood-fill (for frames/borders where photo slot goes inside)
        const midX = Math.floor(w / 2);
        const midY = Math.floor(h / 2);
        const midIdx = midY * w + midX;
        if (!visited[midIdx] && colorDist(midIdx * 4) <= tolerance) {
          const innerQueue = new Int32Array(totalPixels);
          let iHead = 0;
          let iTail = 0;

          visited[midIdx] = 1;
          innerQueue[iTail++] = midIdx;

          while (iHead < iTail) {
            const curr = innerQueue[iHead++];
            const cx = curr % w;
            const cy = Math.floor(curr / w);
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
            if (cx < w - 1) {
              const n = curr + 1;
              if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
                visited[n] = 1;
                innerQueue[iTail++] = n;
              }
            }
            if (cy > 0) {
              const n = curr - w;
              if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
                visited[n] = 1;
                innerQueue[iTail++] = n;
              }
            }
            if (cy < h - 1) {
              const n = curr + w;
              if (!visited[n] && colorDist(n * 4) <= tolerance + feather) {
                visited[n] = 1;
                innerQueue[iTail++] = n;
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };

    img.onerror = (e) => reject(new Error('Failed to load image for background removal'));
    img.src = imageUrlOrDataUrl;
  });
}
