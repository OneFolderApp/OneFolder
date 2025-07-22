/**
 * Memory management for thumbnail resources in virtualized calendar environment
 */

import { ClientFile } from '../../../entities/File';

export interface MemoryManagerConfig {
  /** Maximum number of thumbnails to keep in memory */
  maxThumbnailCache: number;
  /** Maximum memory usage in MB before cleanup */
  maxMemoryUsage: number;
  /** Cleanup threshold as percentage of max cache size */
  cleanupThreshold: number;
  /** Enable aggressive cleanup for very large collections */
  aggressiveCleanup: boolean;
  /** Prioritize visible thumbnails in memory */
  prioritizeVisible: boolean;
  /** Preload adjacent thumbnails for smoother scrolling */
  preloadAdjacent: boolean;
  /** Maximum number of thumbnails to preload */
  maxPreloadCount: number;
}

export const DEFAULT_MEMORY_CONFIG: MemoryManagerConfig = {
  maxThumbnailCache: 1000,
  maxMemoryUsage: 200, // 200MB
  cleanupThreshold: 0.8, // Cleanup when 80% full
  aggressiveCleanup: false,
  prioritizeVisible: true,
  preloadAdjacent: true,
  maxPreloadCount: 50,
};

export interface ThumbnailCacheEntry {
  fileId: string;
  imageElement: HTMLImageElement;
  lastAccessed: number;
  memorySize: number; // Estimated size in bytes
  isVisible: boolean;
}

/**
 * Memory manager for calendar view thumbnail resources
 */
export class CalendarMemoryManager {
  private config: MemoryManagerConfig;
  private thumbnailCache = new Map<string, ThumbnailCacheEntry>();
  private accessOrder: string[] = []; // LRU tracking
  private totalMemoryUsage: number = 0;
  private cleanupInProgress: boolean = false;
  private memoryPressureCallbacks: Array<() => void> = [];

  constructor(config: Partial<MemoryManagerConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.setupMemoryPressureHandling();
  }

