import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ClientFile } from '../../../entities/File';
import { MonthGroup, VisibleRange } from './types';
import { MonthHeader } from './MonthHeader';
import { PhotoGrid } from './PhotoGrid';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { debouncedThrottle } from 'common/timeout';
import { useResponsiveLayout } from './useResponsiveLayout';
import { calendarMemoryManager } from './MemoryManager';
import { calendarPerformanceMonitor } from './PerformanceMonitor';

export interface CalendarVirtualizedRendererProps {
  /** Grouped photo data organized by month */
  monthGroups: MonthGroup[];
  /** Total height of the scrollable container */
  containerHeight: number;
  /** Available width for layout calculations */
  containerWidth: number;
  /** Number of extra items to render outside viewport for smooth scrolling */
  overscan?: number;
  /** Current thumbnail size setting */
  thumbnailSize: number;
  /** Callback for photo selection events */
  onPhotoSelect: (photo: ClientFile, additive: boolean, range: boolean) => void;
  /** Callback for scroll position changes */
  onScrollChange?: (scrollTop: number) => void;
  /** Initial scroll position */
  initialScrollTop?: number;
  /** ID of the currently focused photo (for keyboard navigation) */
  focusedPhotoId?: string;
  /** Loading state for initial data processing */
  isLoading?: boolean;
  /** Whether this is a large collection that may need special handling */
  isLargeCollection?: boolean;
}

/**
 * CalendarVirtualizedRenderer handles virtualization logic for smooth scrolling performance
 * in the calendar view. It renders only visible month headers and photo grids based on the
 * current viewport position, with an overscan buffer for smooth scrolling.
 */
