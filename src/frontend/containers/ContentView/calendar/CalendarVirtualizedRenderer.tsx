import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { ClientFile } from '../../../entities/File';
import { MonthGroup, LayoutItem, VisibleRange } from './types';
import { CalendarLayoutEngine } from './layoutEngine';
import { MonthHeader } from './MonthHeader';
import { PhotoGrid } from './PhotoGrid';
import { debouncedThrottle } from 'common/timeout';

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
  }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(initialScrollTop);
    const [isScrolling, setIsScrolling] = useState(false);

    // Create layout engine instance
    const layoutEngine = useMemo(() => {
      const engine = new CalendarLayoutEngine({
        containerWidth,
        thumbnailSize,
        thumbnailPadding: 8,
        headerHeight: 48,
        groupMargin: 24,
      });
      return engine;
    }, [containerWidth, thumbnailSize]);

    // Calculate layout when month groups or layout config changes
    const layoutItems = useMemo(() => {
      if (monthGroups.length === 0) {
        return [];
      }
      return layoutEngine.calculateLayout(monthGroups);
    }, [layoutEngine, monthGroups]);

    // Calculate total height for the scrollable area
    const totalHeight = useMemo(() => {
      return layoutEngine.getTotalHeight();
    }, [layoutEngine]);

    // Find visible items based on current scroll position
    const visibleRange = useMemo((): VisibleRange => {
      if (layoutItems.length === 0) {
        return { startIndex: 0, endIndex: 0, totalItems: 0 };
      }
      return layoutEngine.findVisibleItems(scrollTop, containerHeight, overscan);
    }, [layoutEngine, scrollTop, containerHeight, overscan, layoutItems.length]);

    // Get visible layout items
    const visibleItems = useMemo(() => {
      return layoutItems.slice(visibleRange.startIndex, visibleRange.endIndex + 1);
    }, [layoutItems, visibleRange.startIndex, visibleRange.endIndex]);

    // Throttled scroll handler to prevent performance issues
    const throttledScrollHandler = useRef(
      debouncedThrottle((newScrollTop: number) => {
        setScrollTop(newScrollTop);
        onScrollChange?.(newScrollTop);
        setIsScrolling(false);
      }, 16), // ~60fps
    );

    // Handle scroll events
    const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
      const target = event.currentTarget;
      const newScrollTop = target.scrollTop;

      setIsScrolling(true);
      throttledScrollHandler.current(newScrollTop);
    }, []);

    // Set initial scroll position
    useEffect(() => {
      if (scrollContainerRef.current && initialScrollTop > 0) {
        scrollContainerRef.current.scrollTop = initialScrollTop;
        setScrollTop(initialScrollTop);
      }
    }, [initialScrollTop]);

    // Update layout engine configuration when props change
    useEffect(() => {
      layoutEngine.updateConfig({
        containerWidth,
        thumbnailSize,
      });
    }, [layoutEngine, containerWidth, thumbnailSize]);

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

    // Handle empty state
    if (monthGroups.length === 0) {
      return (
        <div className="calendar-virtualized-renderer calendar-virtualized-renderer--empty">
          <div className="calendar-empty-state">
            <p>No photos to display</p>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={scrollContainerRef}
        className={`calendar-virtualized-renderer${
          isScrolling ? ' calendar-virtualized-renderer--scrolling' : ''
        }`}
        style={{
          height: containerHeight,
          overflow: 'auto',
          position: 'relative',
        }}
        onScroll={handleScroll}
        role="grid"
        aria-label="Calendar view of photos"
      >
        {/* Spacer to create the full scrollable height */}
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
            }}
          >
            {renderVisibleItems()}
          </div>
        </div>
      </div>
    );
  },
);