  /**
   * Setup memory pressure handling if available
   */
  private setupMemoryPressureHandling(): void {
    // Listen for memory pressure events if available (Chrome)
    if ('memory' in performance && 'addEventListener' in performance) {
      try {
        (performance as any).addEventListener('memorypressure', () => {
          console.warn('Memory pressure detected, triggering aggressive cleanup');
          this.performAggressiveCleanup();
        });
      } catch (error) {
        // Memory pressure API not available
      }
    }

    // Fallback: periodic memory check
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Add or update a thumbnail in the cache
   */
  cacheThumbnail(
    file: ClientFile,
    imageElement: HTMLImageElement,
    isVisible: boolean = false,
  ): void {
    const fileId = file.id;
    const memorySize = this.estimateImageMemorySize(imageElement);

    // Remove existing entry if present
    if (this.thumbnailCache.has(fileId)) {
      this.removeThumbnailFromCache(fileId);
    }

    // Check if we need cleanup before adding
    if (this.shouldTriggerCleanup()) {
      this.performCleanup();
    }

    // Add new entry
    const entry: ThumbnailCacheEntry = {
      fileId,
      imageElement,
      lastAccessed: Date.now(),
      memorySize,
      isVisible,
    };

    this.thumbnailCache.set(fileId, entry);
    this.accessOrder.push(fileId);
    this.totalMemoryUsage += memorySize;

    // Update access order
    this.updateAccessOrder(fileId);
  }

  /**
   * Get a thumbnail from cache
   */
  getThumbnail(fileId: string): HTMLImageElement | null {
    const entry = this.thumbnailCache.get(fileId);
    if (entry) {
      entry.lastAccessed = Date.now();
      this.updateAccessOrder(fileId);
      return entry.imageElement;
    }
    return null;
  }

  /**
   * Mark thumbnails as visible or not visible
   */
  updateVisibility(visibleFileIds: string[], allFileIds: string[]): void {
    const visibleSet = new Set(visibleFileIds);

    // Update visibility status
    for (const [fileId, entry] of this.thumbnailCache) {
      const wasVisible = entry.isVisible;
      entry.isVisible = visibleSet.has(fileId);

      // Update access time for newly visible items
      if (!wasVisible && entry.isVisible) {
        entry.lastAccessed = Date.now();
        this.updateAccessOrder(fileId);
      }
    }

    // Remove thumbnails that are no longer in the file list
    const allFileIdSet = new Set(allFileIds);
    const toRemove: string[] = [];
    for (const fileId of this.thumbnailCache.keys()) {
      if (!allFileIdSet.has(fileId)) {
        toRemove.push(fileId);
      }
    }
    toRemove.forEach((fileId) => this.removeThumbnailFromCache(fileId));

    // Trigger cleanup if needed
    if (this.shouldTriggerCleanup()) {
      this.performCleanup();
    }
  }

  /**
   * Remove a thumbnail from cache
   */
  private removeThumbnailFromCache(fileId: string): void {
    const entry = this.thumbnailCache.get(fileId);
    if (entry) {
      this.totalMemoryUsage -= entry.memorySize;
      this.thumbnailCache.delete(fileId);

      // Remove from access order
      const index = this.accessOrder.indexOf(fileId);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }

      // Clean up image element
      if (entry.imageElement.src && entry.imageElement.src.startsWith('blob:')) {
        URL.revokeObjectURL(entry.imageElement.src);
      }
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(fileId: string): void {
    const index = this.accessOrder.indexOf(fileId);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(fileId);
  }

  /**
   * Check if cleanup should be triggered
   */
  private shouldTriggerCleanup(): boolean {
    const cacheThreshold = this.config.maxThumbnailCache * this.config.cleanupThreshold;
    const memoryThreshold = this.config.maxMemoryUsage * 1024 * 1024 * this.config.cleanupThreshold; // Convert MB to bytes

    return this.thumbnailCache.size > cacheThreshold || this.totalMemoryUsage > memoryThreshold;
  }

  /**
   * Perform cleanup of least recently used thumbnails
   */
  private performCleanup(): void {
    if (this.cleanupInProgress) {
      return;
    }

    this.cleanupInProgress = true;

    try {
      const targetCacheSize = Math.floor(this.config.maxThumbnailCache * 0.7); // Clean to 70% of max
      const targetMemorySize = this.config.maxMemoryUsage * 1024 * 1024 * 0.7; // 70% of max memory

      let removedCount = 0;
      let removedMemory = 0;

      // Remove LRU items that are not currently visible
      while (
        (this.thumbnailCache.size > targetCacheSize || this.totalMemoryUsage > targetMemorySize) &&
        this.accessOrder.length > 0
      ) {
        const oldestFileId = this.accessOrder[0];
        const entry = this.thumbnailCache.get(oldestFileId);

        if (entry && !entry.isVisible) {
          removedMemory += entry.memorySize;
          this.removeThumbnailFromCache(oldestFileId);
          removedCount++;
        } else {
          // Skip visible items, move to end of queue
          this.accessOrder.shift();
          if (entry) {
            this.accessOrder.push(oldestFileId);
          }
        }

        // Prevent infinite loop
        if (removedCount > 100) {
          break;
        }
      }

      if (removedCount > 0) {
        console.log(
          `Calendar memory cleanup: removed ${removedCount} thumbnails, freed ${(
            removedMemory /
            (1024 * 1024)
          ).toFixed(1)}MB`,
        );
      }
    } finally {
      this.cleanupInProgress = false;
    }
  }

  /**
   * Perform aggressive cleanup for memory pressure situations
   */
  private performAggressiveCleanup(): void {
    const initialSize = this.thumbnailCache.size;
    const initialMemory = this.totalMemoryUsage;

    // Remove all non-visible thumbnails
    const toRemove: string[] = [];
    for (const [fileId, entry] of this.thumbnailCache) {
      if (!entry.isVisible) {
        toRemove.push(fileId);
      }
    }

    toRemove.forEach((fileId) => this.removeThumbnailFromCache(fileId));

    // Notify callbacks about memory pressure
    this.memoryPressureCallbacks.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error('Error in memory pressure callback:', error);
      }
    });

