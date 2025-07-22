import { CalendarLayoutEngine } from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import { groupFilesByMonth } from '../src/frontend/containers/ContentView/calendar/dateUtils';
import { ClientFile } from '../src/frontend/entities/File';
import { ClientTag } from '../src/frontend/entities/Tag';
import { observable } from 'mobx';

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

describe('Calendar Scroll Position Management', () => {
  let layoutEngine: CalendarLayoutEngine;
  let mockFiles: ClientFile[];

  beforeEach(() => {
    layoutEngine = new CalendarLayoutEngine({
      containerWidth: 800,
      thumbnailSize: 160,
      thumbnailPadding: 8,
      headerHeight: 48,
      groupMargin: 24,
    });

    // Create mock files across multiple months
    mockFiles = [
      createMockFile('1', '2024-01-15'),
      createMockFile('2', '2024-01-20'),
      createMockFile('3', '2024-02-10'),
      createMockFile('4', '2024-02-25'),
      createMockFile('5', '2024-03-05'),
      createMockFile('6', '2024-03-15'),
    ] as ClientFile[];
  });

  describe('getScrollPositionForDate', () => {
    it('should return correct scroll position for existing month', () => {
      const monthGroups = groupFilesByMonth(mockFiles);
      layoutEngine.calculateLayout(monthGroups);

      // Get scroll position for February 2024 (month index 1)
      const scrollPosition = layoutEngine.getScrollPositionForDate(2024, 1);

      // Should be greater than 0 since February comes after January
      expect(scrollPosition).toBeGreaterThan(0);

      // Should be less than the total height
      expect(scrollPosition).toBeLessThan(layoutEngine.getTotalHeight());
    });

    it('should return 0 for non-existent month', () => {
      const monthGroups = groupFilesByMonth(mockFiles);
      layoutEngine.calculateLayout(monthGroups);

      // Get scroll position for a month that doesn't exist
      const scrollPosition = layoutEngine.getScrollPositionForDate(2025, 5);

      expect(scrollPosition).toBe(0);
    });

    it('should return correct scroll position for first month', () => {
      const monthGroups = groupFilesByMonth(mockFiles);
      layoutEngine.calculateLayout(monthGroups);

      // Get scroll position for January 2024 (month index 0)
      const scrollPosition = layoutEngine.getScrollPositionForDate(2024, 0);

      // Should be 0 since January is the first month
      expect(scrollPosition).toBe(0);
    });
  });

  describe('findClosestMonthGroup', () => {
    it('should find exact match when date exists', () => {
      const monthGroups = groupFilesByMonth(mockFiles);
      layoutEngine.calculateLayout(monthGroups);

      const targetDate = new Date(2024, 1, 15); // February 15, 2024
      const closestGroup = layoutEngine.findClosestMonthGroup(targetDate);

      expect(closestGroup).toBeDefined();
      expect(closestGroup?.year).toBe(2024);
      expect(closestGroup?.month).toBe(1); // February (0-indexed)
    });

    it('should find closest month when exact date does not exist', () => {
      const monthGroups = groupFilesByMonth(mockFiles);
      layoutEngine.calculateLayout(monthGroups);

      const targetDate = new Date(2024, 4, 15); // May 2024 (doesn't exist in our data)
      const closestGroup = layoutEngine.findClosestMonthGroup(targetDate);

      expect(closestGroup).toBeDefined();
      expect(closestGroup?.year).toBe(2024);
      expect(closestGroup?.month).toBe(2); // March should be closest to May
    });

    it('should return undefined when no groups exist', () => {
      // Don't calculate layout, so no groups exist
      const targetDate = new Date(2024, 1, 15);
      const closestGroup = layoutEngine.findClosestMonthGroup(targetDate);

      expect(closestGroup).toBeUndefined();
    });
  });

  describe('getScrollPositionForMonth', () => {
    it('should return correct scroll position for existing month group', () => {
      const monthGroups = groupFilesByMonth(mockFiles);
      layoutEngine.calculateLayout(monthGroups);

      // Get the ID of the second month group (February)
      const februaryGroup = monthGroups.find((group) => group.month === 1 && group.year === 2024);
      expect(februaryGroup).toBeDefined();

      const scrollPosition = layoutEngine.getScrollPositionForMonth(februaryGroup!.id);

      // Should be greater than 0 since February comes after January
      expect(scrollPosition).toBeGreaterThan(0);
    });

    it('should return 0 for non-existent month group', () => {
      const monthGroups = groupFilesByMonth(mockFiles);
      layoutEngine.calculateLayout(monthGroups);

      const scrollPosition = layoutEngine.getScrollPositionForMonth('non-existent-id');

      expect(scrollPosition).toBe(0);
    });
  });

  describe('scroll position calculations', () => {
    it('should calculate valid scroll positions for all months', () => {
      const monthGroups = groupFilesByMonth(mockFiles);
      layoutEngine.calculateLayout(monthGroups);

      const januaryPosition = layoutEngine.getScrollPositionForDate(2024, 0);
      const februaryPosition = layoutEngine.getScrollPositionForDate(2024, 1);
      const marchPosition = layoutEngine.getScrollPositionForDate(2024, 2);

      // All positions should be valid numbers >= 0
      expect(januaryPosition).toBeGreaterThanOrEqual(0);
      expect(februaryPosition).toBeGreaterThanOrEqual(0);
      expect(marchPosition).toBeGreaterThanOrEqual(0);

      // Positions should be different for different months
      expect(new Set([januaryPosition, februaryPosition, marchPosition]).size).toBe(3);

      // All positions should be within the total height
      const totalHeight = layoutEngine.getTotalHeight();
      expect(januaryPosition).toBeLessThan(totalHeight);
      expect(februaryPosition).toBeLessThan(totalHeight);
      expect(marchPosition).toBeLessThan(totalHeight);
    });

    it('should handle layout updates correctly', () => {
      const monthGroups = groupFilesByMonth(mockFiles);
      layoutEngine.calculateLayout(monthGroups);

      const initialPosition = layoutEngine.getScrollPositionForDate(2024, 1);

      // Update layout configuration
      layoutEngine.updateConfig({ thumbnailSize: 200 });

      const updatedPosition = layoutEngine.getScrollPositionForDate(2024, 1);

      // Position might change due to different thumbnail size affecting grid height
      expect(typeof updatedPosition).toBe('number');
      expect(updatedPosition).toBeGreaterThanOrEqual(0);
    });
  });
});
