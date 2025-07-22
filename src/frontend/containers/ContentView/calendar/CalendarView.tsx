import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { VariableSizeList as List } from 'react-window';
import { useStore } from '../../../contexts/StoreContext';
import { GalleryProps, getThumbnailSize } from '../utils';
import { MonthGroup } from './types';
import { groupPhotosChunked } from './grouping';
import { MonthSection } from './MonthSection';

type CalendarViewProps = GalleryProps;

export const CalendarView = observer(
  ({ contentRect, select, lastSelectionIndex }: CalendarViewProps) => {
    const { fileStore, uiStore } = useStore();
    const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [focusedPhotoId, setFocusedPhotoId] = useState<string | undefined>();
    const listRef = useRef<List>(null);

    // Update focus when lastSelectionIndex changes (for integration with selection system)
    useEffect(() => {
      if (lastSelectionIndex.current !== undefined && fileStore.fileList.length > 0) {
        const selectedFile = fileStore.fileList[lastSelectionIndex.current];
        if (selectedFile) {
          setFocusedPhotoId(selectedFile.id);
        }
      }
    }, [lastSelectionIndex.current, fileStore.fileList]);

    // Group photos on mount/file changes
    useEffect(() => {
      let isCancelled = false;

      const processFiles = async () => {
        setIsLoading(true);
        try {
          const groups = await groupPhotosChunked(fileStore.fileList);
          if (!isCancelled) {
            setMonthGroups(groups);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Error grouping photos:', error);
          if (!isCancelled) {
            setIsLoading(false);
          }
        }
      };

      processFiles();

      return () => {
        isCancelled = true;
      };
    }, [fileStore.fileList]);

    // Calculate height for each month section
    const getMonthHeight = useCallback(
      (index: number) => {
        const group = monthGroups[index];
        if (!group) {
          return 100;
        }

        const thumbnailSize = getThumbnailSize(uiStore.thumbnailSize);
        const photosPerRow = Math.floor((contentRect.width - 32) / (thumbnailSize + 8));
        const rows = Math.ceil(group.photos.length / photosPerRow);

        return 60 + rows * (thumbnailSize + 8) + 24; // header + grid + margin
      },
      [monthGroups, contentRect.width, uiStore.thumbnailSize],
    );

    // Month section renderer for react-window
    const MonthRenderer = ({ index, style }: any) => (
      <div style={style}>
        <MonthSection
          group={monthGroups[index]}
          containerWidth={contentRect.width}
          onPhotoSelect={select}
          focusedPhotoId={focusedPhotoId}
        />
      </div>
    );

    // Keyboard navigation - create flat array of all photos for navigation
    const getAllPhotos = useMemo(() => monthGroups.flatMap((group) => group.photos), [monthGroups]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (!focusedPhotoId || getAllPhotos.length === 0) {
          return;
        }

        const currentIndex = getAllPhotos.findIndex((p) => p.id === focusedPhotoId);
        if (currentIndex === -1) {
          return;
        }

        let newIndex = currentIndex;
        const thumbnailSize = getThumbnailSize(uiStore.thumbnailSize);
        const photosPerRow = Math.floor((contentRect.width - 32) / (thumbnailSize + 8));

        switch (e.key) {
          case 'ArrowLeft':
            newIndex = Math.max(0, currentIndex - 1);
            break;
          case 'ArrowRight':
            newIndex = Math.min(getAllPhotos.length - 1, currentIndex + 1);
            break;
          case 'ArrowUp':
            newIndex = Math.max(0, currentIndex - photosPerRow);
            break;
          case 'ArrowDown':
            newIndex = Math.min(getAllPhotos.length - 1, currentIndex + photosPerRow);
            break;
          default:
            return;
        }

        if (newIndex !== currentIndex) {
          e.preventDefault();
          const newPhoto = getAllPhotos[newIndex];
          setFocusedPhotoId(newPhoto.id);

          const additive = e.ctrlKey || e.metaKey;
          const range = e.shiftKey;
          select(newPhoto, additive, range);
        }
      },
      [focusedPhotoId, getAllPhotos, select, uiStore.thumbnailSize, contentRect.width],
    );

    // Set up keyboard event listener
    useEffect(() => {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Auto-focus first photo when switching to calendar view
    useEffect(() => {
      if (!focusedPhotoId && getAllPhotos.length > 0) {
        setFocusedPhotoId(getAllPhotos[0].id);
      }
    }, [focusedPhotoId, getAllPhotos]);

    if (isLoading) {
      return (
        <div className="calendar-loading">
          <div>Loading calendar...</div>
        </div>
      );
    }

    if (monthGroups.length === 0) {
      return (
        <div className="calendar-empty">
          <div>No photos found</div>
        </div>
      );
    }

    return (
      <div className="calendar-view">
        <List
          ref={listRef}
          height={contentRect.height}
          width={contentRect.width}
          itemCount={monthGroups.length}
          itemSize={getMonthHeight}
          overscanCount={2} // Render 2 extra items above/below viewport for smooth scrolling
        >
          {MonthRenderer}
        </List>
      </div>
    );
  },
);
