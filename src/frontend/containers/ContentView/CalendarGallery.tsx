import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { action } from 'mobx';
import { GalleryProps, getThumbnailSize } from './utils';
import { useStore } from '../../contexts/StoreContext';
import { useWindowResize } from '../../hooks/useWindowResize';
import { ViewMethod } from '../../stores/UiStore';
import {
  safeGroupFilesByMonth,
  progressiveGroupFilesByMonth,
  validateMonthGroups,
  CalendarVirtualizedRenderer,
  MonthGroup,
  CalendarLayoutEngine,
  CalendarKeyboardNavigation,
  CalendarErrorBoundary,
  EmptyState,
  LoadingState,
} from './calendar';

// Generate a unique key for the current search state to persist scroll position
const generateSearchKey = (searchCriteriaList: any[], searchMatchAny: boolean): string => {
  const criteriaKey = searchCriteriaList
    .map((c) => (c.serialize ? c.serialize() : JSON.stringify(c)))
    .join('|');
  return `${criteriaKey}:${searchMatchAny}`;
};

const CalendarGallery = observer(({ contentRect, select, lastSelectionIndex }: GalleryProps) => {
  const { fileStore, uiStore } = useStore();
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLargeCollection, setIsLargeCollection] = useState(false);
  const [progressiveProgress, setProgressiveProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const keyboardNavigationRef = useRef<CalendarKeyboardNavigation | null>(null);
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | undefined>(undefined);
  const [initialScrollPosition, setInitialScrollPosition] = useState<number>(0);

  const thumbnailSize = getThumbnailSize(uiStore.thumbnailSize);

  // Generate search key for scroll position persistence
  const searchKey = useMemo(
    () => generateSearchKey(uiStore.searchCriteriaList, uiStore.searchMatchAny),
    [uiStore.searchCriteriaList, uiStore.searchMatchAny],
  );

  // Create layout engine for keyboard navigation with responsive handling
  const layoutEngine = useMemo(() => {
    return new CalendarLayoutEngine({
      containerWidth: contentRect.width,
      thumbnailSize,
      thumbnailPadding: 8,
      headerHeight: 48,
      groupMargin: 24,
    });
  }, [contentRect.width, thumbnailSize]);

  // Handle window resize events
  const { isResizing: isWindowResizing } = useWindowResize({
    debounceDelay: 200,
    trackInnerDimensions: true,
    onResize: (dimensions) => {
      // Only trigger layout recalculation if the width changes significantly
      if (layoutEngine && monthGroups.length > 0) {
        console.log('Window resized, updating calendar layout');
        setIsLayoutUpdating(true);

        // Small delay to allow UI to update
        setTimeout(() => {
          try {
            // Update layout engine with new dimensions
            layoutEngine.updateConfig({
              containerWidth: contentRect.width,
              thumbnailSize,
            });

            // Recalculate layout
            layoutEngine.calculateLayout(monthGroups);

            // Update keyboard navigation
            keyboardNavigationRef.current = new CalendarKeyboardNavigation(
              layoutEngine,
              fileStore.fileList,
              monthGroups,
            );
          } catch (error) {
            console.error('Error updating layout for window resize:', error);
          } finally {
            // Reset layout updating state after a brief delay
            setTimeout(() => {
              setIsLayoutUpdating(false);
            }, 200);
          }
        }, 0);
      }
    },
  });

  // Track previous thumbnail size for responsive updates
  const previousThumbnailSizeRef = useRef(thumbnailSize);
  const [isLayoutUpdating, setIsLayoutUpdating] = useState(false);

  // Handle thumbnail size changes with responsive layout updates
  useEffect(() => {
    const currentThumbnailSize = thumbnailSize;
    const previousThumbnailSize = previousThumbnailSizeRef.current;

    if (currentThumbnailSize !== previousThumbnailSize && monthGroups.length > 0) {
      setIsLayoutUpdating(true);

      // Update layout engine configuration
      layoutEngine.updateConfig({
        containerWidth: contentRect.width,
        thumbnailSize: currentThumbnailSize,
      });

      // Recalculate layout with new thumbnail size
      try {
        layoutEngine.calculateLayout(monthGroups);

        // Update keyboard navigation with new layout
        keyboardNavigationRef.current = new CalendarKeyboardNavigation(
          layoutEngine,
          fileStore.fileList,
          monthGroups,
        );

        console.log(
          `Thumbnail size changed from ${previousThumbnailSize} to ${currentThumbnailSize}, layout recalculated`,
        );
      } catch (error) {
        console.error('Error updating layout for thumbnail size change:', error);
      }

      // Reset layout updating state after a brief delay
      setTimeout(() => {
        setIsLayoutUpdating(false);
      }, 200);
    }

    previousThumbnailSizeRef.current = currentThumbnailSize;
  }, [thumbnailSize, monthGroups, layoutEngine, contentRect.width, fileStore.fileList]);

  // Group files by month when file list changes
  useEffect(() => {
    const processFiles = async () => {
      const fileCount = fileStore.fileList.length;

      // Determine if this is a large collection
      const isLarge = fileCount > 1000;
      setIsLargeCollection(isLarge);

      // Show loading state for large collections or initial load
      if (isLarge || fileCount > 100) {
        setIsLoading(true);
      }

      try {
        // Use setTimeout to allow UI to update with loading state
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Group files with error handling - use progressive loading for very large collections
        let groups: MonthGroup[];
        if (fileCount > 5000) {
          // Use progressive loading for very large collections
          groups = await progressiveGroupFilesByMonth(
            fileStore.fileList,
            1000,
            (processed, total) => {
              setProcessedCount(processed);
              setProgressiveProgress(Math.round((processed / total) * 100));
            },
          );
        } else {
          groups = safeGroupFilesByMonth(fileStore.fileList);
        }

        const validGroups = validateMonthGroups(groups);

        setMonthGroups(validGroups);

        // Update layout engine and keyboard navigation
        if (validGroups.length > 0) {
          layoutEngine.calculateLayout(validGroups);
          keyboardNavigationRef.current = new CalendarKeyboardNavigation(
            layoutEngine,
            fileStore.fileList,
            validGroups,
          );
        }

        // Set initial scroll position when entering calendar view
        const savedScrollPosition = uiStore.getCalendarScrollPosition(searchKey);
        setInitialScrollPosition(savedScrollPosition);
      } catch (error) {
        console.error('Error processing files for calendar view:', error);
        // Set empty groups on error - error boundary will handle display
        setMonthGroups([]);
      } finally {
        setIsLoading(false);
      }
    };

    processFiles();
  }, [fileStore.fileList, fileStore.fileListLastModified, layoutEngine, searchKey, uiStore]);

  // Update focused photo when selection changes from outside keyboard navigation
  useEffect(() => {
    const currentIndex = lastSelectionIndex.current;
    if (currentIndex !== undefined && fileStore.fileList[currentIndex]) {
      const selectedFile = fileStore.fileList[currentIndex];
      setFocusedPhotoId(selectedFile.id);
    }
  }, [fileStore.fileList, lastSelectionIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    const onKeyDown = action((e: KeyboardEvent) => {
      if (!monthGroups.length || !keyboardNavigationRef.current) {
        return;
      }

      const currentIndex = lastSelectionIndex.current;
      if (currentIndex === undefined) {
        return;
      }

      let newIndex: number | null = null;

      // Handle arrow key navigation
      if (e.key === 'ArrowUp') {
        newIndex = keyboardNavigationRef.current.getNextPhotoIndex(currentIndex, 'up');
      } else if (e.key === 'ArrowDown') {
        newIndex = keyboardNavigationRef.current.getNextPhotoIndex(currentIndex, 'down');
      } else if (e.key === 'ArrowLeft') {
        newIndex = keyboardNavigationRef.current.getNextPhotoIndex(currentIndex, 'left');
      } else if (e.key === 'ArrowRight') {
        newIndex = keyboardNavigationRef.current.getNextPhotoIndex(currentIndex, 'right');
      }

      if (newIndex !== null && newIndex !== currentIndex) {
        e.preventDefault();

        // Handle multi-selection with Ctrl+click and Shift+click patterns
        const isAdditive = e.ctrlKey || e.metaKey;
        const isRange = e.shiftKey;

        const newFile = fileStore.fileList[newIndex];
        select(newFile, isAdditive, isRange);

        // Update focused photo for visual feedback
        setFocusedPhotoId(newFile.id);

        // Scroll to ensure the selected photo is visible (smooth scrolling to selected items)
        const scrollPosition = keyboardNavigationRef.current.getScrollPositionForPhoto(newIndex);
        if (scrollPosition !== null && containerRef.current) {
          const containerHeight = containerRef.current.clientHeight;
          const currentScrollTop = containerRef.current.scrollTop;
          const photoHeight = thumbnailSize + 16; // thumbnail + padding

          // Check if photo is outside viewport
          if (
            scrollPosition < currentScrollTop ||
            scrollPosition > currentScrollTop + containerHeight - photoHeight
          ) {
            // Smooth scroll to center the photo in viewport
            const targetScrollTop = Math.max(0, scrollPosition - containerHeight / 2);
            containerRef.current.scrollTo({
              top: targetScrollTop,
              behavior: 'smooth',
            });
          }
        }
      }
    });

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [monthGroups, fileStore.fileList, select, lastSelectionIndex, thumbnailSize]);

  // Handle scroll position persistence when switching between view modes
  const handleScroll = useCallback(
    (scrollTop: number) => {
      uiStore.setCalendarScrollPosition(searchKey, scrollTop);
    },
    [searchKey, uiStore],
  );

  // Scroll to selected item when selection changes from outside
  useEffect(() => {
    const currentIndex = lastSelectionIndex.current;
    if (currentIndex !== undefined && keyboardNavigationRef.current && containerRef.current) {
      const scrollPosition = keyboardNavigationRef.current.getScrollPositionForPhoto(currentIndex);
      if (scrollPosition !== null) {
        const containerHeight = containerRef.current.clientHeight;
        const currentScrollTop = containerRef.current.scrollTop;
        const photoHeight = thumbnailSize + 16;

        // Only scroll if the selected item is not visible
        if (
          scrollPosition < currentScrollTop ||
          scrollPosition > currentScrollTop + containerHeight - photoHeight
        ) {
          const targetScrollTop = Math.max(0, scrollPosition - containerHeight / 2);
          containerRef.current.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth',
          });
        }
      }
    }
  }, [lastSelectionIndex, thumbnailSize]);

  // Note: Scroll-to-date functionality available for future enhancements
  // Can be implemented when needed by accessing layoutEngine.getScrollPositionForDate

  // Handle retry functionality for error boundary
  const handleRetry = useCallback(() => {
    setIsLoading(true);
    setMonthGroups([]);
    // Trigger re-processing by updating a dependency
    const processFiles = async () => {
      try {
        const groups = safeGroupFilesByMonth(fileStore.fileList);
        const validGroups = validateMonthGroups(groups);
        setMonthGroups(validGroups);
      } catch (error) {
        console.error('Retry failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    processFiles();
  }, [fileStore.fileList]);

  // Handle fallback to different view
  const handleFallback = useCallback(() => {
    // Switch to list view as fallback
    uiStore.setMethod(ViewMethod.List);
  }, [uiStore]);

  // Show empty state if no files
  if (fileStore.fileList.length === 0) {
    return (
      <div className="calendar-gallery">
        <EmptyState type="no-photos" />
      </div>
    );
  }

  // Show loading state while processing files
  if (isLoading) {
    const fileCount = fileStore.fileList.length;
    const isVeryLargeCollection = fileCount > 5000;
    const loadingType = isVeryLargeCollection
      ? 'progressive'
      : isLargeCollection
      ? 'large-collection'
      : 'initial';

    return (
      <div className="calendar-gallery">
        <LoadingState
          type={loadingType}
          itemCount={fileCount}
          processedCount={processedCount}
          showProgress={isLargeCollection || isVeryLargeCollection}
          progress={isVeryLargeCollection ? progressiveProgress : undefined}
        />
      </div>
    );
  }

  // Show empty state if no valid groups after processing
  if (monthGroups.length === 0 && fileStore.fileList.length > 0 && !isLoading) {
    return (
      <div className="calendar-gallery">
        <EmptyState
          type="processing-error"
          message="Unable to group photos by date. This may be due to missing date metadata or processing errors."
          action={{
            label: 'Switch to List View',
            onClick: handleFallback,
          }}
        />
      </div>
    );
  }

  return (
    <CalendarErrorBoundary onRetry={handleRetry} onFallback={handleFallback}>
      <div ref={containerRef} className="calendar-gallery">
        <CalendarVirtualizedRenderer
          monthGroups={monthGroups}
          containerWidth={contentRect.width}
          containerHeight={contentRect.height}
          thumbnailSize={thumbnailSize}
          onPhotoSelect={select}
          onScrollChange={handleScroll}
          initialScrollTop={initialScrollPosition}
          overscan={2}
          focusedPhotoId={focusedPhotoId}
          isLoading={isLoading || isLayoutUpdating}
          isLargeCollection={isLargeCollection}
        />
      </div>
    </CalendarErrorBoundary>
  );
});

export default CalendarGallery;
