import { ClientFile } from '../../../entities/File';
import { MonthGroup, LayoutItem } from './types';
import { CalendarLayoutEngine } from './layoutEngine';

/**
 * Represents a photo's position within the calendar grid
 */
export interface PhotoPosition {
  /** The photo file */
  photo: ClientFile;
  /** Index in the global file list */
  globalIndex: number;
  /** Month group containing this photo */
  monthGroup: MonthGroup;
  /** Index within the month group */
  monthIndex: number;
  /** Row within the month's grid */
  row: number;
  /** Column within the month's grid */
  column: number;
  /** Layout item containing this photo */
  layoutItem: LayoutItem;
}

/**
 * Navigation direction
 */
export type NavigationDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Keyboard navigation utility for calendar view
 */
export class CalendarKeyboardNavigation {
  private layoutEngine: CalendarLayoutEngine;
  private fileList: ClientFile[];
  private monthGroups: MonthGroup[];
  private photoPositions: Map<string, PhotoPosition> = new Map();

  constructor(
    layoutEngine: CalendarLayoutEngine,
    fileList: ClientFile[],
    monthGroups: MonthGroup[]
  ) {
    this.layoutEngine = layoutEngine;
    this.fileList = fileList;
    this.monthGroups = monthGroups;
    this.buildPositionMap();
  }

  /**
   * Updates the navigation state when data changes
   */
  update(fileList: ClientFile[], monthGroups: MonthGroup[]): void {
    this.fileList = fileList;
    this.monthGroups = monthGroups;
    this.buildPositionMap();
  }

  /**
   * Builds a map of photo positions for efficient navigation
   */
  private buildPositionMap(): void {
    this.photoPositions.clear();
    const layoutItems = this.layoutEngine.getLayoutItems();
    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();

    for (const monthGroup of this.monthGroups) {
      const gridItem = layoutItems.find(
        (item) => item.type === 'grid' && item.monthGroup.id === monthGroup.id
      );

      if (!gridItem || !gridItem.photos) continue;

      gridItem.photos.forEach((photo, monthIndex) => {
        const globalIndex = this.fileList.findIndex((f) => f.id === photo.id);
        if (globalIndex === -1) return;

        const row = Math.floor(monthIndex / itemsPerRow);
        const column = monthIndex % itemsPerRow;

        const position: PhotoPosition = {
          photo,
          globalIndex,
          monthGroup,
          monthIndex,
          row,
          column,
          layoutItem: gridItem,
        };

        this.photoPositions.set(photo.id, position);
      });
    }
  }

  /**
   * Gets the position of a photo by its global index
   */
  getPositionByGlobalIndex(globalIndex: number): PhotoPosition | undefined {
    const photo = this.fileList[globalIndex];
    if (!photo) return undefined;
    return this.photoPositions.get(photo.id);
  }

  /**
   * Gets the position of a photo by its file ID
   */
  getPositionByPhotoId(photoId: string): PhotoPosition | undefined {
    return this.photoPositions.get(photoId);
  }

  /**
   * Navigates to the next photo in the specified direction
   */
  navigate(currentGlobalIndex: number, direction: NavigationDirection): number | undefined {
    const currentPosition = this.getPositionByGlobalIndex(currentGlobalIndex);
    if (!currentPosition) return undefined;

    switch (direction) {
      case 'left':
        return this.navigateLeft(currentPosition);
      case 'right':
        return this.navigateRight(currentPosition);
      case 'up':
        return this.navigateUp(currentPosition);
      case 'down':
        return this.navigateDown(currentPosition);
      default:
        return undefined;
    }
  }

  /**
   * Navigates left within the current row or to the previous month
   */
  private navigateLeft(position: PhotoPosition): number | undefined {
    // If not at the leftmost column, move left within the same row
    if (position.column > 0) {
      const targetIndex = position.monthIndex - 1;
      const targetPhoto = position.monthGroup.photos[targetIndex];
      if (targetPhoto) {
        return this.fileList.findIndex((f) => f.id === targetPhoto.id);
      }
    }

    // At leftmost column, try to move to the previous month's last photo
    const prevMonthGroup = this.getPreviousMonthGroup(position.monthGroup);
    if (prevMonthGroup && prevMonthGroup.photos.length > 0) {
      const lastPhoto = prevMonthGroup.photos[prevMonthGroup.photos.length - 1];
      return this.fileList.findIndex((f) => f.id === lastPhoto.id);
    }

    return undefined;
  }

