/**
 * Comprehensive performance tests for calendar view with large collections and scroll performance
 * Tests performance characteristics under various load conditions and usage patterns
 */

import { CalendarLayoutEngine } from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import { CalendarKeyboardNavigation } from '../src/frontend/containers/ContentView/calendar/keyboardNavigation';
import {
  groupFilesByMonth,
  safeGroupFilesByMonth,
  validateMonthGroups,
} from '../src/frontend/containers/ContentView/calendar/dateUtils';
import { MonthGroup } from '../src/frontend/containers/ContentView/calendar/types';
import { ClientFile } from '../src/frontend/entities/File';

// Performance test utilities
const measurePerformance = (fn: () => void, iterations: number = 1): number => {
  const startTime = performance.now();
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  const endTime = performance.now();
  return (endTime - startTime) / iterations;
};

const measureAsyncPerformance = async (
  fn: () => Promise<void>,
  iterations: number = 1,
): Promise<number> => {
  const startTime = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const endTime = performance.now();
  return (endTime - startTime) / iterations;
};

// Mock file creation utilities
const createMockFile = (
  id: string,
  dateCreated: Date,
  name: string = `file${id}.jpg`,
): Partial<ClientFile> => ({
  id: id as any,
  name,
  dateCreated,
  dateModified: dateCreated,
  dateAdded: dateCreated,
  extension: 'jpg' as any,
  size: 1000,
  width: 800,
  height: 600,
  absolutePath: `/path/to/${name}`,
  relativePath: name,
  locationId: 'location1' as any,
  ino: id,
  dateLastIndexed: dateCreated,
  tags: [] as any,
  annotations: '',
});

const createLargeFileCollection = (size: number): Partial<ClientFile>[] => {
  const files: ClientFile[] = [];
  const startDate = new Date(2020, 0, 1);

  for (let i = 0; i < size; i++) {
    // Distribute files across multiple years and months
    const daysOffset = Math.floor(i / 10); // ~10 files per day
    const date = new Date(startDate.getTime() + daysOffset * 24 * 60 * 60 * 1000);

    files.push(createMockFile(`file-${i}`, date, `photo_${i}.jpg`) as ClientFile);
  }

  return files;
};

const createMonthGroupsFromFiles = (files: Partial<ClientFile>[]): MonthGroup[] => {
  return groupFilesByMonth(files as ClientFile[]);
};

