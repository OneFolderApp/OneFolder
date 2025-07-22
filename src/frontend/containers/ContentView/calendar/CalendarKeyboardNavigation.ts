import { ClientFile } from '../../../entities/File';
import { MonthGroup } from './types';
import { CalendarLayoutEngine } from './layoutEngine';

/**
 * Position information for a photo in the calendar grid
 */
interface PhotoPosition {
  /** The file object */
  file: ClientFile;
  /** Index in the global file list */
  globalIndex: number;
  /** Month group this photo belongs to */
  monthGroup: MonthGroup;
  /** Index within the month group */
  monthIndex: number;
  /** Row within the month grid */
  row: number;
  /** Column within the month grid */
  column: number;
}

/**
 * Handles keyboard navigation for the calendar view
 */
export class CalendarKeyboardNavigation {
  private layoutEngine: CalendarLayoutEngine;
  private fileList: ClientFile[];
  private monthGroups: MonthGroup[];
  private photoPositions: Map<string, PhotoPosition> = new Map();
  private fileIndexMap: Map<string, number> = new Map();

  constructor(
    layoutEngine: CalendarLayoutEngine,
    fileList: ClientFile[],
    monthGroups: MonthGroup[],
  ) {
    this.layoutEngine = layoutEngine;
    this.fileList = fileList;
    this.monthGroups = monthGroups;
    this.buildPhotoPositions();
  }

  /**
   * Builds a map of photo positions for efficient navigation
   */
  private buildPhotoPositions(): void {
    this.photoPositions.clear();
    this.fileIndexMap.clear();

    // Build file index map for quick lookups
    this.fileList.forEach((file, index) => {
      this.fileIndexMap.set(file.id, index);
    });

    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();

    for (const monthGroup of this.monthGroups) {
      monthGroup.photos.forEach((file, monthIndex) => {
        const globalIndex = this.fileIndexMap.get(file.id);
        if (globalIndex === undefined) {
          return;
        }

        const row = Math.floor(monthIndex / itemsPerRow);
        const column = monthIndex % itemsPerRow;

        const position: PhotoPosition = {
          file,
          globalIndex,
          monthGroup,
          monthIndex,
          row,
          column,
        };

        this.photoPositions.set(file.id, position);
      });
    }
  }

  /**
   * Gets the next photo index for arrow key navigation
   */
  getNextPhotoIndex(
    currentIndex: number,
    direction: 'up' | 'down' | 'left' | 'right',
  ): number | null {
    if (currentIndex < 0 || currentIndex >= this.fileList.length) {
      return null;
    }

    const currentFile = this.fileList[currentIndex];
    const currentPosition = this.photoPositions.get(currentFile.id);

    if (!currentPosition) {
      return null;
    }

    switch (direction) {
      case 'left':
        return this.getLeftPhoto(currentPosition);
      case 'right':
        return this.getRightPhoto(currentPosition);
      case 'up':
        return this.getUpPhoto(currentPosition);
      case 'down':
        return this.getDownPhoto(currentPosition);
      default:
        return null;
    }
  }

  /**
   * Gets the photo to the left of the current position
   */
  private getLeftPhoto(currentPosition: PhotoPosition): number | null {
    // If we're at the leftmost column, go to the previous row's rightmost photo
    if (currentPosition.column === 0) {
      if (currentPosition.row === 0) {
        // We're at the top-left of this month, go to previous month's last photo
        return this.getPreviousMonthLastPhoto(currentPosition.monthGroup);
      } else {
        // Go to previous row's rightmost photo in same month
        return this.getPhotoAtPosition(
          currentPosition.monthGroup,
          currentPosition.row - 1,
          this.getLastColumnInRow(currentPosition.monthGroup, currentPosition.row - 1),
        );
      }
    } else {
      // Go to previous column in same row
      return this.getPhotoAtPosition(
        currentPosition.monthGroup,
        currentPosition.row,
        currentPosition.column - 1,
      );
    }
  }

  /**
   * Gets the photo to the right of the current position
   */
  private getRightPhoto(currentPosition: PhotoPosition): number | null {
    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();
    const lastColumnInRow = this.getLastColumnInRow(
      currentPosition.monthGroup,
      currentPosition.row,
    );

    // If we're at the rightmost column of this row, go to next row's leftmost photo
    if (currentPosition.column >= lastColumnInRow) {
      const totalRows = Math.ceil(currentPosition.monthGroup.photos.length / itemsPerRow);
      if (currentPosition.row >= totalRows - 1) {
        // We're at the bottom-right of this month, go to next month's first photo
        return this.getNextMonthFirstPhoto(currentPosition.monthGroup);
      } else {
        // Go to next row's leftmost photo in same month
        return this.getPhotoAtPosition(currentPosition.monthGroup, currentPosition.row + 1, 0);
      }
    } else {
      // Go to next column in same row
      return this.getPhotoAtPosition(
        currentPosition.monthGroup,
        currentPosition.row,
        currentPosition.column + 1,
      );
    }
  }

  /**
   * Gets the photo above the current position
   */
  private getUpPhoto(currentPosition: PhotoPosition): number | null {
    if (currentPosition.row === 0) {
      // We're in the top row, go to previous month's last row, same column
      return this.getPreviousMonthSameColumn(currentPosition);
    } else {
      // Go to previous row, same column
      return this.getPhotoAtPosition(
        currentPosition.monthGroup,
        currentPosition.row - 1,
        currentPosition.column,
      );
    }
  }

