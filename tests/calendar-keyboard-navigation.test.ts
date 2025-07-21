import { CalendarKeyboardNavigation } from '../src/frontend/containers/ContentView/calendar/CalendarKeyboardNavigation';
import { CalendarLayoutEngine } from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import { MonthGroup } from '../src/frontend/containers/ContentView/calendar/types';
import { ClientFile } from '../src/frontend/entities/File';

// Mock ClientFile factory
const createMockFile = (id: string, dateCreated: Date): Partial<ClientFile> => ({
  id: id as any,
  dateCreated,
  name: `photo-${id}.jpg`,
  size: 1024,
  extension: 'jpg' as any,
  width: 1920,
  height: 1080,
  dateModified: dateCreated,
});

// Create test data
const createTestData = () => {
  const files = [
    // January 2024 - 6 photos (2 rows of 3)
    createMockFile('jan-1', new Date('2024-01-01')),
    createMockFile('jan-2', new Date('2024-01-02')),
    createMockFile('jan-3', new Date('2024-01-03')),
    createMockFile('jan-4', new Date('2024-01-04')),
    createMockFile('jan-5', new Date('2024-01-05')),
    createMockFile('jan-6', new Date('2024-01-06')),

    // February 2024 - 4 photos (2 rows, 2 in first row, 2 in second row)
    createMockFile('feb-1', new Date('2024-02-01')),
    createMockFile('feb-2', new Date('2024-02-02')),
    createMockFile('feb-3', new Date('2024-02-03')),
    createMockFile('feb-4', new Date('2024-02-04')),
  ] as ClientFile[];

  const monthGroups: MonthGroup[] = [
    {
      year: 2024,
      month: 0, // January
      photos: files.slice(0, 6),
      displayName: 'January 2024',
      id: 'jan-2024',
    },
    {
      year: 2024,
      month: 1, // February
      photos: files.slice(6, 10),
      displayName: 'February 2024',
      id: 'feb-2024',
    },
  ];

  return { files, monthGroups };
};

