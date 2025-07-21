import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { action } from 'mobx';
import { GalleryProps, getThumbnailSize } from './utils';
import { useStore } from '../../contexts/StoreContext';
import {
  groupFilesByMonth,
  CalendarVirtualizedRenderer,
  MonthGroup,
  CalendarLayoutEngine,
  CalendarKeyboardNavigation,
} from './calendar';

const CalendarGallery = observer(({ contentRect, select, lastSelectionIndex }: GalleryProps) => {
  const { fileStore, uiStore } = useStore();
  const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const keyboardNavigationRef = useRef<CalendarKeyboardNavigation | null>(null);
  const [focusedPhotoId, setFocusedPhotoId] = useState<string | undefined>(undefined);

  const thumbnailSize = getThumbnailSize(uiStore.thumbnailSize);

  // Create layout engine for keyboard navigation
  const layoutEngine = useMemo(() => {
    return new CalendarLayoutEngine({
      containerWidth: contentRect.width,
      thumbnailSize,
      thumbnailPadding: 8,
      headerHeight: 48,
      groupMargin: 24,
    });
  }, [contentRect.width, thumbnailSize]);

  // Group files by month when file list changes
  useEffect(() => {
    const groups = groupFilesByMonth(fileStore.fileList);
    setMonthGroups(groups);

    // Update layout engine and keyboard navigation
    if (groups.length > 0) {
      layoutEngine.calculateLayout(groups);
      keyboardNavigationRef.current = new CalendarKeyboardNavigation(
        layoutEngine,
        fileStore.fileList,
        groups,
      );
    }
  }, [fileStore.fileList, fileStore.fileListLastModified, layoutEngine]);

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

        // Scroll to ensure the selected photo is visible
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

  // Handle scroll position persistence
  const handleScroll = useCallback((scrollTop: number) => {
    scrollPositionRef.current = scrollTop;
  }, []);

  // Restore scroll position when returning to calendar view
  useEffect(() => {
    if (containerRef.current && scrollPositionRef.current > 0) {
      containerRef.current.scrollTop = scrollPositionRef.current;
    }
  }, [monthGroups]);

  // Show empty state if no files
  if (fileStore.fileList.length === 0) {
    return (
      <div className="calendar-gallery">
        <div className="calendar-gallery__empty-state">
          <p>No photos to display in calendar view</p>
        </div>
      </div>
    );
  }

  // Show loading state while grouping files
  if (monthGroups.length === 0 && fileStore.fileList.length > 0) {
    return (
      <div className="calendar-gallery">
        <div className="calendar-gallery__loading-state">
          <p>Loading calendar view...</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="calendar-gallery">
      <CalendarVirtualizedRenderer
        monthGroups={monthGroups}
        containerWidth={contentRect.width}
        containerHeight={contentRect.height}
        thumbnailSize={thumbnailSize}
        onPhotoSelect={select}
        onScrollChange={handleScroll}
        overscan={2}
        focusedPhotoId={focusedPhotoId}
      />
    </div>
  );
});

export default CalendarGallery;
