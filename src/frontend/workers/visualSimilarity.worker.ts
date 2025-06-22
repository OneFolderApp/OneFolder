import fse from 'fs-extra';

// Interface for messages sent to the worker
interface VisualSimilarityMessage {
  type: 'PROCESS_THUMBNAILS' | 'COMPARE_HASHES';
  data: any;
}

interface ProcessThumbnailsData {
  files: Array<{
    id: string;
    thumbnailPath: string;
    name: string;
    extension: string;
  }>;
  batchSize?: number;
}

interface CompareHashesData {
  hashes: Array<{
    fileId: string;
    hash: string;
  }>;
  threshold: number;
}

// Interface for responses from the worker
interface VisualSimilarityResponse {
  type: 'PROGRESS' | 'THUMBNAILS_COMPLETE' | 'COMPARISON_COMPLETE' | 'ERROR';
  data: any;
}

// Enhanced perceptual hash using DCT (Discrete Cosine Transform) approach
// This is closer to a proper pHash implementation
class PerceptualHasher {
  private static DCT_SIZE = 32;
  private static HASH_SIZE = 8;

  // Simple 2D DCT implementation (optimized for our use case)
  private static dct2d(matrix: number[][]): number[][] {
    const N = matrix.length;
    const result: number[][] = Array(N)
      .fill(null)
      .map(() => Array(N).fill(0));

    for (let u = 0; u < N; u++) {
      for (let v = 0; v < N; v++) {
        let sum = 0;
        for (let x = 0; x < N; x++) {
          for (let y = 0; y < N; y++) {
            sum +=
              matrix[x][y] *
              Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
              Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
          }
        }
        const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
        const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
        result[u][v] = ((cu * cv) / 4) * sum;
      }
    }
    return result;
  }

  static async generateAdvancedHash(imageData: ImageData): Promise<string> {
    // Convert to grayscale and resize to DCT_SIZE x DCT_SIZE
    const grayscale = this.toGrayscaleMatrix(imageData);

    // Apply DCT
    const dctMatrix = this.dct2d(grayscale);

    // Keep only top-left HASH_SIZE x HASH_SIZE coefficients (low frequencies)
    const lowFreq: number[] = [];
    for (let i = 0; i < this.HASH_SIZE; i++) {
      for (let j = 0; j < this.HASH_SIZE; j++) {
        lowFreq.push(dctMatrix[i][j]);
      }
    }

    // Calculate median of low frequency coefficients
    const sorted = [...lowFreq].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // Generate binary hash based on whether each coefficient is above median
    let hash = '';
    for (const coeff of lowFreq) {
      hash += coeff > median ? '1' : '0';
    }

    return hash;
  }

  private static toGrayscaleMatrix(imageData: ImageData): number[][] {
    const { data, width, height } = imageData;
    const matrix: number[][] = [];

    // Resize to DCT_SIZE x DCT_SIZE while converting to grayscale
    for (let y = 0; y < this.DCT_SIZE; y++) {
      matrix[y] = [];
      for (let x = 0; x < this.DCT_SIZE; x++) {
        // Map DCT coordinates to original image coordinates
        const origX = Math.floor((x / this.DCT_SIZE) * width);
        const origY = Math.floor((y / this.DCT_SIZE) * height);
        const idx = (origY * width + origX) * 4;

        // Convert to grayscale using standard formula
        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
        matrix[y][x] = gray;
      }
    }

    return matrix;
  }
}

// Optimized thumbnail loading for worker context
async function loadThumbnailInWorker(thumbnailPath: string): Promise<ImageData | null> {
  try {
    // Remove ?v=1 suffix if present
    const cleanPath = thumbnailPath.split('?v=1')[0];

    // Check if file exists first
    if (!(await fse.pathExists(cleanPath))) {
      return null;
    }

    // Read file as buffer
    const buffer = await fse.readFile(cleanPath);
    const blob = new Blob([buffer]);

    // Create ImageBitmap (more efficient than Image in worker)
    const imageBitmap = await createImageBitmap(blob);

    // Create OffscreenCanvas for processing
    const canvas = new OffscreenCanvas(64, 64);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Draw and resize
    ctx.drawImage(imageBitmap, 0, 0, 64, 64);

    // Get ImageData
    return ctx.getImageData(0, 0, 64, 64);
  } catch (error) {
    console.warn('Worker: Failed to load thumbnail:', thumbnailPath, error);
    return null;
  }
}

// Calculate Hamming distance between two binary strings
function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    return Infinity;
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }

  return distance;
}