describe('CalendarKeyboardNavigation', () => {
  let layoutEngine: CalendarLayoutEngine;
  let keyboardNavigation: CalendarKeyboardNavigation;
  let files: ClientFile[];
  let monthGroups: MonthGroup[];

  beforeEach(() => {
    const testData = createTestData();
    files = testData.files;
    monthGroups = testData.monthGroups;

    layoutEngine = new CalendarLayoutEngine({
      containerWidth: 600,
      thumbnailSize: 160,
      thumbnailPadding: 8,
      headerHeight: 48,
      groupMargin: 24,
    });

    layoutEngine.calculateLayout(monthGroups);
    keyboardNavigation = new CalendarKeyboardNavigation(layoutEngine, files, monthGroups);
  });

  describe('horizontal navigation', () => {
    it('should navigate right within the same row', () => {
      // Start at first photo in January (index 0)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(0, 'right');
      expect(nextIndex).toBe(1); // Should move to second photo in same row
    });

    it('should navigate left within the same row', () => {
      // Start at second photo in January (index 1)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(1, 'left');
      expect(nextIndex).toBe(0); // Should move to first photo in same row
    });

    it('should wrap to next row when navigating right at end of row', () => {
      // Start at third photo in January (index 2, end of first row)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(2, 'right');
      expect(nextIndex).toBe(3); // Should move to first photo of second row
    });

    it('should wrap to previous row when navigating left at start of row', () => {
      // Start at fourth photo in January (index 3, start of second row)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(3, 'left');
      expect(nextIndex).toBe(2); // Should move to last photo of previous row
    });

    it('should navigate to next month when at end of current month', () => {
      // Start at last photo in January (index 5)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(5, 'right');
      expect(nextIndex).toBe(6); // Should move to first photo in February
    });

    it('should navigate to previous month when at start of current month', () => {
      // Start at first photo in February (index 6)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(6, 'left');
      expect(nextIndex).toBe(5); // Should move to last photo in January
    });
  });

  describe('vertical navigation', () => {
    it('should navigate down within the same month', () => {
      // Start at first photo in January (index 0, row 0, col 0)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(0, 'down');
      expect(nextIndex).toBe(3); // Should move to first photo of second row (row 1, col 0)
    });

    it('should navigate up within the same month', () => {
      // Start at fourth photo in January (index 3, row 1, col 0)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(3, 'up');
      expect(nextIndex).toBe(0); // Should move to first photo of first row (row 0, col 0)
    });

    it('should navigate to next month when at bottom of current month', () => {
      // Start at last photo in January (index 5, row 1, col 2)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(5, 'down');
      expect(nextIndex).toBe(8); // Should move to February, same column if possible, or first photo
    });

    it('should navigate to previous month when at top of current month', () => {
      // Start at first photo in February (index 6, row 0, col 0)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(6, 'up');
      expect(nextIndex).toBe(3); // Should move to January, last row, same column
    });
  });

  describe('edge cases', () => {
    it('should return null for invalid current index', () => {
      const nextIndex = keyboardNavigation.getNextPhotoIndex(-1, 'right');
      expect(nextIndex).toBeNull();
    });

    it('should return null for index out of bounds', () => {
      const nextIndex = keyboardNavigation.getNextPhotoIndex(files.length, 'right');
      expect(nextIndex).toBeNull();
    });

    it('should return null when at first photo and navigating left', () => {
      const nextIndex = keyboardNavigation.getNextPhotoIndex(0, 'left');
      expect(nextIndex).toBeNull();
    });

    it('should return null when at last photo and navigating right', () => {
      const lastIndex = files.length - 1;
      const nextIndex = keyboardNavigation.getNextPhotoIndex(lastIndex, 'right');
      expect(nextIndex).toBeNull();
    });

    it('should return null when at first photo and navigating up', () => {
      const nextIndex = keyboardNavigation.getNextPhotoIndex(0, 'up');
      expect(nextIndex).toBeNull();
    });

    it('should return null when at last photo and navigating down', () => {
      const lastIndex = files.length - 1;
      const nextIndex = keyboardNavigation.getNextPhotoIndex(lastIndex, 'down');
      expect(nextIndex).toBeNull();
    });
  });

  describe('scroll position calculation', () => {
    it('should calculate scroll position for a photo', () => {
      const scrollPosition = keyboardNavigation.getScrollPositionForPhoto(0);
      expect(scrollPosition).toBeGreaterThanOrEqual(0);
      expect(typeof scrollPosition).toBe('number');
    });

    it('should return null for invalid photo index', () => {
      const scrollPosition = keyboardNavigation.getScrollPositionForPhoto(-1);
      expect(scrollPosition).toBeNull();
    });

    it('should return null for photo index out of bounds', () => {
      const scrollPosition = keyboardNavigation.getScrollPositionForPhoto(files.length);
      expect(scrollPosition).toBeNull();
    });
  });

  describe('layout updates', () => {
    it('should update navigation when layout changes', () => {
      const newFiles = files.slice(0, 5); // Remove some files
      const newMonthGroups = [
        {
          ...monthGroups[0],
          photos: newFiles.slice(0, 5),
        },
      ];

      keyboardNavigation.updateLayout(layoutEngine, newFiles, newMonthGroups);

      // Should handle navigation with updated data
      const nextIndex = keyboardNavigation.getNextPhotoIndex(0, 'right');
      expect(nextIndex).toBe(1);
    });
  });

  describe('grid layout awareness', () => {
    it('should respect grid layout when navigating', () => {
      // With 3 items per row, navigating right from index 2 should go to index 3
      const nextIndex = keyboardNavigation.getNextPhotoIndex(2, 'right');
      expect(nextIndex).toBe(3);
    });

    it('should handle partial rows correctly', () => {
      // February has 4 photos, with 3 items per row: [6,7,8] [9]
      // Navigate down from first photo in February (index 6)
      const nextIndex = keyboardNavigation.getNextPhotoIndex(6, 'down');
      expect(nextIndex).toBe(9); // Should go to second row, first column (index 9)
    });
  });
});
