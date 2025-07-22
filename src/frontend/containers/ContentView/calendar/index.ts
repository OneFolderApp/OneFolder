// Core types
export type {
  MonthGroup,
  LayoutItem,
  VirtualItem,
  VisibleRange,
  CalendarLayoutConfig,
} from './types';

// Date utilities
export {
  formatMonthYear,
  createMonthGroupId,
  extractMonthYear,
  groupFilesByMonth,
  safeGroupFilesByMonth,
  progressiveGroupFilesByMonth,
  isReasonablePhotoDate,
  getSafeDateForGrouping,
  isValidMonthGroup,
  validateMonthGroups,
} from './dateUtils';

// Layout engine
export { CalendarLayoutEngine, DEFAULT_LAYOUT_CONFIG } from './layoutEngine';

// Keyboard navigation
export { CalendarKeyboardNavigation } from './CalendarKeyboardNavigation';

// Components
export { MonthHeader } from './MonthHeader';
export type { MonthHeaderProps } from './MonthHeader';
export { PhotoGrid } from './PhotoGrid';
export type { PhotoGridProps } from './PhotoGrid';
export { CalendarVirtualizedRenderer } from './CalendarVirtualizedRenderer';
export type { CalendarVirtualizedRendererProps } from './CalendarVirtualizedRenderer';

// State components
export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';
export { LoadingState } from './LoadingState';
export type { LoadingStateProps } from './LoadingState';

// Error handling
export { CalendarErrorBoundary } from './CalendarErrorBoundary';

// Responsive layout hook
export { useResponsiveLayout } from './useResponsiveLayout';
export type { ResponsiveLayoutConfig, ResponsiveLayoutResult } from './useResponsiveLayout';

// Performance optimization
export { CalendarPerformanceMonitor, calendarPerformanceMonitor } from './PerformanceMonitor';
export type { PerformanceMetrics, PerformanceThresholds } from './PerformanceMonitor';

// Memory management
export { CalendarMemoryManager, calendarMemoryManager } from './MemoryManager';
export type { MemoryManagerConfig, ThumbnailCacheEntry } from './MemoryManager';

// Optimized date grouping
export {
  OptimizedDateGroupingEngine,
  createOptimizedGroupingEngine,
} from './OptimizedDateGrouping';
export type { GroupingConfig, GroupingProgress, GroupingResult } from './OptimizedDateGrouping';

// Progressive loading
export { ProgressiveLoader, useProgressiveLoader } from './ProgressiveLoader';
export type { ProgressiveLoaderProps, ProgressiveLoaderState } from './ProgressiveLoader';
