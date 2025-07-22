import {
  safeGroupFilesByMonth,
  validateMonthGroups,
  isValidMonthGroup,
  getSafeDateForGrouping,
  isReasonablePhotoDate,
} from '../src/frontend/containers/ContentView/calendar/dateUtils';
import { ClientFile } from '../src/frontend/entities/File';
import { MonthGroup } from '../src/frontend/containers/ContentView/calendar/types';

// Mock ClientFile for testing
const createMockFile = (overrides: Partial<ClientFile> = {}): ClientFile => {
  const defaults = {
    id: 'test-id',
    ino: 'test-ino',
    locationId: 'test-location',
    relativePath: 'test.jpg',
    absolutePath: '/test/test.jpg',
    name: 'test.jpg',
    filename: 'test',
    extension: 'jpg' as const,
    size: 1000,
    width: 800,
    height: 600,
    dateCreated: new Date('2024-01-15'),
    dateModified: new Date('2024-01-15'),
    dateAdded: new Date('2024-01-15'),
    dateLastIndexed: new Date('2024-01-15'),
    annotations: '',
    thumbnailPath: '',
    tags: new Set(),
    isBroken: false,
  };

  return { ...defaults, ...overrides } as ClientFile;
};

describe('Calendar Empty and Error State Handling', () => {
  describe('Empty State Scenarios', () => {
    it('should handle empty file list gracefully', () => {
      const result = safeGroupFilesByMonth([]);
      expect(result).toEqual([]);
    });

    it('should handle files with all invalid dates (unknown date group)', () => {
      const files = [
        createMockFile({
          id: '1',
          name: 'invalid1.jpg',
          dateCreated: new Date('invalid'),
          dateModified: new Date('invalid'),
          dateAdded: new Date('invalid'),
        }),
        createMockFile({
          id: '2',
          name: 'invalid2.jpg',
          dateCreated: new Date('1800-01-01'), // Too old
          dateModified: new Date('2050-01-01'), // Too far in future
          dateAdded: new Date('invalid'),
        }),
      ];

      const result = safeGroupFilesByMonth(files);

      // Should have one unknown date group
      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Unknown Date');
      expect(result[0].id).toBe('unknown-date');
      expect(result[0].photos).toHaveLength(2);
      expect(result[0].photos[0].name).toBe('invalid1.jpg');
      expect(result[0].photos[1].name).toBe('invalid2.jpg');
    });

    it('should handle mixed valid and invalid dates', () => {
      const files = [
        createMockFile({
          id: '1',
          name: 'valid.jpg',
          dateCreated: new Date('2024-01-15'),
        }),
        createMockFile({
          id: '2',
          name: 'invalid.jpg',
          dateCreated: new Date('invalid'),
          dateModified: new Date('invalid'),
          dateAdded: new Date('invalid'),
        }),
      ];

      const result = safeGroupFilesByMonth(files);

      // Should have one valid group and one unknown date group
      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe('January 2024');
      expect(result[0].photos).toHaveLength(1);
      expect(result[1].displayName).toBe('Unknown Date');
      expect(result[1].photos).toHaveLength(1);
    });
  });

  describe('Error State Scenarios', () => {
    it('should handle corrupted file objects gracefully', () => {
      const corruptedFiles = [
        createMockFile({ id: '1', name: 'good.jpg' }),
        // Simulate corrupted file with missing properties
        { id: '2', name: 'corrupted.jpg' } as any,
        createMockFile({ id: '3', name: 'another-good.jpg' }),
      ];

      // Should not throw an error
      expect(() => {
        const result = safeGroupFilesByMonth(corruptedFiles);
        expect(Array.isArray(result)).toBe(true);
      }).not.toThrow();
    });

    it('should create fallback group when grouping completely fails', () => {
      // Mock a scenario where grouping fails by passing invalid data
      const invalidFiles = null as any;

      const result = safeGroupFilesByMonth(invalidFiles);

      // Should return fallback group
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('fallback-group');
      expect(result[0].displayName).toBe('All Photos (Fallback)');
    });

    it('should validate month groups and filter invalid ones', () => {
      const validGroup: MonthGroup = {
        year: 2024,
        month: 0,
        photos: [createMockFile()],
        displayName: 'January 2024',
        id: '2024-01',
      };

      const invalidGroups = [
        validGroup,
        { year: 'invalid', month: 0, photos: [], displayName: 'Invalid', id: 'invalid' } as any,
        { year: 2024, month: 15, photos: [], displayName: 'Invalid Month', id: '2024-15' } as any,
        null as any,
        undefined as any,
      ];

      const result = validateMonthGroups(invalidGroups);

      // Should only keep the valid group
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(validGroup);
    });

    it('should handle edge cases in date validation', () => {
      // Test various edge cases for date validation
      const currentYear = new Date().getFullYear();
      expect(isReasonablePhotoDate(new Date('2024-01-15T12:00:00Z'))).toBe(true);
      expect(isReasonablePhotoDate(new Date('1900-06-01T12:00:00Z'))).toBe(true);
      expect(isReasonablePhotoDate(new Date('1899-12-31T12:00:00Z'))).toBe(false); // Too old
      expect(isReasonablePhotoDate(new Date(`${currentYear + 15}-01-01T12:00:00Z`))).toBe(false); // Too far in future
      expect(isReasonablePhotoDate(new Date('invalid'))).toBe(false);
      expect(isReasonablePhotoDate(null as any)).toBe(false);
      expect(isReasonablePhotoDate(undefined as any)).toBe(false);
    });

    it('should handle fallback date selection correctly', () => {
      // Test file with invalid dateCreated but valid dateModified
      const file1 = createMockFile({
        dateCreated: new Date('invalid'),
        dateModified: new Date('2024-01-10'),
        dateAdded: new Date('2024-01-05'),
      });
      expect(getSafeDateForGrouping(file1)).toEqual(new Date('2024-01-10'));

      // Test file with invalid dateCreated and dateModified but valid dateAdded
      const file2 = createMockFile({
        dateCreated: new Date('1800-01-01'), // Too old
        dateModified: new Date('2050-01-01'), // Too far in future
        dateAdded: new Date('2024-01-05'),
      });
      expect(getSafeDateForGrouping(file2)).toEqual(new Date('2024-01-05'));

      // Test file with all invalid dates
      const file3 = createMockFile({
        dateCreated: new Date('invalid'),
        dateModified: new Date('invalid'),
        dateAdded: new Date('invalid'),
      });
      expect(getSafeDateForGrouping(file3)).toBeNull();
    });
  });

  describe('Loading State Scenarios', () => {
    it('should handle large collections efficiently', () => {
      // Create a large collection of files
      const largeFileList = Array.from({ length: 2000 }, (_, i) =>
        createMockFile({
          id: `file-${i}`,
          name: `photo-${i}.jpg`,
          dateCreated: new Date(2024, Math.floor(i / 100), (i % 30) + 1), // Spread across months
        }),
      );

      // Should not throw an error and should complete in reasonable time
      const startTime = Date.now();
      const result = safeGroupFilesByMonth(largeFileList);
      const endTime = Date.now();

      expect(result.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all files are accounted for
      const totalPhotos = result.reduce((sum, group) => sum + group.photos.length, 0);
      expect(totalPhotos).toBe(2000);
    });

    it('should handle files with identical dates correctly', () => {
      const sameDate = new Date('2024-01-15T10:30:00Z');
      const files = Array.from({ length: 100 }, (_, i) =>
        createMockFile({
          id: `file-${i}`,
          name: `photo-${i}.jpg`,
          dateCreated: sameDate,
        }),
      );

      const result = safeGroupFilesByMonth(files);

      // Should have one group with all files
      expect(result).toHaveLength(1);
      expect(result[0].photos).toHaveLength(100);
      expect(result[0].displayName).toBe('January 2024');
    });
  });

  describe('Graceful Degradation', () => {
    it('should handle month group validation edge cases', () => {
      // Test various invalid month group scenarios
      expect(isValidMonthGroup(null as any)).toBe(false);
      expect(isValidMonthGroup(undefined as any)).toBe(false);
      expect(isValidMonthGroup({} as any)).toBe(false);
      expect(isValidMonthGroup({ year: 2024 } as any)).toBe(false);
      expect(isValidMonthGroup({ year: 2024, month: 0 } as any)).toBe(false);
      expect(isValidMonthGroup({ year: 2024, month: 0, photos: [] } as any)).toBe(false);

      // Test valid special groups
      const unknownDateGroup: MonthGroup = {
        year: 0,
        month: 0,
        photos: [],
        displayName: 'Unknown Date',
        id: 'unknown-date',
      };
      expect(isValidMonthGroup(unknownDateGroup)).toBe(true);

      const fallbackGroup: MonthGroup = {
        year: 2024,
        month: 0,
        photos: [],
        displayName: 'All Photos (Fallback)',
        id: 'fallback-group',
      };
      expect(isValidMonthGroup(fallbackGroup)).toBe(true);
    });

    it('should sort unknown date files by filename when dates are unavailable', () => {
      const files = [
        createMockFile({
          id: '3',
          name: 'zzz-last.jpg',
          dateCreated: new Date('invalid'),
          dateModified: new Date('invalid'),
          dateAdded: new Date('invalid'),
        }),
        createMockFile({
          id: '1',
          name: 'aaa-first.jpg',
          dateCreated: new Date('invalid'),
          dateModified: new Date('invalid'),
          dateAdded: new Date('invalid'),
        }),
        createMockFile({
          id: '2',
          name: 'mmm-middle.jpg',
          dateCreated: new Date('invalid'),
          dateModified: new Date('invalid'),
          dateAdded: new Date('invalid'),
        }),
      ];

      const result = safeGroupFilesByMonth(files);

      expect(result).toHaveLength(1);
      expect(result[0].displayName).toBe('Unknown Date');
      expect(result[0].photos).toHaveLength(3);

      // Should be sorted by filename
      expect(result[0].photos[0].name).toBe('aaa-first.jpg');
      expect(result[0].photos[1].name).toBe('mmm-middle.jpg');
      expect(result[0].photos[2].name).toBe('zzz-last.jpg');
    });
  });

  describe('Progressive Loading', () => {
    it('should handle progressive loading for very large collections', async () => {
      const { progressiveGroupFilesByMonth } = await import(
        '../src/frontend/containers/ContentView/calendar/dateUtils'
      );

      // Create a large collection
      const largeFileList = Array.from({ length: 2500 }, (_, i) =>
        createMockFile({
          id: `file-${i}`,
          name: `photo-${i}.jpg`,
          dateCreated: new Date(2024, Math.floor(i / 100), (i % 30) + 1),
        }),
      );

      let progressCallCount = 0;
      let lastProcessed = 0;

      const result = await progressiveGroupFilesByMonth(largeFileList, 1000, (processed, total) => {
        progressCallCount++;
        lastProcessed = processed;
        expect(processed).toBeLessThanOrEqual(total);
        expect(total).toBe(2500);
      });

      // Should have called progress callback multiple times
      expect(progressCallCount).toBeGreaterThan(1);
      expect(lastProcessed).toBe(2500);

      // Should have grouped all files
      const totalPhotos = result.reduce((sum, group) => sum + group.photos.length, 0);
      expect(totalPhotos).toBe(2500);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should fall back to regular grouping for small collections', async () => {
      const { progressiveGroupFilesByMonth } = await import(
        '../src/frontend/containers/ContentView/calendar/dateUtils'
      );

      const smallFileList = Array.from({ length: 50 }, (_, i) =>
        createMockFile({
          id: `file-${i}`,
          name: `photo-${i}.jpg`,
          dateCreated: new Date(2024, 0, 15), // All same date
        }),
      );

      let progressCallCount = 0;

      const result = await progressiveGroupFilesByMonth(smallFileList, 1000, () => {
        progressCallCount++;
      });

      // Should not call progress callback for small collections
      expect(progressCallCount).toBe(0);
      expect(result.length).toBe(1); // All in January 2024
      expect(result[0].photos.length).toBe(50);
    });

    it('should handle errors gracefully during progressive loading', async () => {
      const { progressiveGroupFilesByMonth } = await import(
        '../src/frontend/containers/ContentView/calendar/dateUtils'
      );

      // Create files with some that will cause errors
      const problematicFiles = [
        createMockFile({ id: '1', name: 'good1.jpg', dateCreated: new Date('2024-01-01') }),
        { id: '2', name: 'corrupted.jpg' } as any, // Missing required properties
        createMockFile({ id: '3', name: 'good2.jpg', dateCreated: new Date('2024-01-02') }),
      ];

      // Should not throw an error
      const result = await progressiveGroupFilesByMonth(problematicFiles, 2);

      expect(Array.isArray(result)).toBe(true);
      // Should have at least one group (either valid dates or unknown dates)
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
