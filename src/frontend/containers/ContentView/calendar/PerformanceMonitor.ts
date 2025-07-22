/**
 * Performance monitoring and metrics collection for calendar view
 */

export interface PerformanceMetrics {
  /** Time taken for date grouping operation (ms) */
  dateGroupingTime: number;
  /** Time taken for layout calculation (ms) */
  layoutCalculationTime: number;
  /** Time taken for initial render (ms) */
  initialRenderTime: number;
  /** Number of photos processed */
  photoCount: number;
  /** Number of month groups created */
  monthGroupCount: number;
  /** Memory usage estimate (MB) */
  memoryUsageEstimate: number;
  /** Scroll performance metrics */
  scrollMetrics: {
    averageFrameTime: number;
    droppedFrames: number;
    totalScrollEvents: number;
    scrollFPS: number;
  };
  /** Virtualization efficiency */
  virtualizationMetrics: {
    visibleItemsCount: number;
    totalItemsCount: number;
    renderRatio: number;
    overscanEfficiency: number;
  };
  /** Progressive loading metrics */
  progressiveLoadingMetrics?: {
    totalBatches: number;
    averageBatchTime: number;
    totalTime: number;
    itemsPerSecond: number;
  };
}

export interface PerformanceThresholds {
  /** Maximum acceptable date grouping time (ms) */
  maxDateGroupingTime: number;
  /** Maximum acceptable layout calculation time (ms) */
  maxLayoutCalculationTime: number;
  /** Maximum acceptable initial render time (ms) */
  maxInitialRenderTime: number;
  /** Maximum acceptable memory usage (MB) */
  maxMemoryUsage: number;
  /** Maximum acceptable average frame time (ms) */
  maxAverageFrameTime: number;
}

export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  maxDateGroupingTime: 2000, // 2 seconds
  maxLayoutCalculationTime: 1000, // 1 second
  maxInitialRenderTime: 3000, // 3 seconds
  maxMemoryUsage: 500, // 500 MB
  maxAverageFrameTime: 16.67, // 60 FPS
};

/**
 * Performance monitor for calendar view operations
 */
export class CalendarPerformanceMonitor {
  private metrics: Partial<PerformanceMetrics> = {};
  private thresholds: PerformanceThresholds;
  private scrollFrameTimes: number[] = [];
  private lastScrollTime: number = 0;
  private scrollEventCount: number = 0;
  private performanceObserver?: PerformanceObserver;
  private batchTimes: number[] = [];
  private longTaskObserver?: PerformanceObserver;
  private longTaskCount: number = 0;

  constructor(thresholds: Partial<PerformanceThresholds> = {}) {
    this.thresholds = { ...DEFAULT_PERFORMANCE_THRESHOLDS, ...thresholds };
    this.initializePerformanceObserver();
    this.initializeLongTaskObserver();
  }

