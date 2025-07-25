import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { GroupedVirtuoso } from 'react-virtuoso';
import { useStore } from '../../../contexts/StoreContext';
import { GalleryProps, getThumbnailSize } from '../utils';
import { MonthGroup } from './types';
import { groupPhotosChunked } from './grouping';
import { PhotoItem } from './PhotoItem';
import { ClientFile } from '../../../entities/File';

type CalendarViewProps = GalleryProps;

export const CalendarView = observer(
  ({ contentRect, select, lastSelectionIndex }: CalendarViewProps) => {
    const { fileStore, uiStore } = useStore();
    const [monthGroups, setMonthGroups] = useState<MonthGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [focusedPhotoId, setFocusedPhotoId] = useState<string | undefined>();

    // Read MobX observables in reactive context and convert to plain values
    const thumbnailSize = getThumbnailSize(uiStore.thumbnailSize);
    const selectedPhotoIds = useMemo(() => {
      // Convert MobX ObservableSet to plain Set to avoid reactive context issues
      return new Set(Array.from(uiStore.fileSelection).map((file) => file.id));
    }, [uiStore.fileSelection]);

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

    // Calculate grid layout for responsive columns (using memoized thumbnailSize)
    const photosPerRow = useMemo(() => {
      return Math.floor((contentRect.width - 32) / (thumbnailSize + 4));
    }, [contentRect.width, thumbnailSize]);

    // Transform data for GroupedVirtuoso - array of row counts per month
    const groupCounts = useMemo(() => {
      return monthGroups.map((group) => Math.ceil(group.photos.length / photosPerRow));
    }, [monthGroups, photosPerRow]);

    // Render month headers (group headers)
    const groupContent = useCallback(
      (groupIndex: number) => {
        const group = monthGroups[groupIndex];
        if (!group) {
          return null;
        }

        return (
          <h2 className="calendar-month-header">
            {group.displayName} ({group.photos.length})
          </h2>
        );
      },
      [monthGroups],
    );

    // Render rows of photos
    const itemContent = useCallback(
      (rowIndex: number, groupIndex: number) => {
        const group = monthGroups[groupIndex];
        if (!group) {
          return null;
        }

        const startIndex = rowIndex * photosPerRow;
        const endIndex = Math.min(startIndex + photosPerRow, group.photos.length);
        const rowPhotos = group.photos.slice(startIndex, endIndex);

        const handlePhotoClick = (photo: ClientFile, event: React.MouseEvent) => {
          const additive = event.ctrlKey || event.metaKey;
          const range = event.shiftKey;
          select(photo, additive, range);
        };

        return (
          <div
            className="calendar-photo-row"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${rowPhotos.length}, 1fr)`, // Use actual photo count, not max
              gap: '4px',
              padding: '0 16px',
              marginBottom: '4px',
              minHeight: `${thumbnailSize}px`, // Ensure minimum height
              width: '100%',
            }}
          >
            {rowPhotos.map((photo) => (
              <div
                key={photo.id}
                style={{
                  width: `${thumbnailSize}px`,
                  height: `${thumbnailSize}px`,
                }}
              >
                <PhotoItem
                  photo={photo}
                  isFocused={focusedPhotoId === photo.id}
                  isSelected={selectedPhotoIds.has(photo.id)}
                  onClick={handlePhotoClick}
                />
              </div>
            ))}
          </div>
        );
      },
      [monthGroups, photosPerRow, thumbnailSize, focusedPhotoId, selectedPhotoIds, select],
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
      [focusedPhotoId, getAllPhotos, select, photosPerRow],
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
        <GroupedVirtuoso
          style={{ height: contentRect.height }}
          groupCounts={groupCounts}
          groupContent={groupContent}
          itemContent={itemContent}
          overscan={200}
          increaseViewportBy={{ top: 600, bottom: 600 }}
        />
      </div>
    );
  },
);
