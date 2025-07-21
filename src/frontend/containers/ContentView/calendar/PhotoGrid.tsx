import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { ClientFile } from '../../../entities/File';
import { useStore } from '../../../contexts/StoreContext';
import { CommandDispatcher } from '../Commands';
import { Thumbnail } from '../GalleryItem';
import { getThumbnailSize } from '../utils';

export interface PhotoGridProps {
  /** Photos to display in the grid */
  photos: ClientFile[];
  /** Container width for responsive grid calculation */
  containerWidth: number;
  /** Callback for photo selection events */
  onPhotoSelect: (photo: ClientFile, additive: boolean, range: boolean) => void;
  /** ID of the currently focused photo (for keyboard navigation) */
  focusedPhotoId?: string;
}

/**
 * PhotoGrid component renders thumbnails in a responsive grid layout
 * for photos within a calendar month. Integrates with existing selection
 * system and supports thumbnail size settings and shape preferences.
 */
export const PhotoGrid: React.FC<PhotoGridProps> = observer(({ 
  photos, 
  containerWidth, 
  onPhotoSelect,
  focusedPhotoId
}) => {
  const { uiStore } = useStore();
  
  // Calculate grid layout based on thumbnail size and container width
  const gridLayout = useMemo(() => {
    const thumbnailSize = getThumbnailSize(uiStore.thumbnailSize);
    const padding = 8; // Match existing gallery padding
    const minColumns = 1;
    
    // Calculate how many columns can fit
    const availableWidth = containerWidth - (padding * 2); // Account for container padding
    const itemWidth = thumbnailSize;
    const gap = 8; // Gap between items
    
    const columns = Math.max(minColumns, Math.floor((availableWidth + gap) / (itemWidth + gap)));
    const actualItemWidth = Math.floor((availableWidth - (gap * (columns - 1))) / columns);
    
    return {
      columns,
      itemWidth: actualItemWidth,
      itemHeight: uiStore.thumbnailShape === 'square' ? actualItemWidth : Math.floor(actualItemWidth * 0.75),
      gap,
      padding
    };
  }, [containerWidth, uiStore.thumbnailSize, uiStore.thumbnailShape]);

  // Handle photo click events
  const handlePhotoClick = useCallback((photo: ClientFile, event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const additive = event.ctrlKey || event.metaKey;
    const range = event.shiftKey;
    onPhotoSelect(photo, additive, range);
  }, [onPhotoSelect]);

  // Handle photo double-click events (preview)
  const handlePhotoDoubleClick = useCallback((photo: ClientFile, event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const eventManager = new CommandDispatcher(photo);
    eventManager.preview(event as any);
  }, []);

  // Handle context menu events
  const handleContextMenu = useCallback((photo: ClientFile, event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    const eventManager = new CommandDispatcher(photo);
    eventManager.showContextMenu(event as any);
  }, []);

  if (photos.length === 0) {
    return null;
  }

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridLayout.columns}, 1fr)`,
    gap: `${gridLayout.gap}px`,
    padding: `${gridLayout.padding}px`,
    width: '100%',
  };

  // Refs for managing focus
  const photoRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Focus the appropriate photo when focusedPhotoId changes
  useEffect(() => {
    if (focusedPhotoId) {
      const photoElement = photoRefs.current.get(focusedPhotoId);
      if (photoElement) {
        photoElement.focus();
      }
    }
  }, [focusedPhotoId]);

  // Handle ref assignment
  const setPhotoRef = useCallback((photoId: string, element: HTMLDivElement | null) => {
    if (element) {
      photoRefs.current.set(photoId, element);
    } else {
      photoRefs.current.delete(photoId);
    }
  }, []);

  return (
    <div className="calendar-photo-grid" style={gridStyle}>
      {photos.map((photo) => {
        const eventManager = new CommandDispatcher(photo);
        const isSelected = uiStore.fileSelection.has(photo);
        const isFocused = focusedPhotoId === photo.id;
        
        const itemStyle: React.CSSProperties = {
          width: `${gridLayout.itemWidth}px`,
          height: `${gridLayout.itemHeight}px`,
          position: 'relative',
          cursor: 'pointer',
        };

        return (
          <div
            key={photo.id}
            ref={(el) => setPhotoRef(photo.id, el)}
            className={`calendar-photo-item${isSelected ? ' calendar-photo-item--selected' : ''}${photo.isBroken ? ' calendar-photo-item--broken' : ''}${isFocused ? ' calendar-photo-item--focused' : ''}`}
            style={itemStyle}
            onClick={(e) => handlePhotoClick(photo, e)}
            onDoubleClick={(e) => handlePhotoDoubleClick(photo, e)}
            onContextMenu={(e) => handleContextMenu(photo, e)}
            onDragStart={eventManager.dragStart}
            onDragEnter={eventManager.dragEnter}
            onDragOver={eventManager.dragOver}
            onDragLeave={eventManager.dragLeave}
            onDrop={eventManager.drop}
            onDragEnd={eventManager.dragEnd}
            aria-selected={isSelected}
            role="gridcell"
            tabIndex={isFocused ? 0 : -1}
          >
            <div className="calendar-photo-thumbnail">
              <Thumbnail
                file={photo}
                mounted={true}
                forceNoThumbnail={false}
                galleryVideoPlaybackMode={uiStore.galleryVideoPlaybackMode}
                isSlideMode={uiStore.isSlideMode}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});