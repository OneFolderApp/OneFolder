/**
 * Tests for calendar performance optimizations for large collections
 */

import { CalendarMemoryManager } from '../src/frontend/containers/ContentView/calendar/MemoryManager';
import { CalendarPerformanceMonitor } from '../src/frontend/containers/ContentView/calendar/PerformanceMonitor';

describe('CalendarMemoryManager', () => {
  let memoryManager: CalendarMemoryManager;
  let mockImageElement: HTMLImageElement;

  beforeEach(() => {
    memoryManager = new CalendarMemoryManager();
    mockImageElement = {
      naturalWidth: 160,
      naturalHeight: 160,
      width: 160,
      height: 160,
      src: 'blob:test',
    } as HTMLImageElement;
  });

  afterEach(() => {
    memoryManager.dispose();
  });

  it('should initialize with default configuration', () => {
    const stats = memoryManager.getMemoryStats();
    expect(stats.cacheSize).toBe(0);
    expect(stats.memoryUsage).toBe(0);
    expect(stats.visibleThumbnails).toBe(0);
  });

  it('should cache thumbnails efficiently', () => {
    const mockFile = { id: 'test-1' };

    memoryManager.cacheThumbnail(mockFile as any, mockImageElement, true);

    const cached = memoryManager.getThumbnail('test-1');
    expect(cached).toBe(mockImageElement);

    const stats = memoryManager.getMemoryStats();
    expect(stats.cacheSize).toBe(1);
    expect(stats.visibleThumbnails).toBe(1);
  });

  it('should update configuration correctly', () => {
    memoryManager.updateConfig({
      maxThumbnailCache: 500,
      maxMemoryUsage: 100,
    });

    // Configuration should be updated (we can't directly test private config)
    // but we can test that it doesn't throw errors
    expect(() => {
      memoryManager.updateConfig({ aggressiveCleanup: true });
    }).not.toThrow();
  });

  it('should handle visibility updates', () => {
    const mockFiles = Array.from({ length: 5 }, (_, i) => ({ id: `test-${i}` }));

    // Cache all thumbnails
    mockFiles.forEach((file) => {
      memoryManager.cacheThumbnail(file as any, mockImageElement, false);
    });

    // Mark some as visible
    const visibleIds = ['test-0', 'test-1', 'test-2'];
    const allIds = mockFiles.map((f) => f.id);

    memoryManager.updateVisibility(visibleIds, allIds);

    const stats = memoryManager.getMemoryStats();
    expect(stats.visibleThumbnails).toBe(3);
  });

  it('should clear cache correctly', () => {
    const mockFile = { id: 'test-clear' };
    memoryManager.cacheThumbnail(mockFile as any, mockImageElement, true);

    expect(memoryManager.getMemoryStats().cacheSize).toBe(1);

    memoryManager.clearCache();

    expect(memoryManager.getMemoryStats().cacheSize).toBe(0);
  });
});

describe('CalendarPerformanceMonitor', () => {
  let monitor: CalendarPerformanceMonitor;

  beforeEach(() => {
    monitor = new CalendarPerformanceMonitor();
  });

  afterEach(() => {
    monitor.dispose();
  });

  it('should initialize with default metrics', () => {
    const metrics = monitor.getMetrics();
    expect(metrics.dateGroupingTime).toBe(0);
    expect(metrics.layoutCalculationTime).toBe(0);
    expect(metrics.initialRenderTime).toBe(0);
    expect(metrics.photoCount).toBe(0);
    expect(metrics.monthGroupCount).toBe(0);
  });

  it('should track timing operations', () => {
    monitor.startTiming('test-operation');

    // Simulate some work
    const start = performance.now();
    while (performance.now() - start < 10) {
      // Wait 10ms
    }

    const duration = monitor.endTiming('test-operation');
    expect(duration).toBeGreaterThan(0);
  });

  it('should record scroll performance metrics', () => {
    // Simulate scroll events
    for (let i = 0; i < 10; i++) {
      monitor.recordScrollEvent();
    }

    const metrics = monitor.getMetrics();
    expect(metrics.scrollMetrics.totalScrollEvents).toBe(10);
  });

  it('should record virtualization metrics', () => {
    monitor.recordVirtualizationMetrics(10, 100, 2);

    const metrics = monitor.getMetrics();
    expect(metrics.virtualizationMetrics.visibleItemsCount).toBe(10);
    expect(metrics.virtualizationMetrics.totalItemsCount).toBe(100);
    expect(metrics.virtualizationMetrics.renderRatio).toBe(0.1);
  });

  it('should estimate memory usage', () => {
    const memoryUsage = monitor.estimateMemoryUsage(1000, 160);
    expect(memoryUsage).toBeGreaterThan(0);

    const metrics = monitor.getMetrics();
    expect(metrics.memoryUsageEstimate).toBe(memoryUsage);
  });

  it('should check performance thresholds', () => {
    monitor.setCollectionMetrics(10000, 50);
    monitor.estimateMemoryUsage(10000, 160);

    const thresholdCheck = monitor.checkPerformanceThresholds();
    expect(thresholdCheck).toHaveProperty('isWithinThresholds');
    expect(thresholdCheck).toHaveProperty('violations');
    expect(thresholdCheck).toHaveProperty('recommendations');
    expect(Array.isArray(thresholdCheck.violations)).toBe(true);
    expect(Array.isArray(thresholdCheck.recommendations)).toBe(true);
  });

  it('should log performance summary without errors', () => {
    const consoleSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    monitor.setCollectionMetrics(1000, 12);
    monitor.logPerformanceSummary();

    expect(consoleSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();
    expect(consoleGroupEndSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });

  it('should reset metrics correctly', () => {
    monitor.setCollectionMetrics(1000, 12);
    monitor.recordScrollEvent();

    let metrics = monitor.getMetrics();
    expect(metrics.photoCount).toBe(1000);
    expect(metrics.scrollMetrics.totalScrollEvents).toBe(1);

    monitor.reset();

    metrics = monitor.getMetrics();
    expect(metrics.photoCount).toBe(0);
    expect(metrics.scrollMetrics.totalScrollEvents).toBe(0);
  });
});