describe('Calendar Performance Comprehensive Tests', () => {
  describe('Date Grouping Performance', () => {
    it('should group small collections quickly (< 1ms per 100 files)', () => {
      const files = createLargeFileCollection(100);

      const avgTime = measurePerformance(() => {
        groupFilesByMonth(files as ClientFile[]);
      }, 10);

      expect(avgTime).toBeLessThan(1); // Less than 1ms average
    });

    it('should group medium collections efficiently (< 10ms per 1000 files)', () => {
      const files = createLargeFileCollection(1000);

      const avgTime = measurePerformance(() => {
        groupFilesByMonth(files as ClientFile[]);
      }, 5);

      expect(avgTime).toBeLessThan(10); // Less than 10ms average
    });

    it('should group large collections reasonably (< 100ms per 10000 files)', () => {
      const files = createLargeFileCollection(10000);

      const avgTime = measurePerformance(() => {
        groupFilesByMonth(files as ClientFile[]);
      }, 3);

      expect(avgTime).toBeLessThan(100); // Less than 100ms average
    });

    it('should handle very large collections without blocking (< 500ms per 50000 files)', () => {
      const files = createLargeFileCollection(50000);

      const time = measurePerformance(() => {
        groupFilesByMonth(files as ClientFile[]);
      }, 1);

      expect(time).toBeLessThan(500); // Less than 500ms
    });

    it('should scale linearly with collection size', () => {
      const sizes = [100, 500, 1000, 2000];
      const times: number[] = [];

      for (const size of sizes) {
        const files = createLargeFileCollection(size);
        const time = measurePerformance(() => {
          groupFilesByMonth(files as ClientFile[]);
        }, 3);
        times.push(time);
      }

      // Each doubling of size should not more than double the time
      for (let i = 1; i < times.length; i++) {
        const ratio = times[i] / times[i - 1];
        const sizeRatio = sizes[i] / sizes[i - 1];

        // Performance should scale better than quadratically
        expect(ratio).toBeLessThan(sizeRatio * 1.5);
      }
    });

    it('should handle files with mixed date distributions efficiently', () => {
      // Create files with various date patterns
      const files: ClientFile[] = [];

      // Clustered dates (many files on same days)
      for (let i = 0; i < 1000; i++) {
        const clusterDate = new Date(2024, 5, Math.floor(i / 100) + 1);
        files.push(createMockFile(`cluster-${i}`, clusterDate) as ClientFile);
      }

      // Sparse dates (files spread across many years)
      for (let i = 0; i < 1000; i++) {
        const sparseDate = new Date(2000 + (i % 25), i % 12, 1);
        files.push(createMockFile(`sparse-${i}`, sparseDate) as ClientFile);
      }

      // Random dates
      for (let i = 0; i < 1000; i++) {
        const randomDate = new Date(
          2020 + Math.random() * 5,
          Math.floor(Math.random() * 12),
          Math.floor(Math.random() * 28) + 1,
        );
        files.push(createMockFile(`random-${i}`, randomDate) as ClientFile);
      }

      const time = measurePerformance(() => {
        groupFilesByMonth(files as ClientFile[]);
      }, 5);

      expect(time).toBeLessThan(50); // Should handle mixed patterns efficiently
    });

    it('should handle safe grouping with error recovery efficiently', () => {
      const files = createLargeFileCollection(5000);

      // Add some problematic files
      const problematicFiles = [
        ...files,
        { id: 'bad1', dateCreated: null } as any,
        { id: 'bad2', dateCreated: new Date('invalid') } as any,
        { id: 'bad3' } as any, // Missing dateCreated
      ];

      const time = measurePerformance(() => {
        safeGroupFilesByMonth(problematicFiles as ClientFile[]);
      }, 3);

      expect(time).toBeLessThan(100); // Should handle errors without major performance impact
    });
  });

  describe('Layout Engine Performance', () => {
    let engine: CalendarLayoutEngine;

    beforeEach(() => {
      engine = new CalendarLayoutEngine({
        containerWidth: 1200,
        thumbnailSize: 160,
        thumbnailPadding: 8,
        headerHeight: 48,
        groupMargin: 24,
      });
    });

    it('should calculate layout for small collections quickly (< 1ms per 100 photos)', () => {
      const files = createLargeFileCollection(100);
      const monthGroups = createMonthGroupsFromFiles(files);

      const avgTime = measurePerformance(() => {
        engine.calculateLayout(monthGroups);
      }, 10);

      expect(avgTime).toBeLessThan(1);
    });

    it('should calculate layout for medium collections efficiently (< 10ms per 1000 photos)', () => {
      const files = createLargeFileCollection(1000);
      const monthGroups = createMonthGroupsFromFiles(files);

      const avgTime = measurePerformance(() => {
        engine.calculateLayout(monthGroups);
      }, 5);

      expect(avgTime).toBeLessThan(10);
    });

    it('should calculate layout for large collections reasonably (< 50ms per 10000 photos)', () => {
      const files = createLargeFileCollection(10000);
      const monthGroups = createMonthGroupsFromFiles(files);

      const avgTime = measurePerformance(() => {
        engine.calculateLayout(monthGroups);
      }, 3);

      expect(avgTime).toBeLessThan(50);
    });

    it('should handle layout recalculation efficiently', () => {
      const files = createLargeFileCollection(5000);
      const monthGroups = createMonthGroupsFromFiles(files);

      // Initial calculation
      engine.calculateLayout(monthGroups);

      // Measure recalculation time
      const recalcTime = measurePerformance(() => {
        engine.updateConfig({ thumbnailSize: 180 });
      }, 5);

      expect(recalcTime).toBeLessThan(30); // Recalculation should be fast
    });

    it('should handle responsive layout changes efficiently', () => {
      const files = createLargeFileCollection(2000);
      const monthGroups = createMonthGroupsFromFiles(files);

      engine.calculateLayout(monthGroups);

      const containerWidths = [600, 800, 1000, 1200, 1600, 2000];

      const avgTime = measurePerformance(() => {
        for (const width of containerWidths) {
          engine.updateConfig({ containerWidth: width });
        }
      }, 3);

      expect(avgTime).toBeLessThan(20); // Multiple responsive changes should be fast
    });

    it('should optimize items per row calculation', () => {
      const iterations = 10000;

      const avgTime = measurePerformance(() => {
        engine.calculateItemsPerRow();
      }, iterations);

      expect(avgTime).toBeLessThan(0.01); // Should be extremely fast (< 0.01ms)
    });
  });

  describe('Virtualization Performance', () => {
    let engine: CalendarLayoutEngine;

    beforeEach(() => {
      engine = new CalendarLayoutEngine({
        containerWidth: 1200,
        thumbnailSize: 160,
        thumbnailPadding: 8,
        headerHeight: 48,
        groupMargin: 24,
      });
    });

    it('should find visible items quickly with binary search (< 0.1ms)', () => {
      const files = createLargeFileCollection(10000);
      const monthGroups = createMonthGroupsFromFiles(files);

      engine.calculateLayout(monthGroups);

      const avgTime = measurePerformance(() => {
        engine.findVisibleItems(5000, 600, 2);
      }, 1000);

      expect(avgTime).toBeLessThan(0.1); // Binary search should be very fast
    });

    it('should handle rapid scroll events efficiently', () => {
      const files = createLargeFileCollection(5000);
      const monthGroups = createMonthGroupsFromFiles(files);

      engine.calculateLayout(monthGroups);

      const scrollPositions = Array.from({ length: 100 }, (_, i) => i * 50);

      const avgTime = measurePerformance(() => {
        for (const scrollTop of scrollPositions) {
          engine.findVisibleItems(scrollTop, 600, 2);
        }
      }, 10);

      expect(avgTime).toBeLessThan(5); // 100 scroll calculations should be fast
    });

    it('should scale logarithmically with collection size', () => {
      const sizes = [1000, 2000, 4000, 8000];
      const times: number[] = [];

      for (const size of sizes) {
        const files = createLargeFileCollection(size);
        const monthGroups = createMonthGroupsFromFiles(files);

        engine.calculateLayout(monthGroups);

        const time = measurePerformance(() => {
          engine.findVisibleItems(1000, 600, 2);
        }, 100);

        times.push(time);
      }

      // Binary search should scale logarithmically
      for (let i = 1; i < times.length; i++) {
        const ratio = times[i] / times[i - 1];
        // Should not increase significantly with size
        expect(ratio).toBeLessThan(2);
      }
    });

    it('should handle extreme scroll positions efficiently', () => {
      const files = createLargeFileCollection(10000);
      const monthGroups = createMonthGroupsFromFiles(files);

      engine.calculateLayout(monthGroups);
      const totalHeight = engine.getTotalHeight();

      const extremePositions = [
        -1000, // Before content
        0, // Start
        totalHeight / 4, // Quarter
        totalHeight / 2, // Middle
        (totalHeight * 3) / 4, // Three quarters
        totalHeight, // End
        totalHeight + 1000, // After content
      ];

      const avgTime = measurePerformance(() => {
        for (const pos of extremePositions) {
          engine.findVisibleItems(pos, 600, 2);
        }
      }, 50);

      expect(avgTime).toBeLessThan(1); // Should handle extreme positions efficiently
    });

    it('should handle different viewport sizes efficiently', () => {
      const files = createLargeFileCollection(5000);
      const monthGroups = createMonthGroupsFromFiles(files);

      engine.calculateLayout(monthGroups);

      const viewportSizes = [200, 400, 600, 800, 1000, 1200];

      const avgTime = measurePerformance(() => {
        for (const height of viewportSizes) {
          engine.findVisibleItems(1000, height, 2);
        }
      }, 20);

      expect(avgTime).toBeLessThan(2); // Different viewport sizes should not significantly impact performance
    });

    it('should handle overscan efficiently', () => {
      const files = createLargeFileCollection(3000);
      const monthGroups = createMonthGroupsFromFiles(files);

      engine.calculateLayout(monthGroups);

      const overscanValues = [0, 1, 2, 5, 10, 20];

      const avgTime = measurePerformance(() => {
        for (const overscan of overscanValues) {
          engine.findVisibleItems(1000, 600, overscan);
        }
      }, 50);

      expect(avgTime).toBeLessThan(1); // Overscan should not significantly impact performance
    });
  });

  describe('Keyboard Navigation Performance', () => {
    let engine: CalendarLayoutEngine;
    let navigation: CalendarKeyboardNavigation;
    let files: Partial<ClientFile>[];
    let monthGroups: MonthGroup[];

    beforeEach(() => {
      engine = new CalendarLayoutEngine({
        containerWidth: 1200,
        thumbnailSize: 160,
        thumbnailPadding: 8,
        headerHeight: 48,
        groupMargin: 24,
      });

      files = createLargeFileCollection(2000) as ClientFile[];
      monthGroups = createMonthGroupsFromFiles(files);

      engine.calculateLayout(monthGroups);
      navigation = new CalendarKeyboardNavigation(engine, files, monthGroups);
    });

    it('should build position map quickly (< 50ms for 2000 photos)', () => {
      const time = measurePerformance(() => {
        new CalendarKeyboardNavigation(engine, files, monthGroups);
      }, 5);

      expect(time).toBeLessThan(50);
    });

    it('should navigate between photos quickly (< 0.1ms per navigation)', () => {
      const directions: Array<'up' | 'down' | 'left' | 'right'> = ['up', 'down', 'left', 'right'];

      const avgTime = measurePerformance(() => {
        for (let i = 0; i < 100; i++) {
          const direction = directions[i % 4];
          const currentIndex = Math.floor(Math.random() * files.length);
          navigation.navigate(currentIndex, direction);
        }
      }, 10);

      expect(avgTime).toBeLessThan(10); // 100 navigations should be fast
    });

    it('should handle position lookups efficiently (< 0.01ms)', () => {
      const avgTime = measurePerformance(() => {
        for (let i = 0; i < 1000; i++) {
          const index = Math.floor(Math.random() * files.length);
          navigation.getPositionByGlobalIndex(index);
        }
      }, 10);

      expect(avgTime).toBeLessThan(1); // 1000 lookups should be very fast
    });

    it('should calculate scroll positions efficiently', () => {
      const avgTime = measurePerformance(() => {
        for (let i = 0; i < 100; i++) {
          const index = Math.floor(Math.random() * files.length);
          navigation.getScrollPositionForPhoto(index, 600);
        }
      }, 10);

      expect(avgTime).toBeLessThan(5); // 100 scroll calculations should be fast
    });

    it('should handle navigation updates efficiently', () => {
      const newFiles = files.slice(0, 1000); // Reduced dataset
      const newMonthGroups = monthGroups.slice(0, 10); // Reduced groups

      const time = measurePerformance(() => {
        navigation.update(newFiles, newMonthGroups);
      }, 5);

      expect(time).toBeLessThan(30); // Updates should be fast
    });

    it('should handle cross-month navigation efficiently', () => {
      // Test navigation that crosses month boundaries
      const avgTime = measurePerformance(() => {
        for (let i = 0; i < 50; i++) {
          // Find a photo at the end of a month
          const monthGroup = monthGroups[i % monthGroups.length];
          if (monthGroup.photos.length > 0) {
            const lastPhotoInMonth = monthGroup.photos[monthGroup.photos.length - 1];
            const globalIndex = files.findIndex((f) => f.id === lastPhotoInMonth.id);

            if (globalIndex !== -1) {
              // Navigate right to next month
              navigation.navigate(globalIndex, 'right');
            }
          }
        }
      }, 5);

      expect(avgTime).toBeLessThan(10); // Cross-month navigation should be efficient
    });
  });

  describe('Memory Performance', () => {
    it('should not leak memory during repeated operations', () => {
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Perform many operations that could potentially leak memory
      for (let i = 0; i < 100; i++) {
        const files = createLargeFileCollection(100);
        const monthGroups = groupFilesByMonth(files);

        const engine = new CalendarLayoutEngine();
        engine.calculateLayout(monthGroups);

        const navigation = new CalendarKeyboardNavigation(engine, files, monthGroups);

        // Perform some operations
        for (let j = 0; j < 10; j++) {
          engine.findVisibleItems(j * 100, 600, 2);
          navigation.navigate(j % files.length, 'right');
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Memory usage should not grow excessively
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        const maxAcceptableGrowth = 50 * 1024 * 1024; // 50MB

        expect(memoryGrowth).toBeLessThan(maxAcceptableGrowth);
      }
    });

    it('should handle large datasets without excessive memory usage', () => {
      const files = createLargeFileCollection(10000);
      const monthGroups = createMonthGroupsFromFiles(files);

      const engine = new CalendarLayoutEngine();
      const startMemory = (performance as any).memory?.usedJSHeapSize || 0;

      engine.calculateLayout(monthGroups);
      const navigation = new CalendarKeyboardNavigation(engine, files, monthGroups);

      const endMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Should not use excessive memory for large datasets
      if (startMemory > 0 && endMemory > 0) {
        const memoryUsed = endMemory - startMemory;
        const maxAcceptableMemory = 100 * 1024 * 1024; // 100MB for 10k files

        expect(memoryUsed).toBeLessThan(maxAcceptableMemory);
      }
    });
  });

  describe('Stress Testing', () => {
    it('should handle concurrent operations without performance degradation', async () => {
      const files = createLargeFileCollection(1000);
      const monthGroups = createMonthGroupsFromFiles(files);

      const engine = new CalendarLayoutEngine();
      engine.calculateLayout(monthGroups);

      const navigation = new CalendarKeyboardNavigation(engine, files, monthGroups);

      // Simulate concurrent operations
      const operations = [
        () => engine.findVisibleItems(Math.random() * 10000, 600, 2),
        () => navigation.navigate(Math.floor(Math.random() * files.length), 'right'),
        () => engine.updateConfig({ thumbnailSize: 140 + Math.random() * 40 }),
        () => navigation.getScrollPositionForPhoto(Math.floor(Math.random() * files.length), 600),
      ];

      const concurrentTasks = Array.from({ length: 100 }, () =>
        Promise.resolve().then(() => {
          const operation = operations[Math.floor(Math.random() * operations.length)];
          operation();
        }),
      );

      const startTime = performance.now();
      await Promise.all(concurrentTasks);
      const totalTime = performance.now() - startTime;

      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain performance under rapid configuration changes', () => {
      const files = createLargeFileCollection(2000);
      const monthGroups = createMonthGroupsFromFiles(files);

      const engine = new CalendarLayoutEngine();
      engine.calculateLayout(monthGroups);

      const time = measurePerformance(() => {
        for (let i = 0; i < 50; i++) {
          engine.updateConfig({
            containerWidth: 800 + (i % 5) * 200,
            thumbnailSize: 120 + (i % 4) * 20,
          });

          // Perform some operations after each config change
          engine.findVisibleItems(i * 100, 600, 2);
        }
      }, 3);

      expect(time).toBeLessThan(100); // Rapid config changes should not severely impact performance
    });

    it('should handle edge case scenarios efficiently', () => {
      // Test with various edge case scenarios
      const edgeCases = [
        createLargeFileCollection(1), // Single file
        createLargeFileCollection(2), // Two files
        [], // Empty collection
        createLargeFileCollection(10000), // Very large collection
      ];

      for (const files of edgeCases) {
        const time = measurePerformance(() => {
          if (files.length > 0) {
            const monthGroups = groupFilesByMonth(files);
            const engine = new CalendarLayoutEngine();
            engine.calculateLayout(monthGroups);

            if (files.length > 0) {
              const navigation = new CalendarKeyboardNavigation(engine, files, monthGroups);
              navigation.navigate(0, 'right');
            }
          }
        }, 5);

        expect(time).toBeLessThan(200); // Should handle edge cases efficiently
      }
    });
  });
});
