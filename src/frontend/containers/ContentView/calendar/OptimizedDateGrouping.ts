/**
 * Optimized date grouping algorithm for large datasets
 */

import { ClientFile } from '../../../entities/File';
import { MonthGroup } from './types';
import {
  formatMonthYear,
  createMonthGroupId,
  getSafeDateForGrouping,
  extractMonthYear,
} from './dateUtils';

export interface GroupingConfig {
  /** Batch size for processing files */
  batchSize: number;
  /** Enable parallel processing using Web Workers */
  useWebWorkers: boolean;
  /** Maximum number of worker threads */
  maxWorkers: number;
  /** Enable incremental grouping for very large collections */
  incrementalGrouping: boolean;
  /** Yield control to UI every N files processed */
  yieldInterval: number;
  /** Use date caching for improved performance */
  useDateCache: boolean;
  /** Use adaptive chunk sizing for very large collections */
  useAdaptiveChunks: boolean;
}

export const DEFAULT_GROUPING_CONFIG: GroupingConfig = {
  batchSize: 2000,
  useWebWorkers: false, // Disabled by default due to complexity
  maxWorkers: 4,
  incrementalGrouping: true,
  yieldInterval: 1000,
  useDateCache: true,
  useAdaptiveChunks: true,
};

export interface GroupingProgress {
  processed: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
  estimatedTimeRemaining: number; // in milliseconds
}

export interface GroupingResult {
  monthGroups: MonthGroup[];
  processingTime: number;
  memoryUsage: number;
  statistics: {
    totalFiles: number;
    validDates: number;
    invalidDates: number;
    monthGroupsCreated: number;
    averagePhotosPerGroup: number;
    cachingEfficiency?: number; // Percentage of cache hits
  };
}

/**
 * Optimized date grouping engine for large collections
 */
export class OptimizedDateGroupingEngine {
  private config: GroupingConfig;
  private abortController?: AbortController;
  private dateCache: Map<
    string,
    { monthYear: { month: number; year: number } | null; groupId: string | null }
  >;

  constructor(config: Partial<GroupingConfig> = {}) {
    this.config = { ...DEFAULT_GROUPING_CONFIG, ...config };
    this.dateCache = new Map();
  }

  /**
   * Group files by month with optimizations for large datasets
   */
  async groupFilesByMonth(
    files: ClientFile[],
    onProgress?: (progress: GroupingProgress) => void,
    signal?: AbortSignal,
  ): Promise<GroupingResult> {
    const startTime = performance.now();
    const totalFiles = files.length;

    // Create abort controller if not provided
    this.abortController = signal ? undefined : new AbortController();
    const effectiveSignal = signal || this.abortController?.signal;

    try {
      // Choose grouping strategy based on collection size
      let result: GroupingResult;

      if (totalFiles <= 1000) {
        // Small collections: use synchronous grouping
        result = await this.synchronousGrouping(files, onProgress, effectiveSignal);
      } else if (totalFiles <= 10000) {
        // Medium collections: use batched grouping
        result = await this.batchedGrouping(files, onProgress, effectiveSignal);
      } else {
        // Large collections: use incremental grouping
        result = await this.incrementalGrouping(files, onProgress, effectiveSignal);
      }

      const endTime = performance.now();
      result.processingTime = endTime - startTime;

      // Clear date cache to free memory
      const cacheSize = this.dateCache.size;
      this.dateCache.clear();

      // Add caching efficiency to statistics if cache was used
      if (cacheSize > 0) {
        result.statistics.cachingEfficiency = Math.min(100, (cacheSize / totalFiles) * 100);
      }

      return result;
    } catch (error) {
      if (effectiveSignal?.aborted) {
        throw new Error('Date grouping was cancelled');
      }
      throw error;
    }
  }