    const removedCount = initialSize - this.thumbnailCache.size;
    const freedMemory = initialMemory - this.totalMemoryUsage;

    console.warn(
      `Aggressive memory cleanup: removed ${removedCount} thumbnails, freed ${(
        freedMemory /
        (1024 * 1024)
      ).toFixed(1)}MB`,
    );
  }

  /**
   * Check current memory usage and trigger cleanup if needed
   */
  private checkMemoryUsage(): void {
    if (this.shouldTriggerCleanup()) {
      this.performCleanup();
    }

    // Log memory stats periodically for large collections
    if (this.thumbnailCache.size > 500) {
      console.log(
        `Calendar memory usage: ${this.thumbnailCache.size} thumbnails, ${(
          this.totalMemoryUsage /
          (1024 * 1024)
        ).toFixed(1)}MB`,
      );
    }
  }

  /**
   * Estimate memory size of an image element
   */
  private estimateImageMemorySize(imageElement: HTMLImageElement): number {
    // Estimate based on image dimensions and color depth
    const width = imageElement.naturalWidth || imageElement.width || 160;
    const height = imageElement.naturalHeight || imageElement.height || 160;

    // Assume 4 bytes per pixel (RGBA) plus some overhead
    const pixelData = width * height * 4;
    const overhead = 1024; // 1KB overhead for DOM element and metadata

    return pixelData + overhead;
  }

  /**
   * Add callback for memory pressure events
   */
  onMemoryPressure(callback: () => void): void {
    this.memoryPressureCallbacks.push(callback);
  }

  /**
   * Remove memory pressure callback
   */
  offMemoryPressure(callback: () => void): void {
    const index = this.memoryPressureCallbacks.indexOf(callback);
    if (index > -1) {
      this.memoryPressureCallbacks.splice(index, 1);
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): {
    cacheSize: number;
    memoryUsage: number; // in MB
    memoryUsageBytes: number;
    visibleThumbnails: number;
    oldestAccess: number;
    newestAccess: number;
  } {
    let visibleCount = 0;
    let oldestAccess = Date.now();
    let newestAccess = 0;

    for (const entry of this.thumbnailCache.values()) {
      if (entry.isVisible) {
        visibleCount++;
      }
      oldestAccess = Math.min(oldestAccess, entry.lastAccessed);
      newestAccess = Math.max(newestAccess, entry.lastAccessed);
    }

    return {
      cacheSize: this.thumbnailCache.size,
      memoryUsage: this.totalMemoryUsage / (1024 * 1024),
      memoryUsageBytes: this.totalMemoryUsage,
      visibleThumbnails: visibleCount,
      oldestAccess,
      newestAccess,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MemoryManagerConfig>): void {
    this.config = { ...this.config, ...config };

    // Trigger cleanup if new limits are lower
    if (this.shouldTriggerCleanup()) {
      this.performCleanup();
    }
  }

  /**
   * Clear all cached thumbnails
   */
  clearCache(): void {
    for (const fileId of Array.from(this.thumbnailCache.keys())) {
      this.removeThumbnailFromCache(fileId);
    }
    this.accessOrder = [];
    this.totalMemoryUsage = 0;
  }

  /**
   * Dispose of the memory manager
   */
  dispose(): void {
    this.clearCache();
    this.memoryPressureCallbacks = [];
  }
}

/**
 * Global memory manager instance for calendar view
 */
export const calendarMemoryManager = new CalendarMemoryManager();
