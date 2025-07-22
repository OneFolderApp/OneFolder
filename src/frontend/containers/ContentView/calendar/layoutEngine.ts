import { ClientFile } from '../../../entities/File';
import { MonthGroup, LayoutItem, VisibleRange, CalendarLayoutConfig } from './types';
import { groupFilesByMonth } from './dateUtils';

/**
 * Default configuration for calendar layout
 */
export const DEFAULT_LAYOUT_CONFIG: CalendarLayoutConfig = {
  containerWidth: 800,
  thumbnailSize: 160,
  thumbnailPadding: 8,
  headerHeight: 48,
  groupMargin: 24,
};

/**
 * Calendar layout engine for calculating positions and dimensions
 */
export class CalendarLayoutEngine {
  private config: CalendarLayoutConfig;
  private layoutItems: LayoutItem[] = [];
  private totalHeight: number = 0;

  constructor(config: Partial<CalendarLayoutConfig> = {}) {
    this.config = { ...DEFAULT_LAYOUT_CONFIG, ...config };
  }

  /**
   * Updates the layout configuration
   */
  updateConfig(config: Partial<CalendarLayoutConfig>): void {
    this.config = { ...this.config, ...config };
    // Recalculate layout if we have items
    if (this.layoutItems.length > 0) {
      const monthGroups = this.layoutItems
        .filter((item) => item.type === 'header')
        .map((item) => item.monthGroup);
      this.calculateLayout(monthGroups);
    }
  }