// Calculate similarity percentage
function calculateSimilarity(hash1: string, hash2: string): number {
  const distance = hammingDistance(hash1, hash2);
  if (distance === Infinity) {
    return 0;
  }

  const maxDistance = hash1.length;
  const similarity = ((maxDistance - distance) / maxDistance) * 100;
  return Math.round(similarity * 100) / 100;
}

// Process thumbnails in batches
async function processThumbnails(data: ProcessThumbnailsData): Promise<void> {
  const { files, batchSize = 50 } = data;
  const results: Array<{ fileId: string; hash: string }> = [];

  console.log(`Worker: Processing ${files.length} thumbnails in batches of ${batchSize}`);

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const batchResults: Array<{ fileId: string; hash: string }> = [];

    // Process batch in parallel
    const promises = batch.map(async (file) => {
      try {
        // Skip unsupported formats
        if (['gif', 'mp4', 'webm', 'mov'].includes(file.extension.toLowerCase())) {
          return null;
        }

        const imageData = await loadThumbnailInWorker(file.thumbnailPath);
        if (!imageData) {
          return null;
        }

        const hash = await PerceptualHasher.generateAdvancedHash(imageData);
        return { fileId: file.id, hash };
      } catch (error) {
        console.warn(`Worker: Failed to process ${file.name}:`, error);
        return null;
      }
    });

    const batchComplete = await Promise.all(promises);

    // Filter out failed results and add to batch results
    for (const result of batchComplete) {
      if (result) {
        batchResults.push(result);
      }
    }

    results.push(...batchResults);

    // Send progress update
    const progress = Math.min(100, Math.round(((i + batchSize) / files.length) * 100));
    self.postMessage({
      type: 'PROGRESS',
      data: {
        phase: 'processing',
        progress,
        processed: Math.min(i + batchSize, files.length),
        total: files.length,
        found: results.length,
      },
    } as VisualSimilarityResponse);
  }

  // Send final results
  self.postMessage({
    type: 'THUMBNAILS_COMPLETE',
    data: { hashes: results },
  } as VisualSimilarityResponse);
}

// Optimized hash comparison with early termination
async function compareHashes(data: CompareHashesData): Promise<void> {
  const { hashes, threshold } = data;
  const groups: Array<{ files: string[]; similarity: number }> = [];
  const processed = new Set<string>();

  console.log(`Worker: Comparing ${hashes.length} hashes with ${threshold}% threshold`);

  let comparisons = 0;
  const totalComparisons = (hashes.length * (hashes.length - 1)) / 2;

  for (let i = 0; i < hashes.length; i++) {
    if (processed.has(hashes[i].fileId)) {
      continue;
    }

    const similarHashes = [hashes[i]];
    processed.add(hashes[i].fileId);
    let maxSimilarity = 0;

    for (let j = i + 1; j < hashes.length; j++) {
      if (processed.has(hashes[j].fileId)) {
        continue;
      }

      const similarity = calculateSimilarity(hashes[i].hash, hashes[j].hash);
      comparisons++;

      // Progress reporting every 5000 comparisons
      if (comparisons % 5000 === 0) {
        self.postMessage({
          type: 'PROGRESS',
          data: {
            phase: 'comparing',
            progress: Math.round((comparisons / totalComparisons) * 100),
            comparisons,
            totalComparisons,
          },
        } as VisualSimilarityResponse);
      }

      if (similarity >= threshold) {
        similarHashes.push(hashes[j]);
        processed.add(hashes[j].fileId);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }
    }

    // Only create groups with multiple files
    if (similarHashes.length > 1) {
      groups.push({
        files: similarHashes.map((h) => h.fileId),
        similarity: maxSimilarity,
      });
    }
  }

  // Send final results
  self.postMessage({
    type: 'COMPARISON_COMPLETE',
    data: { groups },
  } as VisualSimilarityResponse);
}

// Worker message handler
self.addEventListener('message', async (event: MessageEvent<VisualSimilarityMessage>) => {
  const { type, data } = event.data;

  try {
    switch (type) {
      case 'PROCESS_THUMBNAILS':
        await processThumbnails(data as ProcessThumbnailsData);
        break;

      case 'COMPARE_HASHES':
        await compareHashes(data as CompareHashesData);
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({
      type: 'ERROR',
      data: { error: error instanceof Error ? error.message : String(error) },
    } as VisualSimilarityResponse);
  }
});

// Export types for main thread
export type {
  VisualSimilarityMessage,
  VisualSimilarityResponse,
  ProcessThumbnailsData,
  CompareHashesData,
};