  /**
   * Initialize performance observer for frame timing
   */
  private initializePerformanceObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          for (const entry of entries) {
            if (entry.entryType === 'measure' && entry.name.startsWith('calendar-')) {
              this.recordMeasurement(entry.name, entry.duration);
            }
          }
        });
        this.performanceObserver.observe({ entryTypes: ['measure'] });
      } catch (error) {
        console.warn('Performance Observer not available:', error);
      }
    }
  }

  /**
   * Initialize long task observer for detecting UI jank
   */
  private initializeLongTaskObserver(): void {
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          this.longTaskCount += entries.length;
          
          // Log long tasks that might cause UI jank
          entries.forEach(entry => {
            if (entry.duration > 100) {
              console.warn(`Calendar view: Long task detected (${entry.duration.toFixed(1)}ms)`);
            }
          });
        });
        this.longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        // Long task observer not available
      }
    }
  }

  /**
   * Start timing an operation
   */
  startTiming(operation: string): void {
    if (typeof performance !== 'undefined') {
      performance.mark(`calendar-${operation}-start`);
    }
  }

  /**
   * End timing an operation and record the duration
   */
  endTiming(operation: string): number {
    if (typeof performance !== 'undefined') {
      const endMark = `calendar-${operation}-end`;
      const measureName = `calendar-${operation}`;
      
      performance.mark(endMark);
      performance.measure(measureName, `calendar-${operation}-start`, endMark);
      
      const measure = performance.getEntriesByName(measureName)[0];
      const duration = measure ? measure.duration : 0;
      
      this.recordMeasurement(operation, duration);
      return duration;
    }
    return 0;
  }

  /**
   * Record a measurement
   */
  private recordMeasurement(operation: string, duration: number): void {
    switch (operation) {
      case 'date-grouping':
        this.metrics.dateGroupingTime = duration;
        break;
      case 'layout-calculation':
        this.metrics.layoutCalculationTime = duration;
        break;
      case 'initial-render':
        this.metrics.initialRenderTime = duration;
        break;
      case 'batch-processing':
        this.batchTimes.push(duration);
        break;
    }
  }

  /**
   * Record scroll performance metrics
   */
  recordScrollEvent(): void {
    const now = performance.now();
    if (this.lastScrollTime > 0) {
      const frameTime = now - this.lastScrollTime;
      this.scrollFrameTimes.push(frameTime);
      
      // Keep only the last 100 frame times for rolling average
      if (this.scrollFrameTimes.length > 100) {
        this.scrollFrameTimes.shift();
      }
    }
    this.lastScrollTime = now;
    this.scrollEventCount++;
  }

  /**
   * Record virtualization metrics
   */
  recordVirtualizationMetrics(visibleItems: number, totalItems: number, overscanItems: number = 0): void {
    this.metrics.virtualizationMetrics = {
      visibleItemsCount: visibleItems,
      totalItemsCount: totalItems,
      renderRatio: totalItems > 0 ? visibleItems / totalItems : 0,
      overscanEfficiency: visibleItems > 0 ? overscanItems / visibleItems : 0,
    };
  }

  /**
   * Record progressive loading batch
   */
  recordProgressiveBatch(batchSize: number, batchTime: number): void {
    this.recordMeasurement('batch-processing', batchTime);
  }

  /**
   * Estimate memory usage based on photo count and thumbnail size
   */
  estimateMemoryUsage(photoCount: number, thumbnailSize: number): number {
    // Rough estimate: each thumbnail uses approximately thumbnailSize^2 * 4 bytes (RGBA)
    // Plus overhead for DOM elements and JavaScript objects
    const thumbnailMemory = (thumbnailSize * thumbnailSize * 4) / (1024 * 1024); // MB per thumbnail
    const domOverhead = 0.001; // ~1KB per DOM element
    const jsObjectOverhead = 0.0001; // ~100 bytes per JS object
    
    const totalMemory = photoCount * (thumbnailMemory + domOverhead + jsObjectOverhead);
    this.metrics.memoryUsageEstimate = totalMemory;
    
    return totalMemory;
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): PerformanceMetrics {
    // Calculate scroll metrics
    const scrollMetrics = {
      averageFrameTime: this.scrollFrameTimes.length > 0 
        ? this.scrollFrameTimes.reduce((sum, time) => sum + time, 0) / this.scrollFrameTimes.length
        : 0,
      droppedFrames: this.scrollFrameTimes.filter(time => time > 16.67).length,
      totalScrollEvents: this.scrollEventCount,
      scrollFPS: this.scrollFrameTimes.length > 0 
        ? 1000 / (this.scrollFrameTimes.reduce((sum, time) => sum + time, 0) / this.scrollFrameTimes.length)
        : 60,
    };

    // Calculate progressive loading metrics if available
    let progressiveLoadingMetrics;
    if (this.batchTimes.length > 0) {
      const totalBatchTime = this.batchTimes.reduce((sum, time) => sum + time, 0);
      const photoCount = this.metrics.photoCount || 0;
      
      progressiveLoadingMetrics = {
        totalBatches: this.batchTimes.length,
        averageBatchTime: totalBatchTime / this.batchTimes.length,
        totalTime: totalBatchTime,
        itemsPerSecond: photoCount > 0 ? (photoCount / totalBatchTime) * 1000 : 0,
      };
    }

    return {
      dateGroupingTime: this.metrics.dateGroupingTime || 0,
      layoutCalculationTime: this.metrics.layoutCalculationTime || 0,
      initialRenderTime: this.metrics.initialRenderTime || 0,
      photoCount: this.metrics.photoCount || 0,
      monthGroupCount: this.metrics.monthGroupCount || 0,
      memoryUsageEstimate: this.metrics.memoryUsageEstimate || 0,
      scrollMetrics,
      virtualizationMetrics: this.metrics.virtualizationMetrics || {
        visibleItemsCount: 0,
        totalItemsCount: 0,
        renderRatio: 0,
        overscanEfficiency: 0,
      },
      progressiveLoadingMetrics,
    };
  }

  /**
   * Check if current performance meets thresholds
   */
  checkPerformanceThresholds(): {
    isWithinThresholds: boolean;
    violations: string[];
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const violations: string[] = [];
    const recommendations: string[] = [];

    if (metrics.dateGroupingTime > this.thresholds.maxDateGroupingTime) {
      violations.push(`Date grouping took ${metrics.dateGroupingTime.toFixed(0)}ms (threshold: ${this.thresholds.maxDateGroupingTime}ms)`);
      recommendations.push('Consider using progressive loading for large collections');
    }

    if (metrics.layoutCalculationTime > this.thresholds.maxLayoutCalculationTime) {
      violations.push(`Layout calculation took ${metrics.layoutCalculationTime.toFixed(0)}ms (threshold: ${this.thresholds.maxLayoutCalculationTime}ms)`);
      recommendations.push('Consider optimizing layout algorithm or reducing thumbnail size');
    }

    if (metrics.initialRenderTime > this.thresholds.maxInitialRenderTime) {
      violations.push(`Initial render took ${metrics.initialRenderTime.toFixed(0)}ms (threshold: ${this.thresholds.maxInitialRenderTime}ms)`);
      recommendations.push('Consider implementing progressive rendering or reducing initial batch size');
    }

    if (metrics.memoryUsageEstimate > this.thresholds.maxMemoryUsage) {
      violations.push(`Memory usage estimated at ${metrics.memoryUsageEstimate.toFixed(1)}MB (threshold: ${this.thresholds.maxMemoryUsage}MB)`);
      recommendations.push('Consider implementing memory management for thumbnail resources');
    }

    if (metrics.scrollMetrics.averageFrameTime > this.thresholds.maxAverageFrameTime) {
      violations.push(`Average frame time ${metrics.scrollMetrics.averageFrameTime.toFixed(1)}ms (threshold: ${this.thresholds.maxAverageFrameTime}ms)`);
      recommendations.push('Consider reducing overscan buffer or optimizing scroll handling');
    }

    // Check for UI jank from long tasks
    if (this.longTaskCount > 5) {
      violations.push(`Detected ${this.longTaskCount} long tasks that may cause UI jank`);
      recommendations.push('Consider breaking up heavy operations into smaller chunks');
    }

    return {
      isWithinThresholds: violations.length === 0,
      violations,
      recommendations,
    };
  }

  /**
   * Log performance summary to console
   */
  logPerformanceSummary(): void {
    const metrics = this.getMetrics();
    const thresholdCheck = this.checkPerformanceThresholds();

    console.group('📊 Calendar Performance Metrics');
    console.log('📸 Photos processed:', metrics.photoCount.toLocaleString());
    console.log('📅 Month groups:', metrics.monthGroupCount);
    console.log('⏱️ Date grouping:', `${metrics.dateGroupingTime.toFixed(1)}ms`);
    console.log('📐 Layout calculation:', `${metrics.layoutCalculationTime.toFixed(1)}ms`);
    console.log('🎨 Initial render:', `${metrics.initialRenderTime.toFixed(1)}ms`);
    console.log('💾 Memory estimate:', `${metrics.memoryUsageEstimate.toFixed(1)}MB`);
    console.log('🖱️ Scroll performance:', `${metrics.scrollMetrics.averageFrameTime.toFixed(1)}ms avg frame time (${metrics.scrollMetrics.scrollFPS.toFixed(1)} FPS)`);
    console.log('👁️ Virtualization ratio:', `${(metrics.virtualizationMetrics.renderRatio * 100).toFixed(1)}%`);
    
    if (metrics.progressiveLoadingMetrics) {
      console.log('⚡ Progressive loading:', 
        `${metrics.progressiveLoadingMetrics.totalBatches} batches, ` +
        `${metrics.progressiveLoadingMetrics.averageBatchTime.toFixed(1)}ms avg batch time, ` +
        `${metrics.progressiveLoadingMetrics.itemsPerSecond.toFixed(1)} items/sec`
      );
    }

    if (this.longTaskCount > 0) {
      console.log('⚠️ Long tasks detected:', this.longTaskCount);
    }

    if (!thresholdCheck.isWithinThresholds) {
      console.group('⚠️ Performance Issues');
      thresholdCheck.violations.forEach(violation => console.warn(violation));
      console.groupEnd();

      console.group('💡 Recommendations');
      thresholdCheck.recommendations.forEach(rec => console.info(rec));
      console.groupEnd();
    } else {
      console.log('✅ All performance thresholds met');
    }

    console.groupEnd();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {};
    this.scrollFrameTimes = [];
    this.lastScrollTime = 0;
    this.scrollEventCount = 0;
    this.batchTimes = [];
    this.longTaskCount = 0;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    if (this.longTaskObserver) {
      this.longTaskObserver.disconnect();
    }
    this.reset();
  }

  /**
   * Set photo and month group counts for metrics
   */
  setCollectionMetrics(photoCount: number, monthGroupCount: number): void {
    this.metrics.photoCount = photoCount;
    this.metrics.monthGroupCount = monthGroupCount;
  }
}

/**
 * Global performance monitor instance for calendar view
 */
export const calendarPerformanceMonitor = new CalendarPerformanceMonitor();