  /**
   * Groups files by month and calculates layout positions
   */
  calculateLayout(files: ClientFile[]): LayoutItem[];
  calculateLayout(monthGroups: MonthGroup[]): LayoutItem[];
  calculateLayout(input: ClientFile[] | MonthGroup[]): LayoutItem[] {
    try {
      // Determine if input is files or month groups
      const monthGroups =
        Array.isArray(input) && input.length > 0 && 'dateCreated' in input[0]
          ? groupFilesByMonth(input as ClientFile[])
          : (input as MonthGroup[]);

      // Validate input
      if (!Array.isArray(monthGroups)) {
        throw new Error('Invalid input: expected array of month groups');
      }

      this.layoutItems = [];
      let currentTop = 0;

      for (const monthGroup of monthGroups) {
        // Validate month group
        if (!monthGroup || typeof monthGroup !== 'object') {
          console.warn('Skipping invalid month group:', monthGroup);
          continue;
        }

        if (!Array.isArray(monthGroup.photos)) {
          console.warn('Skipping month group with invalid photos array:', monthGroup);
          continue;
        }

        // Add header item
        const headerItem: LayoutItem = {
          type: 'header',
          monthGroup,
          top: currentTop,
          height: this.config.headerHeight,
          id: `header-${monthGroup.id}`,
        };
        this.layoutItems.push(headerItem);
        currentTop += this.config.headerHeight;

        // Calculate grid dimensions with error handling
        const gridHeight = this.safeCalculateGridHeight(monthGroup.photos.length);

        // Add grid item
        const gridItem: LayoutItem = {
          type: 'grid',
          monthGroup,
          top: currentTop,
          height: gridHeight,
          photos: monthGroup.photos,
          id: `grid-${monthGroup.id}`,
        };
        this.layoutItems.push(gridItem);
        currentTop += gridHeight;

        // Add margin between groups (except for the last group)
        if (monthGroup !== monthGroups[monthGroups.length - 1]) {
          currentTop += this.config.groupMargin;
        }
      }

      this.totalHeight = currentTop;
      return this.layoutItems;
    } catch (error) {
      console.error('Error calculating calendar layout:', error);
      
      // Fallback: create minimal layout
      this.layoutItems = [];
      this.totalHeight = 0;
      
      // Re-throw with more context for error boundary
      throw new Error(`Calendar layout calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculates the height needed for a photo grid
   */
  private calculateGridHeight(photoCount: number): number {
    if (photoCount === 0) {
      return 0;
    }

    const itemsPerRow = this.calculateItemsPerRow();
    const rows = Math.ceil(photoCount / itemsPerRow);
    const itemSize = this.config.thumbnailSize + this.config.thumbnailPadding;

    return rows * itemSize;
  }

  /**
   * Safely calculates the height needed for a photo grid with error handling
   */
  private safeCalculateGridHeight(photoCount: number): number {
    try {
      // Validate input
      if (typeof photoCount !== 'number' || photoCount < 0 || !isFinite(photoCount)) {
        console.warn('Invalid photo count for grid height calculation:', photoCount);
        return 0;
      }

      if (photoCount === 0) {
        return 0;
      }

      const itemsPerRow = this.calculateItemsPerRow();
      
      // Validate items per row calculation
      if (itemsPerRow <= 0 || !isFinite(itemsPerRow)) {
        console.warn('Invalid items per row calculation:', itemsPerRow);
        return this.config.thumbnailSize; // Fallback to single row height
      }

      const rows = Math.ceil(photoCount / itemsPerRow);
      const itemSize = this.config.thumbnailSize + this.config.thumbnailPadding;

      // Validate final calculation
      const height = rows * itemSize;
      if (!isFinite(height) || height < 0) {
        console.warn('Invalid grid height calculation:', height);
        return this.config.thumbnailSize; // Fallback to single row height
      }

      // Reasonable maximum height check (prevent extremely large layouts)
      const maxHeight = 50000; // 50k pixels should be more than enough
      if (height > maxHeight) {
        console.warn('Grid height exceeds maximum:', height);
        return maxHeight;
      }

      return height;
    } catch (error) {
      console.error('Error calculating grid height:', error);
      return this.config.thumbnailSize; // Safe fallback
    }
  }

  /**
   * Calculates how many items fit per row
   */
  calculateItemsPerRow(): number {
    try {
      // Validate configuration values
      if (this.config.thumbnailSize <= 0 || this.config.containerWidth <= 0) {
        console.warn('Invalid layout configuration:', this.config);
        return 1; // Fallback to single column
      }

      const itemSize = this.config.thumbnailSize + this.config.thumbnailPadding;
      const availableWidth = this.config.containerWidth - this.config.thumbnailPadding;
      
      if (availableWidth <= 0 || itemSize <= 0) {
        return 1; // Fallback to single column
      }

      const itemsPerRow = Math.floor(availableWidth / itemSize);
      return Math.max(1, itemsPerRow);
    } catch (error) {
      console.error('Error calculating items per row:', error);
      return 1; // Safe fallback
    }
  }

  /**
   * Finds visible items within the viewport using binary search
   */
  findVisibleItems(scrollTop: number, viewportHeight: number, overscan: number = 2): VisibleRange {
    if (this.layoutItems.length === 0) {
      return { startIndex: 0, endIndex: 0, totalItems: 0 };
    }

    const viewportBottom = scrollTop + viewportHeight;

    // Find first visible item using binary search
    let startIndex = this.binarySearchStart(scrollTop);

    // Find last visible item using binary search
    let endIndex = this.binarySearchEnd(viewportBottom);

    // Apply overscan
    startIndex = Math.max(0, startIndex - overscan);
    endIndex = Math.min(this.layoutItems.length - 1, endIndex + overscan);

    return {
      startIndex,
      endIndex,
      totalItems: this.layoutItems.length,
    };
  }

  /**
   * Binary search to find the first item that intersects with the viewport top
   */
  private binarySearchStart(scrollTop: number): number {
    let left = 0;
    let right = this.layoutItems.length - 1;
    let result = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const item = this.layoutItems[mid];
      const itemBottom = item.top + item.height;

      if (itemBottom > scrollTop) {
        result = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return result;
  }

  /**
   * Binary search to find the last item that intersects with the viewport bottom
   */
  private binarySearchEnd(viewportBottom: number): number {
    let left = 0;
    let right = this.layoutItems.length - 1;
    let result = this.layoutItems.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const item = this.layoutItems[mid];

      if (item.top < viewportBottom) {
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return result;
  }

  /**
   * Gets the total height of all layout items
   */
  getTotalHeight(): number {
    return this.totalHeight;
  }

  /**
   * Gets all layout items
   */
  getLayoutItems(): LayoutItem[] {
    return this.layoutItems;
  }

  /**
   * Gets a layout item by index
   */
  getLayoutItem(index: number): LayoutItem | undefined {
    return this.layoutItems[index];
  }

  /**
   * Finds the layout item that contains a specific scroll position
   */
  findItemAtPosition(scrollTop: number): LayoutItem | undefined {
    for (const item of this.layoutItems) {
      if (scrollTop >= item.top && scrollTop < item.top + item.height) {
        return item;
      }
    }
    return undefined;
  }

  /**
   * Calculates the scroll position to show a specific month group
   */
  getScrollPositionForMonth(monthGroupId: string): number {
    const headerItem = this.layoutItems.find(
      (item) => item.type === 'header' && item.monthGroup.id === monthGroupId,
    );
    return headerItem ? headerItem.top : 0;
  }

  /**
   * Calculates the scroll position to show a specific date (for future enhancements)
   * @param year - The year to scroll to
   * @param month - The month to scroll to (0-11)
   * @returns The scroll position, or 0 if the date is not found
   */
  getScrollPositionForDate(year: number, month: number): number {
    const monthGroupId = `${year}-${month.toString().padStart(2, '0')}`;
    return this.getScrollPositionForMonth(monthGroupId);
  }

  /**
   * Finds the closest month group to a given date (for future enhancements)
   * @param targetDate - The target date to find the closest month for
   * @returns The closest month group, or undefined if no groups exist
   */
  findClosestMonthGroup(targetDate: Date): MonthGroup | undefined {
    if (this.layoutItems.length === 0) {
      return undefined;
    }

    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    // Find exact match first
    const exactMatch = this.layoutItems.find(
      (item) => 
        item.type === 'header' && 
        item.monthGroup.year === targetYear && 
        item.monthGroup.month === targetMonth
    );

    if (exactMatch) {
      return exactMatch.monthGroup;
    }

    // Find closest month group
    let closestGroup: MonthGroup | undefined;
    let minDistance = Infinity;

    for (const item of this.layoutItems) {
      if (item.type === 'header') {
        const groupDate = new Date(item.monthGroup.year, item.monthGroup.month);
        const distance = Math.abs(groupDate.getTime() - targetDate.getTime());
        
        if (distance < minDistance) {
          minDistance = distance;
          closestGroup = item.monthGroup;
        }
      }
    }

    return closestGroup;
  }
}
