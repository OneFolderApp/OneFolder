import {
  CalendarLayoutEngine,
  DEFAULT_LAYOUT_CONFIG,
} from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import {
  MonthGroup,
  CalendarLayoutConfig,
} from '../src/frontend/containers/ContentView/calendar/types';
import { ClientFile } from '../src/frontend/entities/File';

// Mock ClientFile for testing
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
});

// Mock MonthGroup for testing
const createMockMonthGroup = (
  year: number,
  month: number,
  photoCount: number,
  displayName?: string,
): MonthGroup => ({
  year,
  month,
  photos: Array.from({ length: photoCount }, (_, i) =>
    createMockFile(`${year}-${month}-${i}`, new Date(year, month, i + 1)),
  ) as ClientFile[],
  displayName: displayName || `${year}-${month}`,
  id: `${year}-${String(month + 1).padStart(2, '0')}`,
});

describe('CalendarLayoutEngine', () => {
  let engine: CalendarLayoutEngine;

  beforeEach(() => {
    engine = new CalendarLayoutEngine();
  });

  describe('constructor and configuration', () => {
    it('should use default configuration', () => {
      expect(engine.calculateItemsPerRow()).toBe(
        Math.max(
          1,
          Math.floor(
            (DEFAULT_LAYOUT_CONFIG.containerWidth - DEFAULT_LAYOUT_CONFIG.thumbnailPadding) /
              (DEFAULT_LAYOUT_CONFIG.thumbnailSize + DEFAULT_LAYOUT_CONFIG.thumbnailPadding),
          ),
        ),
      );
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<CalendarLayoutConfig> = {
        containerWidth: 1200,
        thumbnailSize: 200,
      };
      const customEngine = new CalendarLayoutEngine(customConfig);

      // Should use custom values
      const itemsPerRow = Math.max(
        1,
        Math.floor(
          (1200 - DEFAULT_LAYOUT_CONFIG.thumbnailPadding) /
            (200 + DEFAULT_LAYOUT_CONFIG.thumbnailPadding),
        ),
      );
      expect(customEngine.calculateItemsPerRow()).toBe(itemsPerRow);
    });

    it('should update configuration', () => {
      const newConfig = { containerWidth: 1000, thumbnailSize: 180 };
      engine.updateConfig(newConfig);

      const expectedItemsPerRow = Math.max(
        1,
        Math.floor(
          (1000 - DEFAULT_LAYOUT_CONFIG.thumbnailPadding) /
            (180 + DEFAULT_LAYOUT_CONFIG.thumbnailPadding),
        ),
      );
      expect(engine.calculateItemsPerRow()).toBe(expectedItemsPerRow);
    });
  });

  describe('calculateItemsPerRow', () => {
    it('should calculate correct items per row', () => {
      engine.updateConfig({ containerWidth: 800, thumbnailSize: 160, thumbnailPadding: 8 });
      // (800 - 8) / (160 + 8) = 792 / 168 = 4.71... = 4
      expect(engine.calculateItemsPerRow()).toBe(4);
    });

    it('should return at least 1 item per row', () => {
      engine.updateConfig({ containerWidth: 100, thumbnailSize: 200 });
      expect(engine.calculateItemsPerRow()).toBe(1);
    });

    it('should handle exact fit', () => {
      engine.updateConfig({ containerWidth: 344, thumbnailSize: 160, thumbnailPadding: 8 });
      // (344 - 8) / (160 + 8) = 336 / 168 = 2
      expect(engine.calculateItemsPerRow()).toBe(2);
    });
  });

  describe('calculateLayout with MonthGroups', () => {
    it('should calculate layout for single month group', () => {
      const monthGroups = [createMockMonthGroup(2024, 5, 6)]; // 6 photos
      const layoutItems = engine.calculateLayout(monthGroups);

      expect(layoutItems).toHaveLength(2); // header + grid

      // Header item
      expect(layoutItems[0].type).toBe('header');
      expect(layoutItems[0].top).toBe(0);
      expect(layoutItems[0].height).toBe(DEFAULT_LAYOUT_CONFIG.headerHeight);

      // Grid item
      expect(layoutItems[1].type).toBe('grid');
      expect(layoutItems[1].top).toBe(DEFAULT_LAYOUT_CONFIG.headerHeight);
      expect(layoutItems[1].photos).toHaveLength(6);
    });

    it('should calculate layout for multiple month groups', () => {
      const monthGroups = [
        createMockMonthGroup(2024, 5, 4), // 4 photos
        createMockMonthGroup(2024, 4, 8), // 8 photos
      ];
      const layoutItems = engine.calculateLayout(monthGroups);

      expect(layoutItems).toHaveLength(4); // 2 headers + 2 grids

      // First group
      expect(layoutItems[0].type).toBe('header');
      expect(layoutItems[0].top).toBe(0);
      expect(layoutItems[1].type).toBe('grid');
      expect(layoutItems[1].top).toBe(DEFAULT_LAYOUT_CONFIG.headerHeight);

      // Second group should start after first group + margin
      const firstGroupHeight = DEFAULT_LAYOUT_CONFIG.headerHeight + layoutItems[1].height;
      const secondGroupStart = firstGroupHeight + DEFAULT_LAYOUT_CONFIG.groupMargin;

      expect(layoutItems[2].type).toBe('header');
      expect(layoutItems[2].top).toBe(secondGroupStart);
      expect(layoutItems[3].type).toBe('grid');
      expect(layoutItems[3].top).toBe(secondGroupStart + DEFAULT_LAYOUT_CONFIG.headerHeight);
    });

    it('should handle empty month groups', () => {
      const monthGroups = [createMockMonthGroup(2024, 5, 0)]; // 0 photos
      const layoutItems = engine.calculateLayout(monthGroups);

      expect(layoutItems).toHaveLength(2);
      expect(layoutItems[1].height).toBe(0); // Grid with no photos should have 0 height
    });

    it('should calculate correct grid heights', () => {
      engine.updateConfig({ containerWidth: 800, thumbnailSize: 160, thumbnailPadding: 8 });
      // 4 items per row with this config

      const monthGroups = [
        createMockMonthGroup(2024, 5, 9), // 9 photos = 3 rows (4+4+1)
      ];
      const layoutItems = engine.calculateLayout(monthGroups);

      const expectedRows = Math.ceil(9 / 4); // 3 rows
      const expectedHeight = expectedRows * (160 + 8); // 3 * 168 = 504

      expect(layoutItems[1].height).toBe(expectedHeight);
    });
  });

  describe('calculateLayout with ClientFiles', () => {
    it('should group files and calculate layout', () => {
      const files = [
        createMockFile('1', new Date(2024, 5, 15)),
        createMockFile('2', new Date(2024, 5, 20)),
        createMockFile('3', new Date(2024, 4, 10)),
      ] as ClientFile[];

      const layoutItems = engine.calculateLayout(files);

      // Should create 2 month groups (June and May 2024)
      expect(layoutItems).toHaveLength(4); // 2 headers + 2 grids

      // First group should be June (newer)
      expect(layoutItems[0].monthGroup.month).toBe(5); // June
      expect(layoutItems[0].monthGroup.year).toBe(2024);
      expect(layoutItems[1].photos).toHaveLength(2);

      // Second group should be May
      expect(layoutItems[2].monthGroup.month).toBe(4); // May
      expect(layoutItems[2].monthGroup.year).toBe(2024);
      expect(layoutItems[3].photos).toHaveLength(1);
    });
  });

  describe('findVisibleItems', () => {
    beforeEach(() => {
      // Set up a layout with known dimensions
      engine.updateConfig({
        containerWidth: 800,
        thumbnailSize: 160,
        thumbnailPadding: 8,
        headerHeight: 48,
        groupMargin: 24,
      });

      const monthGroups = [
        createMockMonthGroup(2024, 5, 8), // 8 photos = 2 rows
        createMockMonthGroup(2024, 4, 4), // 4 photos = 1 row
      ];
      engine.calculateLayout(monthGroups);
    });

    it('should find visible items in viewport', () => {
      const visibleRange = engine.findVisibleItems(0, 200, 0); // No overscan

      expect(visibleRange.startIndex).toBe(0);
      expect(visibleRange.totalItems).toBe(4);
      expect(visibleRange.endIndex).toBeGreaterThanOrEqual(0);
    });

    it('should apply overscan correctly', () => {
      const visibleRange = engine.findVisibleItems(100, 200, 1);

      expect(visibleRange.startIndex).toBeGreaterThanOrEqual(0);
      expect(visibleRange.endIndex).toBeLessThan(4);
      expect(visibleRange.totalItems).toBe(4);
    });

    it('should handle empty layout', () => {
      const emptyEngine = new CalendarLayoutEngine();
      const visibleRange = emptyEngine.findVisibleItems(0, 200);

      expect(visibleRange.startIndex).toBe(0);
      expect(visibleRange.endIndex).toBe(0);
      expect(visibleRange.totalItems).toBe(0);
    });

    it('should clamp overscan to valid bounds', () => {
      const visibleRange = engine.findVisibleItems(0, 50, 10); // Large overscan

      expect(visibleRange.startIndex).toBe(0);
      expect(visibleRange.endIndex).toBeLessThanOrEqual(3); // Max index
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      const monthGroups = [createMockMonthGroup(2024, 5, 4), createMockMonthGroup(2024, 4, 6)];
      engine.calculateLayout(monthGroups);
    });

    it('should get total height', () => {
      const totalHeight = engine.getTotalHeight();
      expect(totalHeight).toBeGreaterThan(0);
    });

    it('should get layout items', () => {
      const items = engine.getLayoutItems();
      expect(items).toHaveLength(4);
    });

    it('should get layout item by index', () => {
      const item = engine.getLayoutItem(0);
      expect(item).toBeDefined();
      expect(item!.type).toBe('header');

      const invalidItem = engine.getLayoutItem(10);
      expect(invalidItem).toBeUndefined();
    });

    it('should find item at position', () => {
      const item = engine.findItemAtPosition(0);
      expect(item).toBeDefined();
      expect(item!.type).toBe('header');

      const noItem = engine.findItemAtPosition(10000);
      expect(noItem).toBeUndefined();
    });

    it('should get scroll position for month', () => {
      const scrollPos = engine.getScrollPositionForMonth('2024-06');
      expect(scrollPos).toBe(0); // First header starts at 0

      const invalidScrollPos = engine.getScrollPositionForMonth('invalid-id');
      expect(invalidScrollPos).toBe(0);
    });
  });

  describe('binary search edge cases', () => {
    it('should handle single item layout', () => {
      const monthGroups = [createMockMonthGroup(2024, 5, 1)];
      engine.calculateLayout(monthGroups);

      const visibleRange = engine.findVisibleItems(0, 100);
      expect(visibleRange.startIndex).toBe(0);
      expect(visibleRange.totalItems).toBe(2);
    });

    it('should handle scroll position beyond content', () => {
      const monthGroups = [createMockMonthGroup(2024, 5, 4)];
      engine.calculateLayout(monthGroups);

      const totalHeight = engine.getTotalHeight();
      const visibleRange = engine.findVisibleItems(totalHeight + 100, 200);

      // Should still return valid range
      expect(visibleRange.startIndex).toBeGreaterThanOrEqual(0);
      expect(visibleRange.endIndex).toBeLessThan(visibleRange.totalItems);
    });
  });

  describe('performance and responsiveness', () => {
    it('should handle large collections efficiently', () => {
      // Create a large collection to test performance
      const largeMonthGroups = Array.from(
        { length: 50 },
        (_, i) => createMockMonthGroup(2024, i % 12, 20), // 50 months with 20 photos each
      );

      const startTime = performance.now();
      engine.calculateLayout(largeMonthGroups);
      const endTime = performance.now();

      // Layout calculation should complete quickly (under 100ms for 1000 photos)
      expect(endTime - startTime).toBeLessThan(100);
      expect(engine.getLayoutItems()).toHaveLength(100); // 50 headers + 50 grids
    });

    it('should recalculate layout efficiently when config changes', () => {
      const monthGroups = [createMockMonthGroup(2024, 5, 12), createMockMonthGroup(2024, 4, 8)];
      engine.calculateLayout(monthGroups);

      const originalItemsPerRow = engine.calculateItemsPerRow();

      // Change thumbnail size
      engine.updateConfig({ thumbnailSize: 120 });
      const newItemsPerRow = engine.calculateItemsPerRow();

      // Should recalculate and have different items per row
      expect(newItemsPerRow).not.toBe(originalItemsPerRow);
      expect(engine.getLayoutItems()).toHaveLength(4); // Should maintain same structure
    });

    it('should handle extreme container widths gracefully', () => {
      // Very narrow container
      engine.updateConfig({ containerWidth: 50, thumbnailSize: 160 });
      expect(engine.calculateItemsPerRow()).toBe(1);

      // Very wide container
      engine.updateConfig({ containerWidth: 5000, thumbnailSize: 160 });
      const itemsPerRow = engine.calculateItemsPerRow();
      expect(itemsPerRow).toBeGreaterThan(10);

      // Test layout calculation with extreme width
      const monthGroups = [createMockMonthGroup(2024, 5, 50)];
      const layoutItems = engine.calculateLayout(monthGroups);
      expect(layoutItems).toHaveLength(2);
      expect(layoutItems[1].height).toBeGreaterThan(0);
    });

    it('should respond to thumbnail size changes (requirement 4.4)', () => {
      const monthGroups = [createMockMonthGroup(2024, 5, 16)]; // 16 photos

      // Start with default thumbnail size
      engine.updateConfig({ containerWidth: 800, thumbnailSize: 160, thumbnailPadding: 8 });
      engine.calculateLayout(monthGroups);
      const originalHeight = engine.getLayoutItem(1)?.height;
      const originalItemsPerRow = engine.calculateItemsPerRow();

      // Change to smaller thumbnail size
      engine.updateConfig({ thumbnailSize: 120 });
      const newHeight = engine.getLayoutItem(1)?.height;
      const newItemsPerRow = engine.calculateItemsPerRow();

      // Should fit more items per row with smaller thumbnails
      expect(newItemsPerRow).toBeGreaterThan(originalItemsPerRow);
      // Grid height should be different (likely smaller due to fewer rows needed)
      expect(newHeight).not.toBe(originalHeight);

      // Change to larger thumbnail size
      engine.updateConfig({ thumbnailSize: 200 });
      const largeHeight = engine.getLayoutItem(1)?.height;
      const largeItemsPerRow = engine.calculateItemsPerRow();

      // Should fit fewer items per row with larger thumbnails
      expect(largeItemsPerRow).toBeLessThan(originalItemsPerRow);
      // Grid height should be larger due to more rows needed
      expect(largeHeight).toBeGreaterThan(originalHeight!);
    });
  });
});
