import { 
  safeGroupFilesByMonth, 
  validateMonthGroups, 
  isValidMonthGroup,
  getSafeDateForGrouping 
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

describe('Calendar Error Handling', () => {
  describe('safeGroupFilesByMonth', () => {
    it('should handle empty file list gracefully', () => {
      const result = safeGroupFilesByMonth([]);
      expect(result).toEqual([]);
    });

    it('should handle files with invalid dates', () => {
      const files = [
        createMockFile({ 
          id: '1', 
          name: 'valid.jpg',
          dateCreated: new Date('2024-01-15') 
        }),
        createMockFile({ 
          id: '2', 
          name: 'invalid.jpg',
          dateCreated: new Date('invalid'),
          dateModified: new Date('invalid'),
          dateAdded: new Date('invalid')
        }),
      ];

      const result = safeGroupFilesByMonth(files);
      
      // Should have one valid group and one unknown date group
      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe('January 2024');
      expect(result[1].displayName).toBe('Unknown Date');
      expect(result[1].photos).toHaveLength(1);
      expect(result[1].photos[0].name).toBe('invalid.jpg');
    });

    it('should handle normal files correctly', () => {
      const files = [
        createMockFile({ 
          id: '1', 
          name: 'file1.jpg',
          dateCreated: new Date('2024-01-15') 
        }),
        createMockFile({ 
          id: '2', 
          name: 'file2.jpg',
          dateCreated: new Date('2024-02-15') 
        }),
      ];

      const result = safeGroupFilesByMonth(files);
      
      // Should have two groups
      expect(result).toHaveLength(2);
      expect(result[0].displayName).toBe('February 2024');
      expect(result[1].displayName).toBe('January 2024');
    });
  });

  describe('validateMonthGroups', () => {
    it('should filter out invalid month groups', () => {
      const validGroup: MonthGroup = {
        year: 2024,
        month: 0,
        photos: [createMockFile()],
        displayName: 'January 2024',
        id: '2024-01'
      };

      const invalidGroup = {
        year: 'invalid',
        month: 0,
        photos: [],
        displayName: 'Invalid',
        id: 'invalid'
      } as any;

      const groups = [validGroup, invalidGroup];
      const result = validateMonthGroups(groups);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(validGroup);
    });

    it('should handle empty groups array', () => {
      const result = validateMonthGroups([]);
      expect(result).toEqual([]);
    });
  });

  describe('isValidMonthGroup', () => {
    it('should validate correct month group', () => {
      const validGroup: MonthGroup = {
        year: 2024,
        month: 0,
        photos: [createMockFile()],
        displayName: 'January 2024',
        id: '2024-01'
      };

      expect(isValidMonthGroup(validGroup)).toBe(true);
    });

    it('should reject invalid month group', () => {
      const invalidGroup = {
        year: 'invalid',
        month: 0,
        photos: [],
        displayName: 'Invalid',
        id: 'invalid'
      } as any;

      expect(isValidMonthGroup(invalidGroup)).toBe(false);
    });

    it('should accept special groups like unknown-date', () => {
      const unknownDateGroup: MonthGroup = {
        year: 0,
        month: 0,
        photos: [createMockFile()],
        displayName: 'Unknown Date',
        id: 'unknown-date'
      };

      expect(isValidMonthGroup(unknownDateGroup)).toBe(true);
    });

    it('should reject groups with invalid month range', () => {
      const invalidMonthGroup: MonthGroup = {
        year: 2024,
        month: 15, // Invalid month
        photos: [createMockFile()],
        displayName: 'Invalid Month',
        id: '2024-15'
      };

      expect(isValidMonthGroup(invalidMonthGroup)).toBe(false);
    });
  });

  describe('getSafeDateForGrouping', () => {
    it('should return dateCreated when valid', () => {
      const file = createMockFile({
        dateCreated: new Date('2024-01-15'),
        dateModified: new Date('2024-01-10'),
        dateAdded: new Date('2024-01-05')
      });

      const result = getSafeDateForGrouping(file);
      expect(result).toEqual(new Date('2024-01-15'));
    });

    it('should fallback to dateModified when dateCreated is invalid', () => {
      const file = createMockFile({
        dateCreated: new Date('invalid'),
        dateModified: new Date('2024-01-10'),
        dateAdded: new Date('2024-01-05')
      });

      const result = getSafeDateForGrouping(file);
      expect(result).toEqual(new Date('2024-01-10'));
    });

    it('should fallback to dateAdded when both dateCreated and dateModified are invalid', () => {
      const file = createMockFile({
        dateCreated: new Date('invalid'),
        dateModified: new Date('invalid'),
        dateAdded: new Date('2024-01-05')
      });

      const result = getSafeDateForGrouping(file);
      expect(result).toEqual(new Date('2024-01-05'));
    });

    it('should return null when all dates are invalid', () => {
      const file = createMockFile({
        dateCreated: new Date('invalid'),
        dateModified: new Date('invalid'),
        dateAdded: new Date('invalid')
      });

      const result = getSafeDateForGrouping(file);
      expect(result).toBeNull();
    });

    it('should reject unreasonable dates (too old)', () => {
      const file = createMockFile({
        dateCreated: new Date('1800-01-01'), // Too old
        dateModified: new Date('2024-01-10'),
        dateAdded: new Date('2024-01-05')
      });

      const result = getSafeDateForGrouping(file);
      expect(result).toEqual(new Date('2024-01-10'));
    });

    it('should reject unreasonable dates (too far in future)', () => {
      const file = createMockFile({
        dateCreated: new Date('2050-01-01'), // Too far in future
        dateModified: new Date('2024-01-10'),
        dateAdded: new Date('2024-01-05')
      });

      const result = getSafeDateForGrouping(file);
      expect(result).toEqual(new Date('2024-01-10'));
    });
  });
});