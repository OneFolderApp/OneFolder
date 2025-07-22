/**
 * Comprehensive unit tests for calendar utility functions and data transformations
 * This test file covers all utility functions and edge cases not covered in existing tests
 */

import {
  formatMonthYear,
  createMonthGroupId,
  extractMonthYear,
  groupFilesByMonth,
  isReasonablePhotoDate,
  getSafeDateForGrouping,
  safeGroupFilesByMonth,
  validateMonthGroups,
  isValidMonthGroup,
} from '../src/frontend/containers/ContentView/calendar/dateUtils';
import {
  CalendarLayoutEngine,
  DEFAULT_LAYOUT_CONFIG,
} from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import { CalendarKeyboardNavigation } from '../src/frontend/containers/ContentView/calendar/keyboardNavigation';
import {
  MonthGroup,
  CalendarLayoutConfig,
} from '../src/frontend/containers/ContentView/calendar/types';
import { ClientFile } from '../src/frontend/entities/File';

// Mock ClientFile for testing
const createMockFile = (
  id: string,
  dateCreated: Date,
  dateModified?: Date,
  dateAdded?: Date,
  name: string = `file${id}.jpg`,
): Partial<ClientFile> => ({
  id: id as any,
  name,
  dateCreated,
  dateModified: dateModified || dateCreated,
  dateAdded: dateAdded || dateCreated,
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
  displayName:
    displayName || `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`,
  id: `${year}-${String(month + 1).padStart(2, '0')}`,
});

