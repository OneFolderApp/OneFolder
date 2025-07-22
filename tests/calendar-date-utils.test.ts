import {
  formatMonthYear,
  createMonthGroupId,
  extractMonthYear,
  groupFilesByMonth,
  isReasonablePhotoDate,
  getSafeDateForGrouping
} from '../src/frontend/containers/ContentView/calendar/dateUtils';
import { ClientFile } from '../src/frontend/entities/File';

// Mock ClientFile for testing
const createMockFile = (
  id: string,
  dateCreated: Date,
  dateModified?: Date,
  dateAdded?: Date,
  name: string = `file${id}.jpg`
): Partial<ClientFile> => ({
  id: id as any,
  name,
  dateCreated,
  dateModified: dateModified || dateCreated,
  dateAdded: dateAdded || dateCreated,
  extension: 'jpg' as any,
  size: 1000,
  width: 800,
  height: 600
});

describe('Calendar Date Utils', () => {
  describe('formatMonthYear', () => {
    it('should format month and year correctly', () => {
      expect(formatMonthYear(0, 2024)).toBe('January 2024');
      expect(formatMonthYear(5, 2023)).toBe('June 2023');
      expect(formatMonthYear(11, 2022)).toBe('December 2022');
    });

    it('should throw error for invalid month', () => {
      expect(() => formatMonthYear(-1, 2024)).toThrow('Invalid month: -1');
      expect(() => formatMonthYear(12, 2024)).toThrow('Invalid month: 12');
    });
  });

  describe('createMonthGroupId', () => {
    it('should create correct month group IDs', () => {
      expect(createMonthGroupId(0, 2024)).toBe('2024-01');
      expect(createMonthGroupId(5, 2023)).toBe('2023-06');
      expect(createMonthGroupId(11, 2022)).toBe('2022-12');
    });

    it('should pad single digit months with zero', () => {
      expect(createMonthGroupId(0, 2024)).toBe('2024-01');
      expect(createMonthGroupId(8, 2024)).toBe('2024-09');
    });

    it('should throw error for invalid month', () => {
      expect(() => createMonthGroupId(-1, 2024)).toThrow('Invalid month: -1');
      expect(() => createMonthGroupId(12, 2024)).toThrow('Invalid month: 12');
    });
  });

  describe('extractMonthYear', () => {
    it('should extract month and year from valid dates', () => {
      const date = new Date(2024, 5, 15); // June 15, 2024
      const result = extractMonthYear(date);
      expect(result).toEqual({ month: 5, year: 2024 });
    });

    it('should return null for invalid dates', () => {
      expect(extractMonthYear(new Date('invalid'))).toBeNull();
      expect(extractMonthYear(null as any)).toBeNull();
      expect(extractMonthYear(undefined as any)).toBeNull();
    });

    it('should handle edge case dates', () => {
      // January 1st
      const jan1 = new Date(2024, 0, 1);
      expect(extractMonthYear(jan1)).toEqual({ month: 0, year: 2024 });

      // December 31st
      const dec31 = new Date(2023, 11, 31);
      expect(extractMonthYear(dec31)).toEqual({ month: 11, year: 2023 });
    });
  });

  describe('isReasonablePhotoDate', () => {
    it('should accept reasonable photo dates', () => {
      expect(isReasonablePhotoDate(new Date(2024, 5, 15))).toBe(true);
      expect(isReasonablePhotoDate(new Date(2000, 0, 1))).toBe(true);
      expect(isReasonablePhotoDate(new Date(1950, 6, 4))).toBe(true);
    });

    it('should reject unreasonable dates', () => {
      expect(isReasonablePhotoDate(new Date(1800, 0, 1))).toBe(false);
      expect(isReasonablePhotoDate(new Date(2050, 0, 1))).toBe(false);
      expect(isReasonablePhotoDate(new Date('invalid'))).toBe(false);
      expect(isReasonablePhotoDate(null as any)).toBe(false);
    });

    it('should handle timezone edge cases', () => {
      // Test with different timezone dates
      const utcDate = new Date('2024-06-15T12:00:00Z');
      expect(isReasonablePhotoDate(utcDate)).toBe(true);

      const localDate = new Date(2024, 5, 15, 12, 0, 0);
      expect(isReasonablePhotoDate(localDate)).toBe(true);
    });
  });

  describe('getSafeDateForGrouping', () => {
    it('should return dateCreated when reasonable', () => {
      const file = createMockFile('1', new Date(2024, 5, 15));
      const result = getSafeDateForGrouping(file as ClientFile);
      expect(result).toEqual(new Date(2024, 5, 15));
    });

    it('should fallback to dateModified when dateCreated is unreasonable', () => {
      const file = createMockFile(
        '1',
        new Date(1800, 0, 1), // Unreasonable dateCreated
        new Date(2024, 5, 15)  // Reasonable dateModified
      );
      const result = getSafeDateForGrouping(file as ClientFile);
      expect(result).toEqual(new Date(2024, 5, 15));
    });

    it('should fallback to dateAdded when both dateCreated and dateModified are unreasonable', () => {
      const file = createMockFile(
        '1',
        new Date(1800, 0, 1), // Unreasonable dateCreated
        new Date(1800, 0, 1), // Unreasonable dateModified
        new Date(2024, 5, 15)  // Reasonable dateAdded
      );
      const result = getSafeDateForGrouping(file as ClientFile);
      expect(result).toEqual(new Date(2024, 5, 15));
    });

    it('should return null when all dates are unreasonable', () => {
      const file = createMockFile(
        '1',
        new Date(1800, 0, 1), // Unreasonable dateCreated
        new Date(1800, 0, 1), // Unreasonable dateModified
        new Date(1800, 0, 1)  // Unreasonable dateAdded
      );
      const result = getSafeDateForGrouping(file as ClientFile);
      expect(result).toBeNull();
    });
  });

  describe('groupFilesByMonth', () => {
    it('should group files by month and year', () => {
      const files = [
        createMockFile('1', new Date(2024, 5, 15), undefined, undefined, 'june1.jpg'),
        createMockFile('2', new Date(2024, 5, 20), undefined, undefined, 'june2.jpg'),
        createMockFile('3', new Date(2024, 4, 10), undefined, undefined, 'may.jpg'),
        createMockFile('4', new Date(2023, 11, 25), undefined, undefined, 'dec.jpg')
      ] as ClientFile[];

      const groups = groupFilesByMonth(files);

      expect(groups).toHaveLength(3);
      
      // Should be sorted newest first
      expect(groups[0].displayName).toBe('June 2024');
      expect(groups[0].photos).toHaveLength(2);
      expect(groups[0].photos[0].name).toBe('june1.jpg'); // Sorted by date within month
      expect(groups[0].photos[1].name).toBe('june2.jpg');

      expect(groups[1].displayName).toBe('May 2024');
      expect(groups[1].photos).toHaveLength(1);

      expect(groups[2].displayName).toBe('December 2023');
      expect(groups[2].photos).toHaveLength(1);
    });

    it('should handle files with invalid dates', () => {
      const files = [
        createMockFile('1', new Date(2024, 5, 15), undefined, undefined, 'valid.jpg'),
        createMockFile('2', new Date('invalid'), undefined, undefined, 'invalid.jpg')
      ] as ClientFile[];

      const groups = groupFilesByMonth(files);

      expect(groups).toHaveLength(2);
      expect(groups[0].displayName).toBe('June 2024');
      expect(groups[1].displayName).toBe('Unknown Date');
      expect(groups[1].photos).toHaveLength(1);
      expect(groups[1].photos[0].name).toBe('invalid.jpg');
    });

    it('should sort files within month by dateCreated ascending', () => {
      const files = [
        createMockFile('1', new Date(2024, 5, 20), undefined, undefined, 'later.jpg'),
        createMockFile('2', new Date(2024, 5, 10), undefined, undefined, 'earlier.jpg'),
        createMockFile('3', new Date(2024, 5, 15), undefined, undefined, 'middle.jpg')
      ] as ClientFile[];

      const groups = groupFilesByMonth(files);

      expect(groups).toHaveLength(1);
      expect(groups[0].photos[0].name).toBe('earlier.jpg');
      expect(groups[0].photos[1].name).toBe('middle.jpg');
      expect(groups[0].photos[2].name).toBe('later.jpg');
    });

    it('should sort month groups newest first', () => {
      const files = [
        createMockFile('1', new Date(2022, 0, 1), undefined, undefined, '2022.jpg'),
        createMockFile('2', new Date(2024, 5, 15), undefined, undefined, '2024.jpg'),
        createMockFile('3', new Date(2023, 11, 25), undefined, undefined, '2023.jpg')
      ] as ClientFile[];

      const groups = groupFilesByMonth(files);

      expect(groups).toHaveLength(3);
      expect(groups[0].year).toBe(2024);
      expect(groups[1].year).toBe(2023);
      expect(groups[2].year).toBe(2022);
    });

    it('should handle empty file array', () => {
      const groups = groupFilesByMonth([]);
      expect(groups).toHaveLength(0);
    });

    it('should create unique group IDs', () => {
      const files = [
        createMockFile('1', new Date(2024, 5, 15)),
        createMockFile('2', new Date(2024, 4, 10))
      ] as ClientFile[];

      const groups = groupFilesByMonth(files);

      expect(groups[0].id).toBe('2024-06');
      expect(groups[1].id).toBe('2024-05');
    });

    it('should handle unknown date files sorting by filename', () => {
      const files = [
        createMockFile('1', new Date('invalid'), undefined, undefined, 'zebra.jpg'),
        createMockFile('2', new Date('invalid'), undefined, undefined, 'alpha.jpg'),
        createMockFile('3', new Date('invalid'), undefined, undefined, 'beta.jpg')
      ] as ClientFile[];

      const groups = groupFilesByMonth(files);

      expect(groups).toHaveLength(1);
      expect(groups[0].displayName).toBe('Unknown Date');
      expect(groups[0].photos[0].name).toBe('alpha.jpg');
      expect(groups[0].photos[1].name).toBe('beta.jpg');
      expect(groups[0].photos[2].name).toBe('zebra.jpg');
    });
  });
});