  /**
   * Navigates right within the current row or to the next month
   */
  private navigateRight(position: PhotoPosition): number | undefined {
    // If not at the rightmost column and there's a photo to the right, move right
    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();
    const isLastInRow = position.column === itemsPerRow - 1;
    const isLastPhoto = position.monthIndex === position.monthGroup.photos.length - 1;

    if (!isLastInRow && !isLastPhoto) {
      const targetIndex = position.monthIndex + 1;
      const targetPhoto = position.monthGroup.photos[targetIndex];
      if (targetPhoto) {
        return this.fileList.findIndex((f) => f.id === targetPhoto.id);
      }
    }

    // At rightmost position or last photo, try to move to the next month's first photo
    const nextMonthGroup = this.getNextMonthGroup(position.monthGroup);
    if (nextMonthGroup && nextMonthGroup.photos.length > 0) {
      const firstPhoto = nextMonthGroup.photos[0];
      return this.fileList.findIndex((f) => f.id === firstPhoto.id);
    }

    return undefined;
  }

  /**
   * Navigates up within the current month or to the previous month
   */
  private navigateUp(position: PhotoPosition): number | undefined {
    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();

    // If not in the first row, move up within the same month
    if (position.row > 0) {
      const targetIndex = position.monthIndex - itemsPerRow;
      const targetPhoto = position.monthGroup.photos[targetIndex];
      if (targetPhoto) {
        return this.fileList.findIndex((f) => f.id === targetPhoto.id);
      }
    }

    // In the first row, try to move to the previous month's last row, same column
    const prevMonthGroup = this.getPreviousMonthGroup(position.monthGroup);
    if (prevMonthGroup && prevMonthGroup.photos.length > 0) {
      const prevMonthRows = Math.ceil(prevMonthGroup.photos.length / itemsPerRow);
      const targetRow = prevMonthRows - 1;
      const targetIndex = targetRow * itemsPerRow + position.column;
      
      // If the target index is beyond the available photos, use the last photo
      const actualIndex = Math.min(targetIndex, prevMonthGroup.photos.length - 1);
      const targetPhoto = prevMonthGroup.photos[actualIndex];
      
      if (targetPhoto) {
        return this.fileList.findIndex((f) => f.id === targetPhoto.id);
      }
    }

    return undefined;
  }

  /**
   * Navigates down within the current month or to the next month
   */
  private navigateDown(position: PhotoPosition): number | undefined {
    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();
    const totalRows = Math.ceil(position.monthGroup.photos.length / itemsPerRow);

    // If not in the last row, move down within the same month
    if (position.row < totalRows - 1) {
      const targetIndex = position.monthIndex + itemsPerRow;
      const targetPhoto = position.monthGroup.photos[targetIndex];
      if (targetPhoto) {
        return this.fileList.findIndex((f) => f.id === targetPhoto.id);
      }
    }

    // In the last row, try to move to the next month's first row, same column
    const nextMonthGroup = this.getNextMonthGroup(position.monthGroup);
    if (nextMonthGroup && nextMonthGroup.photos.length > 0) {
      const targetIndex = Math.min(position.column, nextMonthGroup.photos.length - 1);
      const targetPhoto = nextMonthGroup.photos[targetIndex];
      
      if (targetPhoto) {
        return this.fileList.findIndex((f) => f.id === targetPhoto.id);
      }
    }

    return undefined;
  }

  /**
   * Gets the previous month group in chronological order
   */
  private getPreviousMonthGroup(currentGroup: MonthGroup): MonthGroup | undefined {
    const currentIndex = this.monthGroups.findIndex((g) => g.id === currentGroup.id);
    return currentIndex > 0 ? this.monthGroups[currentIndex - 1] : undefined;
  }

  /**
   * Gets the next month group in chronological order
   */
  private getNextMonthGroup(currentGroup: MonthGroup): MonthGroup | undefined {
    const currentIndex = this.monthGroups.findIndex((g) => g.id === currentGroup.id);
    return currentIndex < this.monthGroups.length - 1 ? this.monthGroups[currentIndex + 1] : undefined;
  }

  /**
   * Calculates the scroll position needed to make a photo visible
   */
  getScrollPositionForPhoto(globalIndex: number, containerHeight: number): number | undefined {
    const position = this.getPositionByGlobalIndex(globalIndex);
    if (!position) return undefined;

    const layoutItem = position.layoutItem;
    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();
    const thumbnailSize = this.layoutEngine['config'].thumbnailSize;
    const thumbnailPadding = this.layoutEngine['config'].thumbnailPadding;
    
    // Calculate the approximate position of the photo within the grid
    const rowHeight = thumbnailSize + thumbnailPadding;
    const photoTop = layoutItem.top + (position.row * rowHeight);
    const photoBottom = photoTop + thumbnailSize;

    // Center the photo in the viewport if possible
    const targetScrollTop = photoTop - (containerHeight / 2) + (thumbnailSize / 2);
    
    return Math.max(0, targetScrollTop);
  }
}