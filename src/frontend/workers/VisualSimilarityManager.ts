import type {
  VisualSimilarityMessage,
  VisualSimilarityResponse,
  ProcessThumbnailsData,
  CompareHashesData,
} from './visualSimilarity.worker';
import type { VisualHashDTO, VisualHashCache } from '../../api/visual-hash';
import type { ClientFile } from '../entities/File';

interface ProgressCallback {
  (data: {
    phase: 'processing' | 'comparing';
    progress: number;
    processed?: number;
    total?: number;
    found?: number;
    comparisons?: number;
    totalComparisons?: number;
  }): void;
}

interface VisualSimilarityResult {
  groups: Array<{
    files: string[];
    similarity: number;
  }>;
  processedFiles: number;
  totalComparisons: number;
  processingTime: number;
}

export class VisualSimilarityManager {
  private worker: Worker | null = null;
  private isProcessing = false;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    try {
      // Import the worker
      this.worker = new Worker(new URL('./visualSimilarity.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch (error) {
      console.error('Failed to create visual similarity worker:', error);
      this.worker = null;
    }
  }

  async analyzeVisualSimilarity(
    files: Array<{
      id: string;
      thumbnailPath: string;
      name: string;
      extension: string;
    }>,
    threshold: number,
    onProgress?: ProgressCallback,
  ): Promise<VisualSimilarityResult> {
    if (!this.worker) {
      throw new Error('Visual similarity worker not available');
    }

    if (this.isProcessing) {
      throw new Error('Analysis already in progress');
    }

    this.isProcessing = true;
    const startTime = Date.now();
    let totalComparisons = 0;

    try {
      // Step 1: Process thumbnails to generate hashes
      console.log('🚀 Starting enhanced visual similarity analysis...');

      const hashes = await new Promise<Array<{ fileId: string; hash: string }>>(
        (resolve, reject) => {
          const handleMessage = (event: MessageEvent<VisualSimilarityResponse>) => {
            const { type, data } = event.data;

            switch (type) {
              case 'PROGRESS':
                if (data.phase === 'processing') {
                  onProgress?.(data);
                }
                break;

              case 'THUMBNAILS_COMPLETE':
                this.worker!.removeEventListener('message', handleMessage);
                resolve(data.hashes);
                break;

              case 'ERROR':
                this.worker!.removeEventListener('message', handleMessage);
                reject(new Error(data.error));
                break;
            }
          };

          this.worker!.addEventListener('message', handleMessage);

          // Send thumbnails for processing
          const message: VisualSimilarityMessage = {
            type: 'PROCESS_THUMBNAILS',
            data: {
              files,
              batchSize: 50, // Process in batches of 50
            } as ProcessThumbnailsData,
          };

          this.worker!.postMessage(message);
        },
      );

      console.log(`✅ Generated ${hashes.length} perceptual hashes`);

      // Step 2: Compare hashes to find similar groups
      const groups = await new Promise<Array<{ files: string[]; similarity: number }>>(
        (resolve, reject) => {
          const handleMessage = (event: MessageEvent<VisualSimilarityResponse>) => {
            const { type, data } = event.data;

            switch (type) {
              case 'PROGRESS':
                if (data.phase === 'comparing') {
                  totalComparisons = data.totalComparisons || 0;
                  onProgress?.(data);
                }
                break;

              case 'COMPARISON_COMPLETE':
                this.worker!.removeEventListener('message', handleMessage);
                resolve(data.groups);
                break;

              case 'ERROR':
                this.worker!.removeEventListener('message', handleMessage);
                reject(new Error(data.error));
                break;
            }
          };

          this.worker!.addEventListener('message', handleMessage);

          // Send hashes for comparison
          const message: VisualSimilarityMessage = {
            type: 'COMPARE_HASHES',
            data: {
              hashes,
              threshold,
            } as CompareHashesData,
          };

          this.worker!.postMessage(message);
        },
      );

      const processingTime = Date.now() - startTime;
      console.log(`✅ Found ${groups.length} visual duplicate groups in ${processingTime}ms`);

      return {
        groups,
        processedFiles: files.length,
        totalComparisons,
        processingTime,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  isWorkerAvailable(): boolean {
    return this.worker !== null;
  }

  isAnalyzing(): boolean {
    return this.isProcessing;
  }

  /**
   * Analyze visual similarity with cache integration
   * @param files - Array of ClientFile objects with file metadata
   * @param threshold - Similarity threshold percentage
   * @param onProgress - Progress callback
   * @param cacheManager - Optional cache manager for persistent storage
   */
  async analyzeVisualSimilarityWithCache(
    files: ClientFile[],
    threshold: number,
    onProgress?: ProgressCallback,
    cacheManager?: {
      fetchCachedHashes: (paths: string[]) => Promise<VisualHashCache[]>;
      saveCachedHashes: (hashes: VisualHashDTO[]) => Promise<void>;
    },
  ): Promise<VisualSimilarityResult> {
    if (!this.worker) {
      throw new Error('Visual similarity worker not available');
    }

    if (this.isProcessing) {
      throw new Error('Analysis already in progress');
    }

    this.isProcessing = true;
    const startTime = Date.now();
    let totalComparisons = 0;

    try {
      // Step 1: Check cache for existing hashes
      const cachedHashes: Map<string, string> = new Map();
      const filesToProcess: Array<{
        id: string;
        thumbnailPath: string;
        name: string;
        extension: string;
        absolutePath: string;
        fileSize: number;
        dateModified: Date;
      }> = [];

      if (cacheManager) {
        console.log('🗄️ Checking cache for existing hashes...');
        const filePaths = files.map((f) => f.absolutePath);
        const cached = await cacheManager.fetchCachedHashes(filePaths);

        // Build cache map
        for (const cache of cached) {
          if (cache.isValid) {
            cachedHashes.set(cache.absolutePath, cache.hash);
          }
        }

        console.log(`📋 Found ${cachedHashes.size} cached hashes out of ${files.length} files`);
      }

      // Prepare files that need processing (not in cache or cache invalid)
      for (const file of files) {
        if (
          !file.thumbnailPath ||
          ['gif', 'mp4', 'webm', 'mov'].includes(file.extension.toLowerCase())
        ) {
          continue;
        }

        if (!cachedHashes.has(file.absolutePath)) {
          filesToProcess.push({
            id: file.id,
            thumbnailPath: file.thumbnailPath,
            name: file.name,
            extension: file.extension,
            absolutePath: file.absolutePath,
            fileSize: file.size,
            dateModified: file.dateModified,
          });
        }
      }

      console.log(
        `🔍 Processing ${filesToProcess.length} new files, using ${cachedHashes.size} cached hashes`,
      );

      // Step 2: Process uncached files
      let newHashes: Array<{
        fileId: string;
        hash: string;
        absolutePath: string;
        fileSize: number;
        dateModified: Date;
      }> = [];

      if (filesToProcess.length > 0) {
        const result = await new Promise<Array<{ fileId: string; hash: string }>>(
          (resolve, reject) => {
            const handleMessage = (event: MessageEvent<VisualSimilarityResponse>) => {
              const { type, data } = event.data;

              switch (type) {
                case 'PROGRESS':
                  if (data.phase === 'processing') {
                    onProgress?.(data);
                  }
                  break;

                case 'THUMBNAILS_COMPLETE':
                  this.worker!.removeEventListener('message', handleMessage);
                  resolve(data.hashes);
                  break;

                case 'ERROR':
                  this.worker!.removeEventListener('message', handleMessage);
                  reject(new Error(data.error));
                  break;
              }
            };

            this.worker!.addEventListener('message', handleMessage);

            const message: VisualSimilarityMessage = {
              type: 'PROCESS_THUMBNAILS',
              data: {
                files: filesToProcess,
                batchSize: 50,
              } as ProcessThumbnailsData,
            };

            this.worker!.postMessage(message);
          },
        );

        // Prepare new hashes for caching
        newHashes = result.map((r) => {
          const fileData = filesToProcess.find((f) => f.id === r.fileId)!;
          return {
            fileId: r.fileId,
            hash: r.hash,
            absolutePath: fileData.absolutePath,
            fileSize: fileData.fileSize,
            dateModified: fileData.dateModified,
          };
        });

        // Save new hashes to cache
        if (cacheManager && newHashes.length > 0) {
          const hashesToSave: VisualHashDTO[] = newHashes.map((h) => ({
            absolutePath: h.absolutePath,
            fileSize: h.fileSize,
            dateModified: h.dateModified,
            hashType: 'dctHash',
            hash: h.hash,
            dateComputed: new Date(),
          }));

          await cacheManager.saveCachedHashes(hashesToSave);
          console.log(`💾 Saved ${hashesToSave.length} new hashes to cache`);
        }
      }

      // Step 3: Combine cached and new hashes
      const allHashes: Array<{ fileId: string; hash: string }> = [];

      // Add cached hashes
      for (const file of files) {
        const cachedHash = cachedHashes.get(file.absolutePath);
        if (cachedHash) {
          allHashes.push({ fileId: file.id, hash: cachedHash });
        }
      }

      // Add new hashes
      allHashes.push(...newHashes.map((h) => ({ fileId: h.fileId, hash: h.hash })));

      console.log(
        `✅ Total hashes for comparison: ${allHashes.length} (${cachedHashes.size} cached + ${newHashes.length} new)`,
      );

      // Step 4: Compare all hashes
      const groups = await new Promise<Array<{ files: string[]; similarity: number }>>(
        (resolve, reject) => {
          const handleMessage = (event: MessageEvent<VisualSimilarityResponse>) => {
            const { type, data } = event.data;

            switch (type) {
              case 'PROGRESS':
                if (data.phase === 'comparing') {
                  totalComparisons = data.totalComparisons || 0;
                  onProgress?.(data);
                }
                break;

              case 'COMPARISON_COMPLETE':
                this.worker!.removeEventListener('message', handleMessage);
                resolve(data.groups);
                break;

              case 'ERROR':
                this.worker!.removeEventListener('message', handleMessage);
                reject(new Error(data.error));
                break;
            }
          };

          this.worker!.addEventListener('message', handleMessage);

          const message: VisualSimilarityMessage = {
            type: 'COMPARE_HASHES',
            data: {
              hashes: allHashes,
              threshold,
            } as CompareHashesData,
          };

          this.worker!.postMessage(message);
        },
      );

      const processingTime = Date.now() - startTime;
      console.log(
        `✅ Enhanced cached analysis complete: ${groups.length} groups found in ${processingTime}ms`,
      );

      return {
        groups,
        processedFiles: allHashes.length,
        totalComparisons,
        processingTime,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isProcessing = false;
  }
}

// Singleton instance for the app
export const visualSimilarityManager = new VisualSimilarityManager();