describe('Calendar Comprehensive Unit Tests', () => {
  describe('Date Utility Functions - Edge Cases', () => {
    describe('formatMonthYear edge cases', () => {
      it('should handle leap year February correctly', () => {
        expect(formatMonthYear(1, 2024)).toBe('February 2024'); // Leap year
        expect(formatMonthYear(1, 2023)).toBe('February 2023'); // Non-leap year
      });

      it('should handle year boundaries', () => {
        expect(formatMonthYear(0, 1900)).toBe('January 1900');
        expect(formatMonthYear(11, 2099)).toBe('December 2099');
        expect(formatMonthYear(5, 0)).toBe('June 0'); // Year 0 (edge case)
      });

      it('should handle negative years', () => {
        expect(formatMonthYear(0, -1)).toBe('January -1');
        expect(formatMonthYear(11, -2024)).toBe('December -2024');
      });
    });

    describe('createMonthGroupId edge cases', () => {
      it('should handle large years correctly', () => {
        expect(createMonthGroupId(0, 10000)).toBe('10000-01');
        expect(createMonthGroupId(11, 99999)).toBe('99999-12');
      });

      it('should handle negative years', () => {
        expect(createMonthGroupId(5, -100)).toBe('-100-06');
        expect(createMonthGroupId(0, -1)).toBe('-1-01');
      });
    });

    describe('extractMonthYear edge cases', () => {
      it('should handle timezone edge cases', () => {
        // Test with UTC dates
        const utcDate = new Date('2024-06-15T00:00:00.000Z');
        const result = extractMonthYear(utcDate);
        expect(result).toBeDefined();
        expect(result!.year).toBe(2024);
        // Month might vary based on local timezone, but should be valid
        expect(result!.month).toBeGreaterThanOrEqual(0);
        expect(result!.month).toBeLessThanOrEqual(11);
      });

      it('should handle daylight saving time transitions', () => {
        // Spring forward (March in most timezones)
        const springForward = new Date(2024, 2, 10, 2, 30); // 2:30 AM on DST transition
        const springResult = extractMonthYear(springForward);
        expect(springResult).toEqual({ month: 2, year: 2024 });

        // Fall back (November in most timezones)
        const fallBack = new Date(2024, 10, 3, 1, 30); // 1:30 AM on DST transition
        const fallResult = extractMonthYear(fallBack);
        expect(fallResult).toEqual({ month: 10, year: 2024 });
      });

      it('should handle extreme dates', () => {
        // Very old date
        const oldDate = new Date(1900, 0, 1);
        expect(extractMonthYear(oldDate)).toEqual({ month: 0, year: 1900 });

        // Very future date
        const futureDate = new Date(2100, 11, 31);
        expect(extractMonthYear(futureDate)).toEqual({ month: 11, year: 2100 });
      });
    });

    describe('isReasonablePhotoDate comprehensive tests', () => {
      it('should handle edge cases around reasonable date boundaries', () => {
        // Just before reasonable range
        expect(isReasonablePhotoDate(new Date(1839, 11, 31))).toBe(false);

        // Just at the start of reasonable range
        expect(isReasonablePhotoDate(new Date(1840, 0, 1))).toBe(true);

        // Just at the end of reasonable range
        const nextYear = new Date().getFullYear() + 1;
        expect(isReasonablePhotoDate(new Date(nextYear, 0, 1))).toBe(false);

        // Current year should be reasonable
        expect(isReasonablePhotoDate(new Date())).toBe(true);
      });

      it('should handle invalid date objects', () => {
        expect(isReasonablePhotoDate(new Date('not a date'))).toBe(false);
        expect(isReasonablePhotoDate(new Date(NaN))).toBe(false);
        expect(isReasonablePhotoDate(new Date(Infinity))).toBe(false);
        expect(isReasonablePhotoDate(new Date(-Infinity))).toBe(false);
      });

      it('should handle timezone-specific edge cases', () => {
        // Test with different timezone representations
        const utcDate = new Date('2024-01-01T00:00:00Z');
        const localDate = new Date(2024, 0, 1);
        const isoDate = new Date('2024-01-01T12:00:00.000Z');

        expect(isReasonablePhotoDate(utcDate)).toBe(true);
        expect(isReasonablePhotoDate(localDate)).toBe(true);
        expect(isReasonablePhotoDate(isoDate)).toBe(true);
      });
    });

    describe('getSafeDateForGrouping comprehensive tests', () => {
      it('should handle all date fields being null/undefined', () => {
        const file = {
          ...createMockFile('1', new Date()),
          dateCreated: null as any,
          dateModified: null as any,
          dateAdded: null as any,
        };

        const result = getSafeDateForGrouping(file as ClientFile);
        expect(result).toBeNull();
      });

      it('should handle mixed valid/invalid dates', () => {
        const file = createMockFile(
          '1',
          new Date('invalid'), // Invalid dateCreated
          new Date(1800, 0, 1), // Unreasonable dateModified
          new Date(2024, 5, 15), // Valid dateAdded
        );

        const result = getSafeDateForGrouping(file as ClientFile);
        expect(result).toEqual(new Date(2024, 5, 15));
      });

      it('should prioritize dateCreated when all dates are valid', () => {
        const dateCreated = new Date(2024, 5, 15);
        const dateModified = new Date(2024, 5, 16);
        const dateAdded = new Date(2024, 5, 17);

        const file = createMockFile('1', dateCreated, dateModified, dateAdded);

        const result = getSafeDateForGrouping(file as ClientFile);
        expect(result).toEqual(dateCreated);
      });

      it('should handle edge case dates around reasonable boundaries', () => {
        const file = createMockFile(
          '1',
          new Date(1839, 11, 31), // Just before reasonable range
          new Date(1840, 0, 1), // Just at reasonable range start
          new Date(2024, 5, 15), // Definitely reasonable
        );

        const result = getSafeDateForGrouping(file as ClientFile);
        expect(result).toEqual(new Date(1840, 0, 1)); // Should use dateModified
      });
    });
  });

  describe('Data Transformation Functions', () => {
    describe('groupFilesByMonth comprehensive tests', () => {
      it('should handle files with identical timestamps', () => {
        const sameDate = new Date(2024, 5, 15, 12, 0, 0);
        const files = [
          createMockFile('1', sameDate, undefined, undefined, 'file1.jpg'),
          createMockFile('2', sameDate, undefined, undefined, 'file2.jpg'),
          createMockFile('3', sameDate, undefined, undefined, 'file3.jpg'),
        ] as ClientFile[];

        const groups = groupFilesByMonth(files);

        expect(groups).toHaveLength(1);
        expect(groups[0].photos).toHaveLength(3);
        // Should maintain original order when dates are identical
        expect(groups[0].photos[0].name).toBe('file1.jpg');
        expect(groups[0].photos[1].name).toBe('file2.jpg');
        expect(groups[0].photos[2].name).toBe('file3.jpg');
      });

      it('should handle files spanning multiple years', () => {
        const files = [
          createMockFile('1', new Date(2022, 11, 31)), // Dec 2022
          createMockFile('2', new Date(2023, 0, 1)), // Jan 2023
          createMockFile('3', new Date(2023, 11, 31)), // Dec 2023
          createMockFile('4', new Date(2024, 0, 1)), // Jan 2024
        ] as ClientFile[];

        const groups = groupFilesByMonth(files);

        expect(groups).toHaveLength(4);
        // Should be sorted newest first
        expect(groups[0].year).toBe(2024);
        expect(groups[0].month).toBe(0);
        expect(groups[1].year).toBe(2023);
        expect(groups[1].month).toBe(11);
        expect(groups[2].year).toBe(2023);
        expect(groups[2].month).toBe(0);
        expect(groups[3].year).toBe(2022);
        expect(groups[3].month).toBe(11);
      });

      it('should handle large collections efficiently', () => {
        // Create a large collection spanning multiple years
        const files: ClientFile[] = [];
        const startTime = performance.now();

        for (let year = 2020; year <= 2024; year++) {
          for (let month = 0; month < 12; month++) {
            for (let day = 1; day <= 10; day++) {
              files.push(
                createMockFile(
                  `${year}-${month}-${day}`,
                  new Date(year, month, day),
                  undefined,
                  undefined,
                  `photo_${year}_${month}_${day}.jpg`,
                ) as ClientFile,
              );
            }
          }
        }

        const groupingStartTime = performance.now();
        const groups = groupFilesByMonth(files);
        const groupingTime = performance.now() - groupingStartTime;

        // Should complete grouping quickly even with 600 files
        expect(groupingTime).toBeLessThan(100); // Less than 100ms
        expect(groups).toHaveLength(60); // 5 years * 12 months
        expect(files.length).toBe(600); // 5 years * 12 months * 10 days

        // Verify sorting is correct
        expect(groups[0].year).toBe(2024);
        expect(groups[0].month).toBe(11); // December
        expect(groups[groups.length - 1].year).toBe(2020);
        expect(groups[groups.length - 1].month).toBe(0); // January
      });

      it('should handle mixed valid and invalid dates correctly', () => {
        const files = [
          createMockFile('1', new Date(2024, 5, 15), undefined, undefined, 'valid1.jpg'),
          createMockFile('2', new Date('invalid'), undefined, undefined, 'invalid1.jpg'),
          createMockFile('3', new Date(2024, 4, 10), undefined, undefined, 'valid2.jpg'),
          createMockFile('4', new Date(NaN), undefined, undefined, 'invalid2.jpg'),
          createMockFile('5', new Date(2024, 5, 20), undefined, undefined, 'valid3.jpg'),
        ] as ClientFile[];

        const groups = groupFilesByMonth(files);

        expect(groups).toHaveLength(3); // June 2024, May 2024, Unknown Date

        // Valid groups should be sorted newest first
        expect(groups[0].displayName).toBe('June 2024');
        expect(groups[0].photos).toHaveLength(2);
        expect(groups[1].displayName).toBe('May 2024');
        expect(groups[1].photos).toHaveLength(1);

        // Unknown date group should be last
        expect(groups[2].displayName).toBe('Unknown Date');
        expect(groups[2].photos).toHaveLength(2);
        expect(groups[2].photos[0].name).toBe('invalid1.jpg');
        expect(groups[2].photos[1].name).toBe('invalid2.jpg');
      });
    });

    describe('safeGroupFilesByMonth comprehensive tests', () => {
      it('should handle null and undefined input gracefully', () => {
        expect(safeGroupFilesByMonth(null as any)).toHaveLength(0);
        expect(safeGroupFilesByMonth(undefined as any)).toHaveLength(0);
      });

      it('should handle non-array input gracefully', () => {
        expect(safeGroupFilesByMonth('not an array' as any)).toHaveLength(0);
        expect(safeGroupFilesByMonth(123 as any)).toHaveLength(0);
        expect(safeGroupFilesByMonth({} as any)).toHaveLength(0);
      });

      it('should handle array with invalid file objects', () => {
        const invalidFiles = [
          null,
          undefined,
          'not a file',
          { id: 'valid', dateCreated: new Date(2024, 5, 15) },
          123,
        ] as any;

        // Should not throw and should handle valid items
        const groups = safeGroupFilesByMonth(invalidFiles);
        expect(groups).toHaveLength(1); // Should create fallback group
      });

      it('should create fallback group when grouping fails', () => {
        // Create files that will cause grouping to fail
        const problematicFiles = [
          { id: 'file1', dateCreated: new Date(2024, 5, 15) },
          { id: 'file2' }, // Missing dateCreated
        ] as any;

        const groups = safeGroupFilesByMonth(problematicFiles);

        // Should create a fallback group
        expect(groups).toHaveLength(1);
        expect(groups[0].displayName).toBe('Unknown Date');
        expect(groups[0].photos).toHaveLength(2);
      });
    });

    describe('validateMonthGroups comprehensive tests', () => {
      it('should filter out groups with invalid structure', () => {
        const mixedGroups = [
          createMockMonthGroup(2024, 5, 3), // Valid
          null, // Invalid
          undefined, // Invalid
          { year: 'invalid', month: 0, photos: [], displayName: 'Invalid', id: 'invalid' }, // Invalid year
          createMockMonthGroup(2024, 4, 2), // Valid
          { year: 2024, month: 15, photos: [], displayName: 'Invalid Month', id: '2024-15' }, // Invalid month
          {
            year: 2024,
            month: 3,
            photos: 'not an array',
            displayName: 'Invalid Photos',
            id: '2024-04',
          }, // Invalid photos
        ] as any;

        const validGroups = validateMonthGroups(mixedGroups);

        expect(validGroups).toHaveLength(2);
        expect(validGroups[0].year).toBe(2024);
        expect(validGroups[0].month).toBe(5);
        expect(validGroups[1].year).toBe(2024);
        expect(validGroups[1].month).toBe(4);
      });

      it('should handle empty and null arrays', () => {
        expect(validateMonthGroups([])).toHaveLength(0);
        expect(validateMonthGroups(null as any)).toHaveLength(0);
        expect(validateMonthGroups(undefined as any)).toHaveLength(0);
      });

      it('should preserve valid groups unchanged', () => {
        const validGroups = [
          createMockMonthGroup(2024, 5, 3),
          createMockMonthGroup(2024, 4, 2),
          createMockMonthGroup(2023, 11, 5),
        ];

        const result = validateMonthGroups(validGroups);

        expect(result).toHaveLength(3);
        expect(result).toEqual(validGroups);
      });
    });

    describe('isValidMonthGroup comprehensive tests', () => {
      it('should validate all required properties', () => {
        // Valid group
        const validGroup = createMockMonthGroup(2024, 5, 3);
        expect(isValidMonthGroup(validGroup)).toBe(true);

        // Missing properties
        expect(isValidMonthGroup(null as any)).toBe(false);
        expect(isValidMonthGroup(undefined as any)).toBe(false);
        expect(isValidMonthGroup({} as any)).toBe(false);

        // Invalid year
        expect(isValidMonthGroup({ ...validGroup, year: 'invalid' as any })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, year: null as any })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, year: NaN })).toBe(false);

        // Invalid month
        expect(isValidMonthGroup({ ...validGroup, month: -1 })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, month: 12 })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, month: 'invalid' as any })).toBe(false);

        // Invalid photos array
        expect(isValidMonthGroup({ ...validGroup, photos: null as any })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, photos: 'not array' as any })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, photos: undefined as any })).toBe(false);

        // Invalid displayName
        expect(isValidMonthGroup({ ...validGroup, displayName: null as any })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, displayName: undefined as any })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, displayName: 123 as any })).toBe(false);

        // Invalid id
        expect(isValidMonthGroup({ ...validGroup, id: null as any })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, id: undefined as any })).toBe(false);
        expect(isValidMonthGroup({ ...validGroup, id: 123 as any })).toBe(false);
      });

      it('should handle edge cases for month validation', () => {
        const baseGroup = createMockMonthGroup(2024, 5, 3);

        // Valid months
        for (let month = 0; month <= 11; month++) {
          expect(isValidMonthGroup({ ...baseGroup, month })).toBe(true);
        }

        // Invalid months
        expect(isValidMonthGroup({ ...baseGroup, month: -1 })).toBe(false);
        expect(isValidMonthGroup({ ...baseGroup, month: 12 })).toBe(false);
        expect(isValidMonthGroup({ ...baseGroup, month: 100 })).toBe(false);
        expect(isValidMonthGroup({ ...baseGroup, month: Infinity })).toBe(false);
        expect(isValidMonthGroup({ ...baseGroup, month: -Infinity })).toBe(false);
      });

      it('should handle edge cases for year validation', () => {
        const baseGroup = createMockMonthGroup(2024, 5, 3);

        // Valid years
        expect(isValidMonthGroup({ ...baseGroup, year: 1900 })).toBe(true);
        expect(isValidMonthGroup({ ...baseGroup, year: 2100 })).toBe(true);
        expect(isValidMonthGroup({ ...baseGroup, year: 0 })).toBe(true);
        expect(isValidMonthGroup({ ...baseGroup, year: -100 })).toBe(true);

        // Invalid years
        expect(isValidMonthGroup({ ...baseGroup, year: Infinity })).toBe(false);
        expect(isValidMonthGroup({ ...baseGroup, year: -Infinity })).toBe(false);
        expect(isValidMonthGroup({ ...baseGroup, year: NaN })).toBe(false);
      });
    });
  });

  describe('Layout Engine Comprehensive Tests', () => {
    let engine: CalendarLayoutEngine;

    beforeEach(() => {
      engine = new CalendarLayoutEngine();
    });

    describe('Configuration edge cases', () => {
      it('should handle extreme configuration values', () => {
        // Very small values
        engine.updateConfig({
          containerWidth: 1,
          thumbnailSize: 1,
          thumbnailPadding: 0,
          headerHeight: 1,
          groupMargin: 0,
        });

        expect(engine.calculateItemsPerRow()).toBe(1);

        // Very large values
        engine.updateConfig({
          containerWidth: 10000,
          thumbnailSize: 500,
          thumbnailPadding: 100,
          headerHeight: 200,
          groupMargin: 100,
        });

        const itemsPerRow = engine.calculateItemsPerRow();
        expect(itemsPerRow).toBeGreaterThan(0);
        expect(itemsPerRow).toBeLessThanOrEqual(15); // Should respect max items per row
      });

      it('should handle invalid configuration values gracefully', () => {
        // Negative values
        engine.updateConfig({
          containerWidth: -100,
          thumbnailSize: -50,
          thumbnailPadding: -10,
        });

        expect(engine.calculateItemsPerRow()).toBe(1); // Should fallback to 1

        // Zero values
        engine.updateConfig({
          containerWidth: 0,
          thumbnailSize: 0,
          thumbnailPadding: 0,
        });

        expect(engine.calculateItemsPerRow()).toBe(1); // Should fallback to 1

        // NaN values
        engine.updateConfig({
          containerWidth: NaN,
          thumbnailSize: NaN,
          thumbnailPadding: NaN,
        });

        expect(engine.calculateItemsPerRow()).toBe(1); // Should fallback to 1
      });
    });

    describe('Layout calculation edge cases', () => {
      it('should handle empty month groups', () => {
        const layoutItems = engine.calculateLayout([]);
        expect(layoutItems).toHaveLength(0);
        expect(engine.getTotalHeight()).toBe(0);
      });

      it('should handle month groups with no photos', () => {
        const emptyGroups = [createMockMonthGroup(2024, 5, 0), createMockMonthGroup(2024, 4, 0)];

        const layoutItems = engine.calculateLayout(emptyGroups);

        expect(layoutItems).toHaveLength(4); // 2 headers + 2 grids
        expect(layoutItems[1].height).toBe(0); // Grid with no photos
        expect(layoutItems[3].height).toBe(0); // Grid with no photos
      });

      it('should handle invalid month group data gracefully', () => {
        const invalidGroups = [
          null,
          undefined,
          { year: 'invalid' },
          createMockMonthGroup(2024, 5, 3), // Valid group
          { photos: 'not an array' },
        ] as any;

        // Should not throw and should process valid groups
        const layoutItems = engine.calculateLayout(invalidGroups);
        expect(layoutItems).toHaveLength(2); // Only the valid group should be processed
      });

      it('should handle extremely large photo counts', () => {
        const largeGroup = createMockMonthGroup(2024, 5, 10000);

        const layoutItems = engine.calculateLayout([largeGroup]);

        expect(layoutItems).toHaveLength(2);
        expect(layoutItems[1].height).toBeGreaterThan(0);
        expect(layoutItems[1].height).toBeLessThanOrEqual(50000); // Should respect max height
      });
    });

    describe('Binary search edge cases', () => {
      beforeEach(() => {
        const monthGroups = [
          createMockMonthGroup(2024, 5, 8),
          createMockMonthGroup(2024, 4, 4),
          createMockMonthGroup(2024, 3, 12),
        ];
        engine.calculateLayout(monthGroups);
      });

      it('should handle scroll position at exact item boundaries', () => {
        const layoutItems = engine.getLayoutItems();

        // Test at exact top of items
        for (const item of layoutItems) {
          const range = engine.findVisibleItems(item.top, 100);
          expect(range.startIndex).toBeGreaterThanOrEqual(0);
          expect(range.endIndex).toBeLessThan(layoutItems.length);
        }
      });

      it('should handle scroll position beyond content', () => {
        const totalHeight = engine.getTotalHeight();

        const range = engine.findVisibleItems(totalHeight + 1000, 200);
        expect(range.startIndex).toBeGreaterThanOrEqual(0);
        expect(range.endIndex).toBeLessThan(engine.getLayoutItems().length);
      });

      it('should handle negative scroll positions', () => {
        const range = engine.findVisibleItems(-100, 200);
        expect(range.startIndex).toBe(0);
        expect(range.endIndex).toBeGreaterThanOrEqual(0);
      });

      it('should handle zero viewport height', () => {
        const range = engine.findVisibleItems(0, 0);
        expect(range.startIndex).toBeGreaterThanOrEqual(0);
        expect(range.endIndex).toBeGreaterThanOrEqual(range.startIndex);
      });
    });

    describe('Responsive layout calculations', () => {
      it('should adapt to different screen sizes', () => {
        const screenSizes = [
          { width: 320, expectedMin: 1, expectedMax: 3 }, // Mobile
          { width: 768, expectedMin: 3, expectedMax: 6 }, // Tablet
          { width: 1024, expectedMin: 4, expectedMax: 8 }, // Desktop
          { width: 1920, expectedMin: 6, expectedMax: 12 }, // Large desktop
          { width: 3840, expectedMin: 8, expectedMax: 15 }, // 4K
        ];

        for (const { width, expectedMin, expectedMax } of screenSizes) {
          engine.updateConfig({ containerWidth: width, thumbnailSize: 160 });
          const itemsPerRow = engine.calculateItemsPerRow();

          expect(itemsPerRow).toBeGreaterThanOrEqual(expectedMin);
          expect(itemsPerRow).toBeLessThanOrEqual(expectedMax);
        }
      });

      it('should handle thumbnail size changes responsively', () => {
        engine.updateConfig({ containerWidth: 1000 });

        const thumbnailSizes = [80, 120, 160, 200, 240];
        let previousItemsPerRow = Infinity;

        for (const size of thumbnailSizes) {
          engine.updateConfig({ thumbnailSize: size });
          const itemsPerRow = engine.calculateItemsPerRow();

          // Larger thumbnails should fit fewer items per row
          expect(itemsPerRow).toBeLessThanOrEqual(previousItemsPerRow);
          previousItemsPerRow = itemsPerRow;
        }
      });
    });
  });

  describe('Keyboard Navigation Comprehensive Tests', () => {
    let engine: CalendarLayoutEngine;
    let navigation: CalendarKeyboardNavigation;
    let files: ClientFile[];
    let monthGroups: MonthGroup[];

    beforeEach(() => {
      engine = new CalendarLayoutEngine({ containerWidth: 800, thumbnailSize: 160 });

      // Create test data with multiple months
      files = [
        ...Array.from({ length: 8 }, (_, i) =>
          createMockFile(
            `june-${i}`,
            new Date(2024, 5, i + 1),
            undefined,
            undefined,
            `june${i}.jpg`,
          ),
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          createMockFile(`may-${i}`, new Date(2024, 4, i + 1), undefined, undefined, `may${i}.jpg`),
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          createMockFile(
            `april-${i}`,
            new Date(2024, 3, i + 1),
            undefined,
            undefined,
            `april${i}.jpg`,
          ),
        ),
      ] as ClientFile[];

      monthGroups = [
        {
          year: 2024,
          month: 5,
          photos: files.slice(0, 8),
          displayName: 'June 2024',
          id: '2024-06',
        },
        {
          year: 2024,
          month: 4,
          photos: files.slice(8, 14),
          displayName: 'May 2024',
          id: '2024-05',
        },
        {
          year: 2024,
          month: 3,
          photos: files.slice(14, 18),
          displayName: 'April 2024',
          id: '2024-04',
        },
      ];

      engine.calculateLayout(monthGroups);
      navigation = new CalendarKeyboardNavigation(engine, files, monthGroups);
    });

    describe('Navigation edge cases', () => {
      it('should handle navigation from first photo', () => {
        // First photo in first month
        expect(navigation.navigate(0, 'left')).toBeUndefined();
        expect(navigation.navigate(0, 'up')).toBeUndefined();
        expect(navigation.navigate(0, 'right')).toBeDefined();
        expect(navigation.navigate(0, 'down')).toBeDefined();
      });

      it('should handle navigation from last photo', () => {
        const lastIndex = files.length - 1;

        expect(navigation.navigate(lastIndex, 'right')).toBeUndefined();
        expect(navigation.navigate(lastIndex, 'down')).toBeUndefined();
        expect(navigation.navigate(lastIndex, 'left')).toBeDefined();
        expect(navigation.navigate(lastIndex, 'up')).toBeDefined();
      });

      it('should handle navigation between months', () => {
        const itemsPerRow = engine.calculateItemsPerRow();

        // Navigate right from last photo in first month
        const lastInFirstMonth = 7; // 8 photos, 0-indexed
        const firstInSecondMonth = navigation.navigate(lastInFirstMonth, 'right');
        expect(firstInSecondMonth).toBe(8); // First photo in May

        // Navigate left from first photo in second month
        const lastInPreviousMonth = navigation.navigate(8, 'left');
        expect(lastInPreviousMonth).toBe(7); // Last photo in June
      });

      it('should handle navigation with uneven rows', () => {
        // Test navigation in month with photos that don't fill complete rows
        const itemsPerRow = engine.calculateItemsPerRow();

        // Navigate down from a photo in the last incomplete row
        const aprilStartIndex = 14; // April photos start at index 14
        const lastRowFirstPhoto = aprilStartIndex; // April has 4 photos, so incomplete row

        const result = navigation.navigate(lastRowFirstPhoto, 'down');
        // Should either stay in same month or move to next month
        expect(result).toBeDefined();
      });

      it('should handle invalid global indices', () => {
        expect(navigation.navigate(-1, 'right')).toBeUndefined();
        expect(navigation.navigate(files.length, 'right')).toBeUndefined();
        expect(navigation.navigate(999, 'right')).toBeUndefined();
      });
    });

    describe('Position mapping edge cases', () => {
      it('should handle files not in month groups', () => {
        // Add a file that's not in any month group
        const orphanFile = createMockFile('orphan', new Date(2024, 6, 1)) as ClientFile;
        const filesWithOrphan = [...files, orphanFile];

        const navWithOrphan = new CalendarKeyboardNavigation(engine, filesWithOrphan, monthGroups);

        const position = navWithOrphan.getPositionByGlobalIndex(files.length);
        expect(position).toBeUndefined(); // Orphan file should not have position
      });

      it('should handle duplicate file IDs gracefully', () => {
        // Create files with duplicate IDs (edge case)
        const duplicateFiles = [
          createMockFile('duplicate', new Date(2024, 5, 1)),
          createMockFile('duplicate', new Date(2024, 5, 2)), // Same ID
        ] as ClientFile[];

        const duplicateGroups = [
          {
            year: 2024,
            month: 5,
            photos: duplicateFiles,
            displayName: 'June 2024',
            id: '2024-06',
          },
        ];

        engine.calculateLayout(duplicateGroups);
        const navWithDuplicates = new CalendarKeyboardNavigation(
          engine,
          duplicateFiles,
          duplicateGroups,
        );

        // Should handle gracefully without throwing
        const position1 = navWithDuplicates.getPositionByGlobalIndex(0);
        const position2 = navWithDuplicates.getPositionByGlobalIndex(1);

        expect(position1).toBeDefined();
        // Second file with same ID might not have position due to Map behavior
      });
    });

    describe('Scroll position calculations', () => {
      it('should calculate scroll positions for all photos', () => {
        for (let i = 0; i < files.length; i++) {
          const scrollPos = navigation.getScrollPositionForPhoto(i, 400);
          if (scrollPos !== undefined) {
            expect(scrollPos).toBeGreaterThanOrEqual(0);
            expect(typeof scrollPos).toBe('number');
            expect(isFinite(scrollPos)).toBe(true);
          }
        }
      });

      it('should handle invalid container heights', () => {
        const scrollPos1 = navigation.getScrollPositionForPhoto(0, 0);
        const scrollPos2 = navigation.getScrollPositionForPhoto(0, -100);
        const scrollPos3 = navigation.getScrollPositionForPhoto(0, NaN);

        expect(scrollPos1).toBeGreaterThanOrEqual(0);
        expect(scrollPos2).toBeGreaterThanOrEqual(0);
        expect(scrollPos3).toBeGreaterThanOrEqual(0);
      });
    });

    describe('Update functionality', () => {
      it('should handle updates with different file lists', () => {
        const newFiles = files.slice(0, 10); // Fewer files
        const newGroups = monthGroups.slice(0, 2); // Fewer groups

        navigation.update(newFiles, newGroups);

        // Should still work with reduced dataset
        expect(navigation.navigate(0, 'right')).toBeDefined();
        expect(navigation.navigate(9, 'left')).toBeDefined();
      });

      it('should handle updates with empty data', () => {
        navigation.update([], []);

        // Should handle gracefully
        expect(navigation.navigate(0, 'right')).toBeUndefined();
        expect(navigation.getPositionByGlobalIndex(0)).toBeUndefined();
      });
    });
  });
});
