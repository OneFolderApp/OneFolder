/**
 * Visual regression tests for calendar layout consistency
 * Tests layout calculations and visual consistency across different configurations
 */

import {
  CalendarLayoutEngine,
  DEFAULT_LAYOUT_CONFIG,
} from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import { groupFilesByMonth } from '../src/frontend/containers/ContentView/calendar/dateUtils';
import {
  MonthGroup,
  LayoutItem,
  CalendarLayoutConfig,
} from '../src/frontend/containers/ContentView/calendar/types';
import { ClientFile } from '../src/frontend/entities/File';

// Mock ClientFile for testing
const createMockFile = (
  id: string,
  dateCreated: Date,
  name: string = `file${id}.jpg`,
): ClientFile => ({
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

// Layout snapshot utilities
interface LayoutSnapshot {
  totalHeight: number;
  itemCount: number;
  items: Array<{
    type: 'header' | 'grid';
    top: number;
    height: number;
    monthId: string;
    photoCount?: number;
  }>;
  config: CalendarLayoutConfig;
}

const captureLayoutSnapshot = (engine: CalendarLayoutEngine): LayoutSnapshot => {
  const items = engine.getLayoutItems();
  const config = (engine as any).config;

  return {
    totalHeight: engine.getTotalHeight(),
    itemCount: items.length,
    items: items.map((item) => ({
      type: item.type,
      top: item.top,
      height: item.height,
      monthId: item.monthGroup.id,
      photoCount: item.photos?.length,
    })),
    config: { ...config },
  };
};

const compareLayoutSnapshots = (
  snapshot1: LayoutSnapshot,
  snapshot2: LayoutSnapshot,
): {
  isEqual: boolean;
  differences: string[];
} => {
  const differences: string[] = [];

  if (snapshot1.totalHeight !== snapshot2.totalHeight) {
    differences.push(`Total height: ${snapshot1.totalHeight} vs ${snapshot2.totalHeight}`);
  }

  if (snapshot1.itemCount !== snapshot2.itemCount) {
    differences.push(`Item count: ${snapshot1.itemCount} vs ${snapshot2.itemCount}`);
  }

  if (snapshot1.items.length !== snapshot2.items.length) {
    differences.push(`Items array length: ${snapshot1.items.length} vs ${snapshot2.items.length}`);
  } else {
    for (let i = 0; i < snapshot1.items.length; i++) {
      const item1 = snapshot1.items[i];
      const item2 = snapshot2.items[i];

      if (item1.type !== item2.type) {
        differences.push(`Item ${i} type: ${item1.type} vs ${item2.type}`);
      }

      if (item1.top !== item2.top) {
        differences.push(`Item ${i} top: ${item1.top} vs ${item2.top}`);
      }

      if (item1.height !== item2.height) {
        differences.push(`Item ${i} height: ${item1.height} vs ${item2.height}`);
      }

      if (item1.monthId !== item2.monthId) {
        differences.push(`Item ${i} monthId: ${item1.monthId} vs ${item2.monthId}`);
      }

      if (item1.photoCount !== item2.photoCount) {
        differences.push(`Item ${i} photoCount: ${item1.photoCount} vs ${item2.photoCount}`);
      }
    }
  }

  return {
    isEqual: differences.length === 0,
    differences,
  };
};

describe('Calendar Visual Regression Tests', () => {
  describe('Layout Consistency', () => {
    it('should produce identical layouts for identical inputs', () => {
      const files = [
        createMockFile('1', new Date(2024, 5, 15)),
        createMockFile('2', new Date(2024, 5, 20)),
        createMockFile('3', new Date(2024, 4, 10)),
      ];

      const engine1 = new CalendarLayoutEngine();
      const engine2 = new CalendarLayoutEngine();

      engine1.calculateLayout(files);
      engine2.calculateLayout(files);

      const snapshot1 = captureLayoutSnapshot(engine1);
      const snapshot2 = captureLayoutSnapshot(engine2);

      const comparison = compareLayoutSnapshots(snapshot1, snapshot2);

      expect(comparison.isEqual).toBe(true);
      if (!comparison.isEqual) {
        console.log('Layout differences:', comparison.differences);
      }
    });

    it('should maintain layout consistency across recalculations', () => {
      const files = Array.from({ length: 20 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, Math.floor(i / 5), (i % 5) + 1)),
      );

      const engine = new CalendarLayoutEngine();

      // Initial calculation
      engine.calculateLayout(files);
      const initialSnapshot = captureLayoutSnapshot(engine);

      // Recalculate multiple times
      for (let i = 0; i < 5; i++) {
        engine.calculateLayout(files);
        const recalcSnapshot = captureLayoutSnapshot(engine);

        const comparison = compareLayoutSnapshots(initialSnapshot, recalcSnapshot);
        expect(comparison.isEqual).toBe(true);
      }
    });

    it('should produce consistent layouts for different file orderings', () => {
      const files = [
        createMockFile('1', new Date(2024, 5, 15)),
        createMockFile('2', new Date(2024, 5, 10)),
        createMockFile('3', new Date(2024, 4, 20)),
        createMockFile('4', new Date(2024, 4, 5)),
      ];

      // Test with different input orderings
      const orderings = [
        files,
        [...files].reverse(),
        [...files].sort(() => Math.random() - 0.5),
        [...files].sort((a, b) => a.name.localeCompare(b.name)),
      ];

      const snapshots = orderings.map((ordering) => {
        const engine = new CalendarLayoutEngine();
        engine.calculateLayout(ordering);
        return captureLayoutSnapshot(engine);
      });

      // All snapshots should be identical (grouping should normalize order)
      for (let i = 1; i < snapshots.length; i++) {
        const comparison = compareLayoutSnapshots(snapshots[0], snapshots[i]);
        expect(comparison.isEqual).toBe(true);
      }
    });

    it('should maintain proportional spacing across different container widths', () => {
      const files = Array.from({ length: 12 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, 5, i + 1)),
      );

      const containerWidths = [600, 800, 1000, 1200, 1600];
      const snapshots: LayoutSnapshot[] = [];

      for (const width of containerWidths) {
        const engine = new CalendarLayoutEngine({ containerWidth: width });
        engine.calculateLayout(files);
        snapshots.push(captureLayoutSnapshot(engine));
      }

      // Verify that spacing ratios are maintained
      for (let i = 1; i < snapshots.length; i++) {
        const prev = snapshots[i - 1];
        const curr = snapshots[i];

        // Items per row should increase with width
        const prevItemsPerRow = Math.floor(
          (prev.config.containerWidth - prev.config.thumbnailPadding) /
            (prev.config.thumbnailSize + prev.config.thumbnailPadding),
        );
        const currItemsPerRow = Math.floor(
          (curr.config.containerWidth - curr.config.thumbnailPadding) /
            (curr.config.thumbnailSize + curr.config.thumbnailPadding),

        expect(currItemsPerRow).toBeGreaterThanOrEqual(prevItemsPerRow);

        // Header heights should remain consistent
        const prevHeaders = prev.items.filter((item) => item.type === 'header');
        const currHeaders = curr.items.filter((item) => item.type === 'header');

        expect(currHeaders.length).toBe(prevHeaders.length);

        for (let j = 0; j < prevHeaders.length; j++) {
          expect(currHeaders[j].height).toBe(prevHeaders[j].height);
        }
      }
    });

    it('should maintain consistent grid heights for same photo counts', () => {
      const photoCounts = [1, 2, 4, 8, 12, 16, 20];
      const containerWidth = 800;
      const thumbnailSize = 160;

      const engine = new CalendarLayoutEngine({
        containerWidth,
        thumbnailSize,
        thumbnailPadding: 8
      });

      const itemsPerRow = engine.calculateItemsPerRow();

      for (const photoCount of photoCounts) {
        const files = Array.from({ length: photoCount }, (_, i) =>
          createMockFile(`file-${i}`, new Date(2024, 5, i + 1)),
        );

        engine.calculateLayout(files);
        const snapshot = captureLayoutSnapshot(engine);

        const gridItem = snapshot.items.find((item) => item.type === 'grid');
        expect(gridItem).toBeDefined();

        // Calculate expected height
        const expectedRows = Math.ceil(photoCount / itemsPerRow);
        const expectedHeight = expectedRows * (thumbnailSize + 8); // 8 is padding

        expect(gridItem!.height).toBe(expectedHeight);
        expect(gridItem!.photoCount).toBe(photoCount);
      }
    });

    it('should maintain consistent month group ordering', () => {
      // Create files spanning multiple years and months
      const files = [
        createMockFile('1', new Date(2024, 5, 15)), // June 2024
        createMockFile('2', new Date(2023, 11, 25)), // December 2023
        createMockFile('3', new Date(2024, 0, 10)), // January 2024
        createMockFile('4', new Date(2023, 5, 5)), // June 2023
        createMockFile('5', new Date(2024, 5, 20)), // June 2024
      ];

      const engine = new CalendarLayoutEngine();
      engine.calculateLayout(files);
      const snapshot = captureLayoutSnapshot(engine);

      const headerItems = snapshot.items.filter((item) => item.type === 'header');

      // Should be ordered newest to oldest
      const expectedOrder = ['2024-06', '2024-01', '2023-12', '2023-06'];
      const actualOrder = headerItems.map((item) => item.monthId);

      expect(actualOrder).toEqual(expectedOrder);

      // Verify positions are in ascending order
      for (let i = 1; i < headerItems.length; i++) {
        expect(headerItems[i].top).toBeGreaterThan(headerItems[i - 1].top);
      }
    });
  });

  describe('Responsive Layout Consistency', () => {
    it('should maintain visual hierarchy across thumbnail sizes', () => {
      const files = Array.from({ length: 16 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, 5, i + 1)),
      );

      const thumbnailSizes = [80, 120, 160, 200, 240];
      const snapshots: LayoutSnapshot[] = [];

      for (const size of thumbnailSizes) {
        const engine = new CalendarLayoutEngine({
          containerWidth: 1000,
          thumbnailSize: size
        });
        engine.calculateLayout(files);
        snapshots.push(captureLayoutSnapshot(engine));
      }

      // Verify visual hierarchy is maintained
      for (const snapshot of snapshots) {
        const items = snapshot.items;

        // Headers should always come before their corresponding grids
        for (let i = 0; i < items.length - 1; i += 2) {
          expect(items[i].type).toBe('header');
          expect(items[i + 1].type).toBe('grid');
          expect(items[i].monthId).toBe(items[i + 1].monthId);
          expect(items[i + 1].top).toBe(items[i].top + items[i].height);
        }
      }
    });

    it('should maintain consistent margins and spacing ratios', () => {
      const files = [
        createMockFile('1', new Date(2024, 5, 15)),
        createMockFile('2', new Date(2024, 4, 10)),
        createMockFile('3', new Date(2024, 3, 5)),
      ];

      const configs = [
        { containerWidth: 600, thumbnailSize: 120, groupMargin: 16 },
        { containerWidth: 800, thumbnailSize: 160, groupMargin: 20 },
        { containerWidth: 1200, thumbnailSize: 200, groupMargin: 24 },
      ];

      for (const config of configs) {
        const engine = new CalendarLayoutEngine(config);
        engine.calculateLayout(files);
        const snapshot = captureLayoutSnapshot(engine);

        const headerItems = snapshot.items.filter((item) => item.type === 'header');

        // Verify margins between month groups
        for (let i = 1; i < headerItems.length; i++) {
          const prevGridIndex = snapshot.items.findIndex(
            (item) => item.type === 'grid' && item.monthId === headerItems[i - 1].monthId,
          );
          const prevGrid = snapshot.items[prevGridIndex];
          const currentHeader = headerItems[i];

          const actualMargin = currentHeader.top - (prevGrid.top + prevGrid.height);
          expect(actualMargin).toBe(config.groupMargin);
        }
      }
    });

    it('should handle edge cases in responsive calculations', () => {
      const files = [createMockFile('1', new Date(2024, 5, 15))];

      const edgeCases = [
        { containerWidth: 100, thumbnailSize: 200 }, // Thumbnail larger than container
        { containerWidth: 50, thumbnailSize: 160 }, // Very narrow container
        { containerWidth: 5000, thumbnailSize: 80 }, // Very wide container
        { containerWidth: 800, thumbnailSize: 1 }, // Very small thumbnails
      ];

      for (const config of edgeCases) {
        const engine = new CalendarLayoutEngine(config);

        expect(() => {
          engine.calculateLayout(files);
        }).not.toThrow();

        const snapshot = captureLayoutSnapshot(engine);

        // Should always have at least one item per row
        const itemsPerRow = engine.calculateItemsPerRow();
        expect(itemsPerRow).toBeGreaterThanOrEqual(1);

        // Layout should be valid
        expect(snapshot.totalHeight).toBeGreaterThan(0);
        expect(snapshot.itemCount).toBeGreaterThan(0);
      }
    });
  });

  describe('Layout Stability', () => {
    it('should produce stable layouts under repeated calculations', () => {
      const files = Array.from({ length: 50 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, Math.floor(i / 10), (i % 10) + 1)),
      );

      const engine = new CalendarLayoutEngine();
      const snapshots: LayoutSnapshot[] = [];

      // Perform multiple calculations
      for (let i = 0; i < 10; i++) {
        engine.calculateLayout(files);
        snapshots.push(captureLayoutSnapshot(engine));
      }

      // All snapshots should be identical
      for (let i = 1; i < snapshots.length; i++) {
        const comparison = compareLayoutSnapshots(snapshots[0], snapshots[i]);
        expect(comparison.isEqual).toBe(true);
      }
    });

    it('should maintain layout stability during configuration updates', () => {
      const files = Array.from({ length: 20 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, 5, i + 1)),
      );

      const engine = new CalendarLayoutEngine();
      engine.calculateLayout(files);

      const originalSnapshot = captureLayoutSnapshot(engine);

      // Update configuration and recalculate
      engine.updateConfig({ thumbnailPadding: 10 });
      const updatedSnapshot = captureLayoutSnapshot(engine);

      // Layout should be recalculated with new configuration
      expect(updatedSnapshot.config.thumbnailPadding).toBe(10);

      // But structure should remain consistent
      expect(updatedSnapshot.itemCount).toBe(originalSnapshot.itemCount);
      expect(updatedSnapshot.items.length).toBe(originalSnapshot.items.length);

      // Item types and order should be the same
      for (let i = 0; i < originalSnapshot.items.length; i++) {
        expect(updatedSnapshot.items[i].type).toBe(originalSnapshot.items[i].type);
        expect(updatedSnapshot.items[i].monthId).toBe(originalSnapshot.items[i].monthId);
      }
    });

    it('should handle dynamic data changes gracefully', () => {
      const initialFiles = Array.from({ length: 10 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, 5, i + 1)),
      );

      const engine = new CalendarLayoutEngine();
      engine.calculateLayout(initialFiles);
      const initialSnapshot = captureLayoutSnapshot(engine);

      // Add more files
      const additionalFiles = Array.from({ length: 5 }, (_, i) =>
        createMockFile(`new-${i}`, new Date(2024, 4, i + 1)),
      );

      const allFiles = [...initialFiles, ...additionalFiles];
      engine.calculateLayout(allFiles);
      const expandedSnapshot = captureLayoutSnapshot(engine);

      // Should have more items (new month group)
      expect(expandedSnapshot.itemCount).toBeGreaterThan(initialSnapshot.itemCount);
      expect(expandedSnapshot.totalHeight).toBeGreaterThan(initialSnapshot.totalHeight);

      // Remove files
      const reducedFiles = initialFiles.slice(0, 5);
      engine.calculateLayout(reducedFiles);
      const reducedSnapshot = captureLayoutSnapshot(engine);

      // Should have fewer items but maintain structure
      expect(reducedSnapshot.itemCount).toBeLessThan(initialSnapshot.itemCount);
      expect(reducedSnapshot.totalHeight).toBeLessThan(initialSnapshot.totalHeight);

      // But should still be valid
      expect(reducedSnapshot.itemCount).toBeGreaterThan(0);
      expect(reducedSnapshot.totalHeight).toBeGreaterThan(0);
    });
  });

  describe('Cross-Browser Layout Consistency', () => {
    it('should produce consistent layouts regardless of Math precision differences', () => {
      const files = Array.from({ length: 13 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, 5, i + 1)),
      );

      // Test with configurations that might produce floating point precision issues
      const precisionTestConfigs = [
        { containerWidth: 777, thumbnailSize: 157, thumbnailPadding: 7 },
        { containerWidth: 999, thumbnailSize: 133, thumbnailPadding: 11 },
        { containerWidth: 1111, thumbnailSize: 171, thumbnailPadding: 13 },
      ];

      for (const config of precisionTestConfigs) {
        const engine = new CalendarLayoutEngine(config);
        engine.calculateLayout(files);
        const snapshot = captureLayoutSnapshot(engine);

        // All calculations should result in integer positions and sizes
        for (const item of snapshot.items) {
          expect(Number.isInteger(item.top)).toBe(true);
          expect(Number.isInteger(item.height)).toBe(true);
        }

        expect(Number.isInteger(snapshot.totalHeight)).toBe(true);
      }
    });

    it('should handle different viewport aspect ratios consistently', () => {
      const files = Array.from({ length: 24 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, 5, i + 1)),
      );

      const aspectRatios = [
        { width: 800, height: 600 }, // 4:3
        { width: 1024, height: 768 }, // 4:3
        { width: 1366, height: 768 }, // 16:9
        { width: 1920, height: 1080 }, // 16:9
        { width: 2560, height: 1440 }, // 16:9
        { width: 1440, height: 900 }, // 16:10
      ];

      for (const { width, height } of aspectRatios) {
        const engine = new CalendarLayoutEngine({ containerWidth: width });
        engine.calculateLayout(files);
        const snapshot = captureLayoutSnapshot(engine);

        // Layout should be valid for all aspect ratios
        expect(snapshot.totalHeight).toBeGreaterThan(0);
        expect(snapshot.itemCount).toBeGreaterThan(0);

        // Items per row should be reasonable for the width
        const itemsPerRow = engine.calculateItemsPerRow();
        expect(itemsPerRow).toBeGreaterThan(0);
        expect(itemsPerRow).toBeLessThanOrEqual(15); // Reasonable maximum

        // Grid heights should be proportional to photo count
        const gridItems = snapshot.items.filter((item) => item.type === 'grid');
        for (const gridItem of gridItems) {
          if (gridItem.photoCount && gridItem.photoCount > 0) {
            const expectedRows = Math.ceil(gridItem.photoCount / itemsPerRow);
            const expectedHeight =
              expectedRows * (snapshot.config.thumbnailSize + snapshot.config.thumbnailPadding);
            expect(gridItem.height).toBe(expectedHeight);
          }
        }
      }
    });
  });

  describe('Accessibility Layout Consistency', () => {
    it('should maintain consistent focus order in layout', () => {
      const files = Array.from({ length: 15 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, Math.floor(i / 5), (i % 5) + 1)),
      );

      const engine = new CalendarLayoutEngine();
      engine.calculateLayout(files);
      const snapshot = captureLayoutSnapshot(engine);

      // Items should be in logical reading order (top to bottom)
      for (let i = 1; i < snapshot.items.length; i++) {
        expect(snapshot.items[i].top).toBeGreaterThanOrEqual(snapshot.items[i - 1].top);
      }

      // Headers should come before their corresponding grids
      const monthIds = new Set(snapshot.items.map((item) => item.monthId));

      for (const monthId of monthIds) {
        const headerIndex = snapshot.items.findIndex(
          (item) => item.type === 'header' && item.monthId === monthId,
        );
        const gridIndex = snapshot.items.findIndex(
          (item) => item.type === 'grid' && item.monthId === monthId,
        );

        expect(headerIndex).toBeLessThan(gridIndex);
        expect(snapshot.items[headerIndex].top).toBeLessThan(snapshot.items[gridIndex].top);
      }
    });

    it('should provide consistent spacing for screen readers', () => {
      const files = Array.from({ length: 8 }, (_, i) =>
        createMockFile(`file-${i}`, new Date(2024, 5, i + 1)),
      );

      const engine = new CalendarLayoutEngine();
      engine.calculateLayout(files);
      const snapshot = captureLayoutSnapshot(engine);

      // Headers should have consistent height
      const headerItems = snapshot.items.filter((item) => item.type === 'header');
      const headerHeight = headerItems[0].height;

      for (const header of headerItems) {
        expect(header.height).toBe(headerHeight);
      }

      // Grid items should have predictable heights based on content
      const gridItems = snapshot.items.filter((item) => item.type === 'grid');

      for (const grid of gridItems) {
        if (grid.photoCount && grid.photoCount > 0) {
          const itemsPerRow = engine.calculateItemsPerRow();
          const expectedRows = Math.ceil(grid.photoCount / itemsPerRow);
          const expectedHeight =
            expectedRows * (snapshot.config.thumbnailSize + snapshot.config.thumbnailPadding);

          expect(grid.height).toBe(expectedHeight);
        }
      }
    });
  });
});
