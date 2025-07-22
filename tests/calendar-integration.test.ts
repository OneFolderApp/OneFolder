import { CalendarLayoutEngine } from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import { groupFilesByMonth } from '../src/frontend/containers/ContentView/calendar/dateUtils';
import { MonthGroup } from '../src/frontend/containers/ContentView/calendar/types';
import { ClientFile } from '../src/frontend/entities/File';

// Helper function to create mock ClientFile
const createMockFile = (id: string, name: string, dateCreated: Date): Partial<ClientFile> => ({
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

describe('Calendar Integration Tests', () => {
  describe('End-to-End Virtualization Flow', () => {
    it('should process files through complete virtualization pipeline', () => {
      // Create test files spanning multiple months
      const files = [
        createMockFile('1', 'photo1.jpg', new Date(2024, 5, 15)), // June 2024
        createMockFile('2', 'photo2.jpg', new Date(2024, 5, 20)), // June 2024
        createMockFile('3', 'photo3.jpg', new Date(2024, 4, 10)), // May 2024
        createMockFile('4', 'photo4.jpg', new Date(2024, 4, 25)), // May 2024
        createMockFile('5', 'photo5.jpg', new Date(2024, 3, 5)), // April 2024
        createMockFile('6', 'photo6.jpg', new Date(2023, 11, 25)), // December 2023
      ] as ClientFile[];

      // Step 1: Group files by month
      const monthGroups = groupFilesByMonth(files);
      expect(monthGroups).toHaveLength(4); // June, May, April, December

      // Verify grouping order (newest first)
      expect(monthGroups[0].year).toBe(2024);
      expect(monthGroups[0].month).toBe(5); // June
      expect(monthGroups[1].month).toBe(4); // May
      expect(monthGroups[2].month).toBe(3); // April
      expect(monthGroups[3].year).toBe(2023);
      expect(monthGroups[3].month).toBe(11); // December

      // Step 2: Calculate layout with layout engine
      const layoutEngine = new CalendarLayoutEngine({
        containerWidth: 800,
        thumbnailSize: 160,
        thumbnailPadding: 8,
        headerHeight: 48,
        groupMargin: 24,
      });

      const layoutItems = layoutEngine.calculateLayout(monthGroups);
      expect(layoutItems).toHaveLength(8); // 4 headers + 4 grids

      // Verify layout structure
      expect(layoutItems[0].type).toBe('header');
      expect(layoutItems[1].type).toBe('grid');
      expect(layoutItems[1].photos).toHaveLength(2); // June has 2 photos

      // Step 3: Test virtualization with different viewport positions
      const totalHeight = layoutEngine.getTotalHeight();
      expect(totalHeight).toBeGreaterThan(0);

      // Test viewport at top
      const topRange = layoutEngine.findVisibleItems(0, 400, 1);
      expect(topRange.startIndex).toBe(0);
      expect(topRange.totalItems).toBe(8);

      // Test viewport in middle
      const middleScrollPos = totalHeight / 2;
      const middleRange = layoutEngine.findVisibleItems(middleScrollPos, 400, 1);
      expect(middleRange.startIndex).toBeGreaterThan(0);
      expect(middleRange.endIndex).toBeLessThan(8);

      // Step 4: Verify scroll position calculations
      const juneScrollPos = layoutEngine.getScrollPositionForMonth('2024-06');
      const mayScrollPos = layoutEngine.getScrollPositionForMonth('2024-05');

      expect(juneScrollPos).toBe(0); // First month at top
      expect(mayScrollPos).toBeGreaterThan(juneScrollPos); // May below June
    });

    it('should handle large collection virtualization efficiently', () => {
      // Create a large collection spanning many months
      const files: Partial<ClientFile>[] = [];

      // Generate 1000 files across 24 months
      for (let monthOffset = 0; monthOffset < 24; monthOffset++) {
        const year = 2024 - Math.floor(monthOffset / 12);
        const month = 11 - (monthOffset % 12); // Start from December, go back

        for (let photoIndex = 0; photoIndex < 42; photoIndex++) {
          // ~42 photos per month
          files.push(
            createMockFile(
              `${monthOffset}-${photoIndex}`,
              `photo_${monthOffset}_${photoIndex}.jpg`,
              new Date(year, month, photoIndex + 1),
            ),
          );
        }
      }

      expect(files).toHaveLength(1008); // 24 * 42

      // Group files by month
      const startGroupTime = performance.now();
      const monthGroups = groupFilesByMonth(files as ClientFile[]);
      const groupTime = performance.now() - startGroupTime;

      expect(monthGroups.length).toBeGreaterThanOrEqual(23);
      expect(monthGroups.length).toBeLessThanOrEqual(25); // Allow for slight variation in date handling
      expect(groupTime).toBeLessThan(50); // Grouping should be fast

      // Calculate layout
      const layoutEngine = new CalendarLayoutEngine({
        containerWidth: 1200,
        thumbnailSize: 160,
        thumbnailPadding: 8,
        headerHeight: 48,
        groupMargin: 24,
      });

      const startLayoutTime = performance.now();
      const layoutItems = layoutEngine.calculateLayout(monthGroups);
      const layoutTime = performance.now() - startLayoutTime;

      expect(layoutItems.length).toBeGreaterThanOrEqual(46); // Should be close to 24 headers + 24 grids
      expect(layoutItems.length).toBeLessThanOrEqual(50);
      expect(layoutTime).toBeLessThan(100); // Layout calculation should be fast

      // Test virtualization performance
      const totalHeight = layoutEngine.getTotalHeight();
      expect(totalHeight).toBeGreaterThan(10000); // Should be tall with many photos

      // Test multiple viewport calculations (simulating scrolling)
      const startVirtualTime = performance.now();
      for (let i = 0; i < 100; i++) {
        const scrollPos = (totalHeight / 100) * i;
        const range = layoutEngine.findVisibleItems(scrollPos, 600, 2);

        // Each range should be reasonable
        expect(range.startIndex).toBeGreaterThanOrEqual(0);
        expect(range.endIndex).toBeLessThan(layoutItems.length);
        expect(range.totalItems).toBe(layoutItems.length);
      }
      const virtualTime = performance.now() - startVirtualTime;

      expect(virtualTime).toBeLessThan(100); // 100 viewport calculations should be fast
    });

    it('should maintain consistency across configuration changes', () => {
      // Create test data
      const files = Array.from({ length: 50 }, (_, i) =>
        createMockFile(
          `photo-${i}`,
          `photo_${i}.jpg`,
          new Date(2024, Math.floor(i / 10), (i % 10) + 1), // Spread across 5 months
        ),
      ) as ClientFile[];

      const monthGroups = groupFilesByMonth(files);
      expect(monthGroups).toHaveLength(5);

      const layoutEngine = new CalendarLayoutEngine();

      // Test with different container widths
      const widths = [600, 800, 1200, 1600];
      const results = widths.map((width) => {
        layoutEngine.updateConfig({ containerWidth: width });
        const layoutItems = layoutEngine.calculateLayout(monthGroups);
        const totalHeight = layoutEngine.getTotalHeight();
        const itemsPerRow = layoutEngine.calculateItemsPerRow();

        return { width, layoutItems: layoutItems.length, totalHeight, itemsPerRow };
      });

      // Verify that wider containers fit more items per row
      expect(results[1].itemsPerRow).toBeGreaterThan(results[0].itemsPerRow); // 800 > 600
      expect(results[2].itemsPerRow).toBeGreaterThan(results[1].itemsPerRow); // 1200 > 800
      expect(results[3].itemsPerRow).toBeGreaterThan(results[2].itemsPerRow); // 1600 > 1200

      // All should have same number of layout items (structure unchanged)
      results.forEach((result) => {
        expect(result.layoutItems).toBe(10); // 5 headers + 5 grids
      });

      // Total height should generally decrease with wider containers (fewer rows needed)
      expect(results[3].totalHeight).toBeLessThan(results[0].totalHeight);
    });

    it('should handle edge cases in virtualization pipeline', () => {
      const layoutEngine = new CalendarLayoutEngine();

      // Test with empty collection
      const emptyGroups: MonthGroup[] = [];
      const emptyLayout = layoutEngine.calculateLayout(emptyGroups);
      expect(emptyLayout).toHaveLength(0);
      expect(layoutEngine.getTotalHeight()).toBe(0);

      const emptyRange = layoutEngine.findVisibleItems(0, 400);
      expect(emptyRange.startIndex).toBe(0);
      expect(emptyRange.endIndex).toBe(0);
      expect(emptyRange.totalItems).toBe(0);

      // Test with single photo
      const singleFile = [createMockFile('1', 'single.jpg', new Date(2024, 5, 15))] as ClientFile[];
      const singleGroups = groupFilesByMonth(singleFile);
      expect(singleGroups).toHaveLength(1);

      const singleLayout = layoutEngine.calculateLayout(singleGroups);
      expect(singleLayout).toHaveLength(2); // 1 header + 1 grid

      // Test with photos having invalid dates
      const mixedFiles = [
        createMockFile('1', 'valid.jpg', new Date(2024, 5, 15)),
        createMockFile('2', 'invalid.jpg', new Date('invalid')),
        createMockFile('3', 'future.jpg', new Date(2030, 0, 1)), // Far future
        createMockFile('4', 'past.jpg', new Date(1800, 0, 1)), // Far past
      ] as ClientFile[];

      const mixedGroups = groupFilesByMonth(mixedFiles);

      // Should handle invalid dates gracefully
      expect(mixedGroups.length).toBeGreaterThan(0);

      // Should be able to calculate layout even with edge case dates
      const mixedLayout = layoutEngine.calculateLayout(mixedGroups);
      expect(mixedLayout.length).toBeGreaterThan(0);
    });

    it('should support scroll position persistence scenarios', () => {
      // Simulate scenario where user scrolls, switches views, then returns
      const files = Array.from({ length: 100 }, (_, i) =>
        createMockFile(
          `photo-${i}`,
          `photo_${i}.jpg`,
          new Date(2024, Math.floor(i / 20), (i % 20) + 1), // 5 months, 20 photos each
        ),
      ) as ClientFile[];

      const monthGroups = groupFilesByMonth(files);
      const layoutEngine = new CalendarLayoutEngine({
        containerWidth: 800,
        thumbnailSize: 160,
      });

      const layoutItems = layoutEngine.calculateLayout(monthGroups);
      const totalHeight = layoutEngine.getTotalHeight();

      // Simulate user scrolling to middle of content
      const middleScrollPos = totalHeight * 0.6;
      const visibleRange = layoutEngine.findVisibleItems(middleScrollPos, 400, 2);

      // Should be able to restore this scroll position
      expect(visibleRange.startIndex).toBeGreaterThan(0);
      expect(visibleRange.endIndex).toBeLessThanOrEqual(layoutItems.length - 1);

      // Test scroll to specific month
      const thirdMonthId = monthGroups[2].id;
      const thirdMonthScrollPos = layoutEngine.getScrollPositionForMonth(thirdMonthId);

      expect(thirdMonthScrollPos).toBeGreaterThan(0);
      expect(thirdMonthScrollPos).toBeLessThan(totalHeight);

      // Verify that scrolling to that position shows the correct month
      const thirdMonthRange = layoutEngine.findVisibleItems(thirdMonthScrollPos, 400, 0);
      const firstVisibleItem = layoutEngine.getLayoutItem(thirdMonthRange.startIndex);

      expect(firstVisibleItem).toBeDefined();
      expect(firstVisibleItem?.monthGroup.id).toBe(thirdMonthId);
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance requirements for large collections', () => {
      // Test with collection size that represents real-world usage
      const largeFiles = Array.from({ length: 5000 }, (_, i) => {
        // Distribute across 60 months (5 years)
        const monthOffset = Math.floor(i / 83); // ~83 photos per month
        const date = new Date(2024, 11 - (monthOffset % 12), (i % 28) + 1);

        return createMockFile(`photo-${i}`, `photo_${i}.jpg`, date);
      }) as ClientFile[];

      // Benchmark grouping
      const groupStart = performance.now();
      const monthGroups = groupFilesByMonth(largeFiles);
      const groupTime = performance.now() - groupStart;

      expect(groupTime).toBeLessThan(200); // Should group 5000 files in under 200ms
      expect(monthGroups.length).toBeGreaterThan(10); // Should create multiple month groups

      // Benchmark layout calculation
      const layoutEngine = new CalendarLayoutEngine({
        containerWidth: 1200,
        thumbnailSize: 160,
      });

      const layoutStart = performance.now();
      const layoutItems = layoutEngine.calculateLayout(monthGroups);
      const layoutTime = performance.now() - layoutStart;

      expect(layoutTime).toBeLessThan(300); // Should calculate layout in under 300ms
      expect(layoutItems.length).toBe(monthGroups.length * 2); // Headers + grids

      // Benchmark virtualization queries
      const totalHeight = layoutEngine.getTotalHeight();
      const queryStart = performance.now();

      // Simulate 200 scroll events (heavy scrolling scenario)
      for (let i = 0; i < 200; i++) {
        const scrollPos = (totalHeight / 200) * i;
        layoutEngine.findVisibleItems(scrollPos, 600, 2);
      }

      const queryTime = performance.now() - queryStart;
      expect(queryTime).toBeLessThan(100); // 200 queries should complete in under 100ms

      // Average query time should be very fast
      const avgQueryTime = queryTime / 200;
      expect(avgQueryTime).toBeLessThan(0.5); // Each query should be under 0.5ms
    });
  });
});
