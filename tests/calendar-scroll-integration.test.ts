import { CalendarLayoutEngine } from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import { groupFilesByMonth } from '../src/frontend/containers/ContentView/calendar/dateUtils';
import { ClientFile } from '../src/frontend/entities/File';

// Mock file data for testing
const createMockFile = (id: string, dateCreated: string): Partial<ClientFile> => ({
  id: id as any,
  dateCreated: new Date(dateCreated),
  name: `photo_${id}`,
  extension: 'jpg' as any,
  absolutePath: `/path/to/photo_${id}.jpg`,
  size: 1024,
  width: 800,
  height: 600,
  dateModified: new Date(dateCreated),
  dateAdded: new Date(dateCreated),
});

describe('Calendar Scroll Position Integration', () => {
  it('should provide complete scroll position management functionality', () => {
    const layoutEngine = new CalendarLayoutEngine({
      containerWidth: 800,
      thumbnailSize: 160,
      thumbnailPadding: 8,
      headerHeight: 48,
      groupMargin: 24,
    });

    // Create test files across multiple months
    const mockFiles = [
      createMockFile('1', '2024-01-15'),
      createMockFile('2', '2024-01-20'),
      createMockFile('3', '2024-02-10'),
      createMockFile('4', '2024-02-25'),
      createMockFile('5', '2024-03-05'),
      createMockFile('6', '2024-03-15'),
    ] as ClientFile[];

    const monthGroups = groupFilesByMonth(mockFiles);
    layoutEngine.calculateLayout(monthGroups);

    // Test scroll-to-date functionality
    const februaryScrollPosition = layoutEngine.getScrollPositionForDate(2024, 1);
    expect(februaryScrollPosition).toBeGreaterThanOrEqual(0);

    // Test finding closest month group
    const targetDate = new Date(2024, 1, 15); // February 15, 2024
    const closestGroup = layoutEngine.findClosestMonthGroup(targetDate);
    expect(closestGroup).toBeDefined();
    expect(closestGroup?.year).toBe(2024);
    expect(closestGroup?.month).toBe(1);

    // Test scroll position for month group
    const monthScrollPosition = layoutEngine.getScrollPositionForMonth(closestGroup!.id);
    expect(monthScrollPosition).toBeGreaterThanOrEqual(0);
    expect(monthScrollPosition).toBeLessThan(layoutEngine.getTotalHeight());

    // Test that all scroll positions are within valid range
    const totalHeight = layoutEngine.getTotalHeight();
    expect(februaryScrollPosition).toBeLessThan(totalHeight);

    // Test layout updates don't break scroll position calculations
    layoutEngine.updateConfig({ thumbnailSize: 200 });
    const updatedScrollPosition = layoutEngine.getScrollPositionForDate(2024, 1);
    expect(updatedScrollPosition).toBeGreaterThanOrEqual(0);
    expect(updatedScrollPosition).toBeLessThan(layoutEngine.getTotalHeight());
  });

  it('should handle edge cases in scroll position management', () => {
    const layoutEngine = new CalendarLayoutEngine();

    // Test with empty file list
    const emptyGroups = groupFilesByMonth([]);
    layoutEngine.calculateLayout(emptyGroups);

    expect(layoutEngine.getScrollPositionForDate(2024, 1)).toBe(0);
    expect(layoutEngine.findClosestMonthGroup(new Date())).toBeUndefined();
    expect(layoutEngine.getScrollPositionForMonth('non-existent')).toBe(0);

    // Test with single file
    const singleFile = [createMockFile('1', '2024-06-15')] as ClientFile[];
    const singleGroups = groupFilesByMonth(singleFile);
    layoutEngine.calculateLayout(singleGroups);

    const singleScrollPosition = layoutEngine.getScrollPositionForDate(2024, 5); // June
    expect(singleScrollPosition).toBeGreaterThanOrEqual(0);

    const closestToSingle = layoutEngine.findClosestMonthGroup(new Date(2024, 5, 20));
    expect(closestToSingle).toBeDefined();
    expect(closestToSingle?.month).toBe(5); // June
  });
});