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
    // Determine if input is files or month groups
    const monthGroups =
      Array.isArray(input) && input.length > 0 && 'dateCreated' in input[0]
        ? groupFilesByMonth(input as ClientFile[])
        : (input as MonthGroup[]);

    this.layoutItems = [];
    let currentTop = 0;

    for (const monthGroup of monthGroups) {
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

      // Calculate grid dimensions
      const gridHeight = this.calculateGridHeight(monthGroup.photos.length);

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
   * Calculates how many items fit per row
   */
  calculateItemsPerRow(): number {
    const itemSize = this.config.thumbnailSize + this.config.thumbnailPadding;
    const availableWidth = this.config.containerWidth - this.config.thumbnailPadding;
    return Math.max(1, Math.floor(availableWidth / itemSize));
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
}
