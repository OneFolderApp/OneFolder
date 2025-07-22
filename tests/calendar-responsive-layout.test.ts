import { CalendarLayoutEngine } from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import { MonthGroup } from '../src/frontend/containers/ContentView/calendar/types';
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

describe('Calendar Responsive Layout', () => {
  let layoutEngine: CalendarLayoutEngine;
  const mockMonthGroups: MonthGroup[] = [
    createMockMonthGroup(2024, 0, 20, 'January 2024'),
    createMockMonthGroup(2024, 1, 15, 'February 2024'),
  ];

  beforeEach(() => {
    layoutEngine = new CalendarLayoutEngine({
      containerWidth: 800,
      thumbnailSize: 160,
      thumbnailPadding: 8,
      headerHeight: 48,
      groupMargin: 24,
    });
  });

  describe('Responsive Grid Calculations', () => {
    it('should adapt to container width changes', () => {
      // Test narrow container
      layoutEngine.updateConfig({ containerWidth: 400, thumbnailSize: 160 });
      const narrowItemsPerRow = layoutEngine.calculateItemsPerRow();

      // Test wide container
      layoutEngine.updateConfig({ containerWidth: 1200, thumbnailSize: 160 });
      const wideItemsPerRow = layoutEngine.calculateItemsPerRow();

      expect(wideItemsPerRow).toBeGreaterThan(narrowItemsPerRow);
    });

    it('should respond to thumbnail size changes', () => {
      layoutEngine.updateConfig({ containerWidth: 800, thumbnailSize: 200 });
      const largeThumbItemsPerRow = layoutEngine.calculateItemsPerRow();

      layoutEngine.updateConfig({ containerWidth: 800, thumbnailSize: 120 });
      const smallThumbItemsPerRow = layoutEngine.calculateItemsPerRow();

      expect(smallThumbItemsPerRow).toBeGreaterThan(largeThumbItemsPerRow);
    });

    it('should provide responsive grid information', () => {
      const gridInfo = layoutEngine.getResponsiveGridInfo();

      expect(gridInfo.itemsPerRow).toBeGreaterThan(0);
      expect(gridInfo.effectiveItemSize).toBe(168); // 160 + 8 padding
      expect(gridInfo.gridWidth).toBeGreaterThan(0);
      expect(typeof gridInfo.hasHorizontalScroll).toBe('boolean');
    });

    it('should handle different screen sizes appropriately', () => {
      const screenSizes = [
        { width: 320, name: 'mobile portrait' },
        { width: 768, name: 'tablet' },
        { width: 1024, name: 'desktop' },
        { width: 1920, name: 'wide desktop' },
        { width: 2560, name: 'ultra-wide' },
      ];

      screenSizes.forEach(({ width }) => {
        layoutEngine.updateConfig({ containerWidth: width, thumbnailSize: 160 });
        const itemsPerRow = layoutEngine.calculateItemsPerRow();

        expect(itemsPerRow).toBeGreaterThan(0);
        expect(itemsPerRow).toBeLessThanOrEqual(15); // Max constraint

        // Verify layout can be calculated without errors
        const layoutItems = layoutEngine.calculateLayout(mockMonthGroups);
        expect(layoutItems.length).toBeGreaterThan(0);
      });
    });

    it('should apply maximum items per row constraints', () => {
      // Test very wide screen with small thumbnails
      layoutEngine.updateConfig({ containerWidth: 3000, thumbnailSize: 80 });
      const itemsPerRow = layoutEngine.calculateItemsPerRow();

      expect(itemsPerRow).toBeLessThanOrEqual(15); // Should not exceed max
    });

    it('should apply minimum items per row constraints', () => {
      // Test very narrow screen
      layoutEngine.updateConfig({ containerWidth: 200, thumbnailSize: 200 });
      const itemsPerRow = layoutEngine.calculateItemsPerRow();

      expect(itemsPerRow).toBeGreaterThanOrEqual(1); // Should have at least 1
    });
  });

  describe('Layout Recalculation', () => {
    it('should recalculate layout when configuration changes', () => {
      // Initial layout
      layoutEngine.calculateLayout(mockMonthGroups);
      const initialHeight = layoutEngine.getTotalHeight();
      const initialItemsPerRow = layoutEngine.calculateItemsPerRow();

      // Change container width significantly
      layoutEngine.updateConfig({ containerWidth: 1200 });

      // Layout should be recalculated automatically
      const newHeight = layoutEngine.getTotalHeight();
      const newItemsPerRow = layoutEngine.calculateItemsPerRow();

      expect(newItemsPerRow).not.toBe(initialItemsPerRow);
      expect(newHeight).not.toBe(initialHeight);
    });

    it('should handle rapid configuration changes', () => {
      const configurations = [
        { containerWidth: 600, thumbnailSize: 120 },
        { containerWidth: 800, thumbnailSize: 160 },
        { containerWidth: 1000, thumbnailSize: 180 },
        { containerWidth: 1200, thumbnailSize: 200 },
      ];

      configurations.forEach((config) => {
        layoutEngine.updateConfig(config);
        const itemsPerRow = layoutEngine.calculateItemsPerRow();
        const layoutItems = layoutEngine.calculateLayout(mockMonthGroups);

        expect(itemsPerRow).toBeGreaterThan(0);
        expect(layoutItems.length).toBeGreaterThan(0);
        expect(layoutEngine.getTotalHeight()).toBeGreaterThan(0);
      });
    });
  });
});