export const CalendarVirtualizedRenderer: React.FC<CalendarVirtualizedRendererProps> = observer(
  ({
    monthGroups,
    containerHeight,
    containerWidth,
    overscan = 2,
    thumbnailSize,
    onPhotoSelect,
    onScrollChange,
    initialScrollTop = 0,
    focusedPhotoId,
    isLoading = false,
    isLargeCollection = false,
  }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(initialScrollTop);
    const [isScrolling, setIsScrolling] = useState(false);
    const [layoutError, setLayoutError] = useState<string | null>(null);
    const [memoryWarning, setMemoryWarning] = useState(false);

    // Use responsive layout hook for handling window resize and layout recalculation
    const { layoutEngine, isRecalculating, itemsPerRow, isResponsive, forceRecalculate } =
      useResponsiveLayout(
        {
          containerWidth,
          containerHeight,
          thumbnailSize,
          debounceDelay: 150,
          minContainerWidth: 200,
          maxItemsPerRow: 15,
        },
        monthGroups,
      );

    // Calculate layout when month groups or layout config changes
    const layoutItems = useMemo(() => {
      if (monthGroups.length === 0) {
        return [];
      }

      try {
        setLayoutError(null);
        return layoutEngine.calculateLayout(monthGroups);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown layout error';
        setLayoutError(errorMessage);
        console.error('Layout calculation failed:', error);
        return [];
      }
    }, [layoutEngine, monthGroups]);

    // Calculate total height for the scrollable area
    const totalHeight = useMemo(() => {
      try {
        return layoutEngine.getTotalHeight();
      } catch (error) {
        console.error('Error getting total height:', error);
        return 0;
      }
    }, [layoutEngine]);

    // Find visible items based on current scroll position
    const visibleRange = useMemo((): VisibleRange => {
      if (layoutItems.length === 0) {
        return { startIndex: 0, endIndex: 0, totalItems: 0 };
      }

      try {
        return layoutEngine.findVisibleItems(scrollTop, containerHeight, overscan);
      } catch (error) {
        console.error('Error finding visible items:', error);
        return {
          startIndex: 0,
          endIndex: Math.min(5, layoutItems.length - 1),
          totalItems: layoutItems.length,
        };
      }
    }, [layoutEngine, scrollTop, containerHeight, overscan, layoutItems.length]);

    // Get visible layout items and update memory manager
    const visibleItems = useMemo(() => {
      const items = layoutItems.slice(visibleRange.startIndex, visibleRange.endIndex + 1);

      // Update memory manager with visibility information
      const visibleFileIds: string[] = [];
      const allFileIds: string[] = [];

      for (const group of monthGroups) {
        for (const photo of group.photos) {
          allFileIds.push(photo.id);
        }
      }

      for (const item of items) {
        if (item.type === 'grid' && item.photos) {
          for (const photo of item.photos) {
            visibleFileIds.push(photo.id);
          }
        }
      }

      calendarMemoryManager.updateVisibility(visibleFileIds, allFileIds);

      // Record virtualization metrics
      calendarPerformanceMonitor.recordVirtualizationMetrics(
        visibleRange.endIndex - visibleRange.startIndex + 1,
        layoutItems.length,
      );

      return items;
    }, [layoutItems, visibleRange.startIndex, visibleRange.endIndex, monthGroups]);

    // Throttled scroll handler to prevent performance issues
    const throttledScrollHandler = useRef(
      debouncedThrottle((newScrollTop: number) => {
        setScrollTop(newScrollTop);
        onScrollChange?.(newScrollTop);
        setIsScrolling(false);
      }, 16), // ~60fps
    );

    // Handle scroll events with performance monitoring
    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const newScrollTop = target.scrollTop;

      setIsScrolling(true);

      // Record scroll performance metrics
      calendarPerformanceMonitor.recordScrollEvent();

      throttledScrollHandler.current(newScrollTop);
    }, []);

    // Set initial scroll position
    useEffect(() => {
      if (scrollContainerRef.current && initialScrollTop > 0) {
        scrollContainerRef.current.scrollTop = initialScrollTop;
        setScrollTop(initialScrollTop);
      }
    }, [initialScrollTop]);

    // Handle layout recalculation errors
    useEffect(() => {
      if (layoutError) {
        console.error('Layout calculation error detected:', layoutError);
        // Try to recover by forcing a recalculation
        setTimeout(() => {
          try {
            forceRecalculate();
            setLayoutError(null);
          } catch (error) {
            console.error('Failed to recover from layout error:', error);
          }
        }, 1000);
      }
    }, [layoutError, forceRecalculate]);

    // Monitor memory usage and manage thumbnail resources for very large collections
    useEffect(() => {
      if (monthGroups.length > 0) {
        const totalPhotos = monthGroups.reduce((sum, group) => sum + group.photos.length, 0);

        // Configure memory manager based on collection size
        if (totalPhotos > 5000) {
          calendarMemoryManager.updateConfig({
            maxThumbnailCache: Math.min(2000, Math.floor(totalPhotos * 0.1)),
            aggressiveCleanup: totalPhotos > 20000,
          });
        }

        // Show memory warning for extremely large collections
        if (totalPhotos > 10000) {
          setMemoryWarning(true);
          console.warn(
            `Calendar view: Large collection detected (${totalPhotos} photos). Performance may be impacted.`,
          );

          // Set up memory pressure callback
          const memoryPressureCallback = () => {
            console.warn('Memory pressure detected in calendar view');
            setMemoryWarning(true);
          };
          calendarMemoryManager.onMemoryPressure(memoryPressureCallback);

          return () => {
            calendarMemoryManager.offMemoryPressure(memoryPressureCallback);
          };
        } else {
          setMemoryWarning(false);
        }

        // Record performance metrics
        calendarPerformanceMonitor.setCollectionMetrics(totalPhotos, monthGroups.length);
        calendarPerformanceMonitor.estimateMemoryUsage(totalPhotos, thumbnailSize);
      }
    }, [monthGroups, thumbnailSize]);

    // Render visible items
    const renderVisibleItems = () => {
      return visibleItems.map((item) => {
        const key = item.id;
        const style: React.CSSProperties = {
          position: 'absolute',
          top: item.top,
          left: 0,
          right: 0,
          height: item.height,
          willChange: isScrolling ? 'transform' : 'auto',
        };

        if (item.type === 'header') {
          return (
            <div key={key} style={style}>
              <MonthHeader
                monthGroup={item.monthGroup}
                photoCount={item.monthGroup.photos.length}
              />
            </div>
          );
        } else if (item.type === 'grid' && item.photos) {
          return (
            <div key={key} style={style}>
              <PhotoGrid
                photos={item.photos}
                containerWidth={containerWidth}
                onPhotoSelect={onPhotoSelect}
                focusedPhotoId={focusedPhotoId}
              />
            </div>
          );
        }

        return null;
      });
    };

    // Handle loading state
    if (isLoading) {
      const loadingType = isLargeCollection ? 'large-collection' : 'initial';
      return (
        <div className="calendar-virtualized-renderer calendar-virtualized-renderer--loading">
          <LoadingState type={loadingType} />
        </div>
      );
    }

    // Handle layout error
    if (layoutError) {
      return (
        <div className="calendar-virtualized-renderer calendar-virtualized-renderer--error">
          <EmptyState
            type="processing-error"
            message={`Layout calculation failed: ${layoutError}`}
            action={{
              label: 'Switch to List View',
              onClick: () => {
                // This would be handled by parent component
                console.log('Fallback to list view requested');
              },
            }}
          />
        </div>
      );
    }

    // Handle empty state
    if (monthGroups.length === 0) {
      return (
        <div className="calendar-virtualized-renderer calendar-virtualized-renderer--empty">
          <EmptyState type="no-photos" />
        </div>
      );
    }

    // Determine aspect ratio class for responsive styling
    const aspectRatio = containerWidth / containerHeight;
    const aspectRatioClass = aspectRatio >= 1 ? 'landscape' : 'portrait';

    // Determine thumbnail size class for responsive styling
    const getThumbnailSizeClass = () => {
      if (thumbnailSize <= 120) {
        return 'small';
      }
      if (thumbnailSize <= 180) {
        return 'medium';
      }
      return 'large';
    };

    return (
      <div
        ref={scrollContainerRef}
        className={`calendar-virtualized-renderer${
          isScrolling ? ' calendar-virtualized-renderer--scrolling' : ''
        }${isResponsive ? ' calendar-virtualized-renderer--responsive' : ''}${
          isRecalculating ? ' calendar-virtualized-renderer--recalculating' : ''
        }`}
        style={{
          height: containerHeight,
          overflow: 'auto',
          position: 'relative',
        }}
        onScroll={handleScroll}
        role="grid"
        aria-label="Calendar view of photos"
        data-items-per-row={itemsPerRow}
        data-responsive={isResponsive}
        data-aspect-ratio={aspectRatioClass}
        data-thumbnail-size={getThumbnailSizeClass()}
      >
        {/* Show recalculation indicator for significant layout changes */}
        {isRecalculating && (
          <div className="calendar-layout-recalculating">
            <div className="calendar-layout-recalculating__indicator">Adjusting layout...</div>
          </div>
        )}

        {/* Spacer to create the full scrollable height */}
        {/* Show recalculation indicator for significant layout changes */}
        {isRecalculating && (
          <div className="calendar-layout-recalculating">
            <div className="calendar-layout-recalculating__indicator">Adjusting layout...</div>
          </div>
        )}

        <div
          style={{
            height: totalHeight,
            position: 'relative',
            pointerEvents: 'none',
          }}
        >
          {/* Render only visible items */}
          <div
            style={{
              position: 'relative',
              pointerEvents: 'auto',
              opacity: isRecalculating ? 0.7 : 1,
              transition: isResponsive ? 'opacity 0.2s ease-in-out' : 'none',
            }}
          >
            {renderVisibleItems()}
          </div>
        </div>
      </div>
    );
  },
);