  /**
   * Synchronous grouping for small collections
   */
  private async synchronousGrouping(
    files: ClientFile[],
    onProgress?: (progress: GroupingProgress) => void,
    signal?: AbortSignal,
  ): Promise<GroupingResult> {
    const groupMap = new Map<string, ClientFile[]>();
    const unknownDateFiles: ClientFile[] = [];
    let validDates = 0;
    let invalidDates = 0;

    for (let i = 0; i < files.length; i++) {
      if (signal?.aborted) {
        throw new Error('Operation cancelled');
      }

      const file = files[i];
      const safeDate = getSafeDateForGrouping(file);
      const monthYear = safeDate ? extractMonthYear(safeDate) : null;

      if (monthYear === null) {
        unknownDateFiles.push(file);
        invalidDates++;
      } else {
        const groupId = createMonthGroupId(monthYear.month, monthYear.year);
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, []);
        }
        const group = groupMap.get(groupId);
        if (group) {
          group.push(file);
        }
        validDates++;
      }

      // Report progress
      if (onProgress && i % 100 === 0) {
        onProgress({
          processed: i + 1,
          total: files.length,
          currentBatch: 1,
          totalBatches: 1,
          estimatedTimeRemaining: 0,
        });
      }
    }

    const monthGroups = this.convertMapToGroups(groupMap, unknownDateFiles);

    return {
      monthGroups,
      processingTime: 0, // Will be set by caller
      memoryUsage: this.estimateMemoryUsage(monthGroups),
      statistics: {
        totalFiles: files.length,
        validDates,
        invalidDates,
        monthGroupsCreated: monthGroups.length,
        averagePhotosPerGroup:
          monthGroups.length > 0 ? Math.round(files.length / monthGroups.length) : 0,
      },
    };
  }

  /**
   * Batched grouping for medium collections
   */
  private async batchedGrouping(
    files: ClientFile[],
    onProgress?: (progress: GroupingProgress) => void,
    signal?: AbortSignal,
  ): Promise<GroupingResult> {
    const groupMap = new Map<string, ClientFile[]>();
    const unknownDateFiles: ClientFile[] = [];
    let validDates = 0;
    let invalidDates = 0;
    let cacheHits = 0;

    const batchSize = this.config.batchSize;
    const totalBatches = Math.ceil(files.length / batchSize);
    const startTime = performance.now();

    // Use date caching for improved performance
    const useCache = this.config.useDateCache && files.length > 2000;

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      if (signal?.aborted) {
        throw new Error('Operation cancelled');
      }

      const batchStart = batchIndex * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, files.length);
      const batch = files.slice(batchStart, batchEnd);

      // Process batch
      for (const file of batch) {
        let monthYear = null;
        let groupId = null;

        // Try to get date from cache
        if (useCache && file.dateCreated) {
          const dateKey = file.dateCreated.toString();
          const cachedDate = this.dateCache.get(dateKey);

          if (cachedDate) {
            monthYear = cachedDate.monthYear;
            groupId = cachedDate.groupId;
            cacheHits++;
          } else {
            // Calculate and cache the date
            const safeDate = getSafeDateForGrouping(file);
            monthYear = safeDate ? extractMonthYear(safeDate) : null;
            groupId = monthYear ? createMonthGroupId(monthYear.month, monthYear.year) : null;

            this.dateCache.set(dateKey, { monthYear, groupId });
          }
        } else {
          // Standard date processing
          const safeDate = getSafeDateForGrouping(file);
          monthYear = safeDate ? extractMonthYear(safeDate) : null;
          groupId = monthYear ? createMonthGroupId(monthYear.month, monthYear.year) : null;
        }

        if (!groupId) {
          unknownDateFiles.push(file);
          invalidDates++;
        } else {
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, []);
          }
          const group = groupMap.get(groupId);
          if (group) {
            group.push(file);
          }
          validDates++;
        }
      }

      // Yield control to UI
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Report progress
      if (onProgress) {
        const processed = batchEnd;
        const elapsed = performance.now() - startTime;
        const estimatedTotal = (elapsed / processed) * files.length;
        const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

        onProgress({
          processed,
          total: files.length,
          currentBatch: batchIndex + 1,
          totalBatches,
          estimatedTimeRemaining: estimatedRemaining,
        });
      }
    }

    const monthGroups = this.convertMapToGroups(groupMap, unknownDateFiles);

    return {
      monthGroups,
      processingTime: 0, // Will be set by caller
      memoryUsage: this.estimateMemoryUsage(monthGroups),
      statistics: {
        totalFiles: files.length,
        validDates,
        invalidDates,
        monthGroupsCreated: monthGroups.length,
        averagePhotosPerGroup:
          monthGroups.length > 0 ? Math.round(files.length / monthGroups.length) : 0,
        cachingEfficiency: useCache ? (cacheHits / files.length) * 100 : undefined,
      },
    };
  }

  /**
   * Incremental grouping for very large collections
   */
  private async incrementalGrouping(
    files: ClientFile[],
    onProgress?: (progress: GroupingProgress) => void,
    signal?: AbortSignal,
  ): Promise<GroupingResult> {
    const groupMap = new Map<string, ClientFile[]>();
    const unknownDateFiles: ClientFile[] = [];
    let validDates = 0;
    let invalidDates = 0;
    let cacheHits = 0;

    const startTime = performance.now();

    // Use adaptive chunk sizing for very large collections
    const useAdaptiveChunks = this.config.useAdaptiveChunks && files.length > 20000;
    const baseChunkSize = useAdaptiveChunks
      ? Math.min(1000, Math.max(200, Math.floor(files.length / 50)))
      : this.config.yieldInterval;

    // For extremely large collections, use larger chunks to reduce overhead
    const chunkSize = files.length > 50000 ? baseChunkSize * 2 : baseChunkSize;
    const chunks = Math.ceil(files.length / chunkSize);

    // Use date caching for improved performance
    const useCache = this.config.useDateCache;

    for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex++) {
      if (signal?.aborted) {
        throw new Error('Operation cancelled');
      }

      const chunkStart = chunkIndex * chunkSize;
      const chunkEnd = Math.min(chunkStart + chunkSize, files.length);
      const chunk = files.slice(chunkStart, chunkEnd);

      // Process each file in the chunk
      for (let i = 0; i < chunk.length; i++) {
        const file = chunk[i];

        try {
          let monthYear = null;
          let groupId = null;

          // Try to get date from cache
          if (useCache && file.dateCreated) {
            const dateKey = file.dateCreated.toString();
            const cachedDate = this.dateCache.get(dateKey);

            if (cachedDate) {
              monthYear = cachedDate.monthYear;
              groupId = cachedDate.groupId;
              cacheHits++;
            } else {
              // Calculate and cache the date
              const safeDate = getSafeDateForGrouping(file);
              monthYear = safeDate ? extractMonthYear(safeDate) : null;
              groupId = monthYear ? createMonthGroupId(monthYear.month, monthYear.year) : null;

              this.dateCache.set(dateKey, { monthYear, groupId });
            }
          } else {
            // Standard date processing
            const safeDate = getSafeDateForGrouping(file);
            monthYear = safeDate ? extractMonthYear(safeDate) : null;
            groupId = monthYear ? createMonthGroupId(monthYear.month, monthYear.year) : null;
          }

          if (!groupId) {
            unknownDateFiles.push(file);
            invalidDates++;
          } else {
            if (!groupMap.has(groupId)) {
              groupMap.set(groupId, []);
            }
            const group = groupMap.get(groupId);
            if (group) {
              group.push(file);
            }
            validDates++;
          }
        } catch (error) {
          console.warn('Error processing file in incremental grouping:', file.name, error);
          unknownDateFiles.push(file);
          invalidDates++;
        }
      }

      // Yield control to UI after each chunk
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Report progress
      if (onProgress) {
        const processed = chunkEnd;
        const elapsed = performance.now() - startTime;
        const estimatedTotal = (elapsed / processed) * files.length;
        const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);

        onProgress({
          processed,
          total: files.length,
          currentBatch: chunkIndex + 1,
          totalBatches: chunks,
          estimatedTimeRemaining: estimatedRemaining,
        });
      }

      // For very large collections, periodically clear the cache to prevent memory issues
      if (useCache && files.length > 100000 && chunkIndex % 10 === 9) {
        this.dateCache.clear();
      }
    }

    const monthGroups = this.convertMapToGroups(groupMap, unknownDateFiles);

    return {
      monthGroups,
      processingTime: 0, // Will be set by caller
      memoryUsage: this.estimateMemoryUsage(monthGroups),
      statistics: {
        totalFiles: files.length,
        validDates,
        invalidDates,
        monthGroupsCreated: monthGroups.length,
        averagePhotosPerGroup:
          monthGroups.length > 0 ? Math.round(files.length / monthGroups.length) : 0,
        cachingEfficiency: useCache ? (cacheHits / files.length) * 100 : undefined,
      },
    };
  }

  /**
   * Convert group map to MonthGroup array
   */
  private convertMapToGroups(
    groupMap: Map<string, ClientFile[]>,
    unknownDateFiles: ClientFile[],
  ): MonthGroup[] {
    const monthGroups: MonthGroup[] = [];

    // Convert map entries to month groups
    for (const [groupId, groupFiles] of groupMap.entries()) {
      const [yearStr, monthStr] = groupId.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1; // Convert back to 0-11

      // Sort files within group by date
      const sortedFiles = groupFiles.sort((a, b) => {
        const dateA = getSafeDateForGrouping(a) || new Date(0);
        const dateB = getSafeDateForGrouping(b) || new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

      monthGroups.push({
        year,
        month,
        photos: sortedFiles,
        displayName: formatMonthYear(month, year),
        id: groupId,
      });
    }

    // Add unknown date group if needed
    if (unknownDateFiles.length > 0) {
      const sortedUnknownFiles = unknownDateFiles.sort((a, b) => {
        const nameComparison = a.name.localeCompare(b.name);
        if (nameComparison !== 0) {
          return nameComparison;
        }
        return (a.size || 0) - (b.size || 0);
      });

      monthGroups.push({
        year: 0,
        month: 0,
        photos: sortedUnknownFiles,
        displayName: 'Unknown Date',
        id: 'unknown-date',
      });
    }

    // Sort month groups by date (newest first)
    monthGroups.sort((a, b) => {
      if (a.id === 'unknown-date') {
        return 1;
      }
      if (b.id === 'unknown-date') {
        return -1;
      }

      if (a.year !== b.year) {
        return b.year - a.year;
      }
      return b.month - a.month;
    });

    return monthGroups;
  }

  /**
   * Estimate memory usage of month groups
   */
  private estimateMemoryUsage(monthGroups: MonthGroup[]): number {
    // Rough estimate: each file reference + group overhead
    const totalFiles = monthGroups.reduce((sum, group) => sum + group.photos.length, 0);
    const fileReferenceSize = 8; // bytes per reference
    const groupOverhead = 200; // bytes per group

    return totalFiles * fileReferenceSize + monthGroups.length * groupOverhead;
  }

  /**
   * Cancel ongoing grouping operation
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GroupingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Clear date cache to free memory
   */
  clearCache(): void {
    this.dateCache.clear();
  }
}

/**
 * Factory function to create optimized grouping engine with smart defaults
 */
export function createOptimizedGroupingEngine(fileCount: number): OptimizedDateGroupingEngine {
  const config: Partial<GroupingConfig> = {};

  // Adjust configuration based on collection size
  if (fileCount > 100000) {
    // Extremely large collections
    config.batchSize = 5000;
    config.yieldInterval = 2500;
    config.useAdaptiveChunks = true;
    config.useDateCache = true;
  } else if (fileCount > 50000) {
    // Very large collections
    config.batchSize = 4000;
    config.yieldInterval = 2000;
    config.useAdaptiveChunks = true;
    config.useDateCache = true;
  } else if (fileCount > 20000) {
    // Large collections
    config.batchSize = 3000;
    config.yieldInterval = 1500;
    config.useAdaptiveChunks = true;
    config.useDateCache = true;
  } else if (fileCount > 5000) {
    // Medium-large collections
    config.batchSize = 2000;
    config.yieldInterval = 1000;
    config.useDateCache = true;
  }

  return new OptimizedDateGroupingEngine(config);
}
