import { ClientFile } from '../../../entities/File';

/**
 * Represents a group of photos from the same month and year
 */
export interface MonthGroup {
  /** Full year (e.g., 2024) */
  year: number;
  /** Month (0-11, where 0 = January) */
  month: number;
  /** Photos in this month, sorted by dateCreated ascending */
  photos: ClientFile[];
  /** Display name for the month (e.g., "January 2024") */
  displayName: string;
  /** Unique identifier for this month group */
  id: string;
}

/**
 * Represents a layout item in the virtualized calendar view
 */
export interface LayoutItem {
  /** Type of layout item */
  type: 'header' | 'grid';
  /** Associated month group */
  monthGroup: MonthGroup;
  /** Top position in pixels from the start of the scrollable area */
  top: number;
  /** Height in pixels */
  height: number;
  /** Photos for grid items (undefined for header items) */
  photos?: ClientFile[];
  /** Unique identifier for this layout item */
  id: string;
}

/**
 * Represents a virtual item for rendering optimization
 */
export interface VirtualItem {
  /** Unique identifier */
  id: string;
  /** Type of virtual item */
  type: 'header' | 'photos';
  /** Top position in pixels */
  top: number;
  /** Height in pixels */
  height: number;
  /** Associated month group */
  monthGroup: MonthGroup;
  /** Whether this item is currently visible in the viewport */
  visible: boolean;
}

/**
 * Represents the range of visible items in the viewport
 */
export interface VisibleRange {
  /** Index of the first visible item */
  startIndex: number;
  /** Index of the last visible item */
  endIndex: number;
  /** Total number of items */
  totalItems: number;
}

/**
 * Configuration for calendar layout calculations
 */
export interface CalendarLayoutConfig {
  /** Container width in pixels */
  containerWidth: number;
  /** Thumbnail size in pixels */
  thumbnailSize: number;
  /** Padding between thumbnails in pixels */
  thumbnailPadding: number;
  /** Height of month headers in pixels */
  headerHeight: number;
  /** Margin between month groups in pixels */
  groupMargin: number;
}