  /**
   * Gets the photo below the current position
   */
  private getDownPhoto(currentPosition: PhotoPosition): number | null {
    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();
    const totalRows = Math.ceil(currentPosition.monthGroup.photos.length / itemsPerRow);

    if (currentPosition.row >= totalRows - 1) {
      // We're in the bottom row, go to next month's first row, same column
      return this.getNextMonthSameColumn(currentPosition);
    } else {
      // Go to next row, same column
      return this.getPhotoAtPosition(
        currentPosition.monthGroup,
        currentPosition.row + 1,
        currentPosition.column,
      );
    }
  }

  /**
   * Gets a photo at a specific position within a month group
   */
  private getPhotoAtPosition(monthGroup: MonthGroup, row: number, column: number): number | null {
    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();
    const monthIndex = row * itemsPerRow + column;

    if (monthIndex >= 0 && monthIndex < monthGroup.photos.length) {
      const file = monthGroup.photos[monthIndex];
      return this.fileIndexMap.get(file.id) ?? null;
    }

    return null;
  }

  /**
   * Gets the last column index for a specific row in a month group
   */
  private getLastColumnInRow(monthGroup: MonthGroup, row: number): number {
    const itemsPerRow = this.layoutEngine.calculateItemsPerRow();
    const startIndex = row * itemsPerRow;
    const endIndex = Math.min(startIndex + itemsPerRow - 1, monthGroup.photos.length - 1);
    return endIndex - startIndex;
  }

  /**
   * Gets the last photo of the previous month
   */
  private getPreviousMonthLastPhoto(currentMonth: MonthGroup): number | null {
    const currentMonthIndex = this.monthGroups.findIndex((group) => group.id === currentMonth.id);

    if (currentMonthIndex > 0) {
      const previousMonth = this.monthGroups[currentMonthIndex - 1];
      if (previousMonth.photos.length > 0) {
        const lastPhoto = previousMonth.photos[previousMonth.photos.length - 1];
        return this.fileIndexMap.get(lastPhoto.id) ?? null;
      }
    }

    return null;
  }

  /**
   * Gets the first photo of the next month
   */
  private getNextMonthFirstPhoto(currentMonth: MonthGroup): number | null {
    const currentMonthIndex = this.monthGroups.findIndex((group) => group.id === currentMonth.id);

    if (currentMonthIndex < this.monthGroups.length - 1) {
      const nextMonth = this.monthGroups[currentMonthIndex + 1];
      if (nextMonth.photos.length > 0) {
        const firstPhoto = nextMonth.photos[0];
        return this.fileIndexMap.get(firstPhoto.id) ?? null;
      }
    }

    return null;
  }

  /**
   * Gets the photo in the previous month at the same column position
   */
  private getPreviousMonthSameColumn(currentPosition: PhotoPosition): number | null {
    const currentMonthIndex = this.monthGroups.findIndex(
      (group) => group.id === currentPosition.monthGroup.id,
    );

    if (currentMonthIndex > 0) {
      const previousMonth = this.monthGroups[currentMonthIndex - 1];
      const itemsPerRow = this.layoutEngine.calculateItemsPerRow();
      const totalRows = Math.ceil(previousMonth.photos.length / itemsPerRow);

      // Try to find a photo in the last row at the same column
      for (let row = totalRows - 1; row >= 0; row--) {
        const photoIndex = this.getPhotoAtPosition(previousMonth, row, currentPosition.column);
        if (photoIndex !== null) {
          return photoIndex;
        }
      }
    }

    return null;
  }

  /**
   * Gets the photo in the next month at the same column position
   */
  private getNextMonthSameColumn(currentPosition: PhotoPosition): number | null {
    const currentMonthIndex = this.monthGroups.findIndex(
      (group) => group.id === currentPosition.monthGroup.id,
    );

    if (currentMonthIndex < this.monthGroups.length - 1) {
      const nextMonth = this.monthGroups[currentMonthIndex + 1];

      // Try to find a photo in the first row at the same column
      const photoIndex = this.getPhotoAtPosition(nextMonth, 0, currentPosition.column);
      if (photoIndex !== null) {
        return photoIndex;
      }

      // If no photo at same column, get the first photo of the next month
      if (nextMonth.photos.length > 0) {
        const firstPhoto = nextMonth.photos[0];
        return this.fileIndexMap.get(firstPhoto.id) ?? null;
      }
    }

    return null;
  }

  /**
   * Gets the scroll position needed to ensure a photo is visible
   */
  getScrollPositionForPhoto(fileIndex: number): number | null {
    if (fileIndex < 0 || fileIndex >= this.fileList.length) {
      return null;
    }

    const file = this.fileList[fileIndex];
    const position = this.photoPositions.get(file.id);

    if (!position) {
      return null;
    }

    // Get the layout item for this month's grid
    const layoutItems = this.layoutEngine.getLayoutItems();
    const gridItem = layoutItems.find(
      (item) => item.type === 'grid' && item.monthGroup.id === position.monthGroup.id,
    );

    if (!gridItem) {
      return null;
    }

    // Calculate the approximate position of the photo within the grid
    const config = (this.layoutEngine as any).config; // Access private config
    const rowHeight = config.thumbnailSize + config.thumbnailPadding;
    const photoTop = gridItem.top + position.row * rowHeight;

    return photoTop;
  }

  /**
   * Updates the navigation state when the layout changes
   */
  updateLayout(
    layoutEngine: CalendarLayoutEngine,
    fileList: ClientFile[],
    monthGroups: MonthGroup[],
  ): void {
    this.layoutEngine = layoutEngine;
    this.fileList = fileList;
    this.monthGroups = monthGroups;
    this.buildPhotoPositions();
  }
}
