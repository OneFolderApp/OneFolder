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
 * Enhanced with accessibility features including ARIA labels, semantic HTML,
 * and proper keyboard navigation support.
 */
export const PhotoGrid: React.FC<PhotoGridProps> = observer(
  ({ photos, containerWidth, onPhotoSelect, focusedPhotoId }) => {
    const { uiStore } = useStore();

    // Helper function to determine screen size category
    const getScreenSize = useCallback((width: number): 'mobile' | 'tablet' | 'desktop' | 'wide' => {
      if (width < 768) {
        return 'mobile';
      }
      if (width < 1024) {
        return 'tablet';
      }
      if (width < 1440) {
        return 'desktop';
      }
      return 'wide';
    }, []);

    // Calculate responsive grid layout based on thumbnail size and container width
    const gridLayout = useMemo(() => {
      const thumbnailSize = getThumbnailSize(uiStore.thumbnailSize);
      const padding = 8; // Match existing gallery padding
      const gap = 8; // Gap between items

      // Responsive column calculation with constraints
      const getResponsiveColumns = (width: number, itemSize: number): number => {
        const availableWidth = width - padding * 2;
        const minColumns = 1;
        const maxColumns = getMaxColumnsForWidth(width);

        const calculatedColumns = Math.floor((availableWidth + gap) / (itemSize + gap));
        return Math.min(Math.max(minColumns, calculatedColumns), maxColumns);
      };

      // Get maximum columns based on screen width to prevent overcrowding
      const getMaxColumnsForWidth = (width: number): number => {
        if (width < 480) {
          return 2; // Mobile portrait: max 2 columns
        }
        if (width < 768) {
          return 3; // Mobile landscape: max 3 columns
        }
        if (width < 1024) {
          return 5; // Tablet: max 5 columns
        }
        if (width < 1440) {
          return 8; // Desktop: max 8 columns
        }
        return 12; // Wide desktop: max 12 columns
      };

      const columns = getResponsiveColumns(containerWidth, thumbnailSize);
      const availableWidth = containerWidth - padding * 2;
      const actualItemWidth = Math.floor((availableWidth - gap * (columns - 1)) / columns);

      // Ensure minimum item size for usability
      const minItemSize = 80;
      const finalItemWidth = Math.max(actualItemWidth, minItemSize);

      return {
        columns,
        itemWidth: finalItemWidth,
        itemHeight:
          uiStore.thumbnailShape === 'square' ? finalItemWidth : Math.floor(finalItemWidth * 0.75),
        gap,
        padding,
        isResponsive: containerWidth < 768, // Mark as responsive on smaller screens
        screenSize: getScreenSize(containerWidth),
      };
    }, [containerWidth, uiStore.thumbnailSize, uiStore.thumbnailShape, getScreenSize]);

    // Handle photo click events
    const handlePhotoClick = useCallback(
      (photo: ClientFile, event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        const additive = event.ctrlKey || event.metaKey;
        const range = event.shiftKey;
        onPhotoSelect(photo, additive, range);
      },
      [onPhotoSelect],
    );

    // Handle photo double-click events (preview)
    const handlePhotoDoubleClick = useCallback(
      (photo: ClientFile, event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        const eventManager = new CommandDispatcher(photo);
        eventManager.preview(event as any);
      },
      [],
    );

    // Handle context menu events
    const handleContextMenu = useCallback(
      (photo: ClientFile, event: React.MouseEvent<HTMLDivElement>) => {
        event.stopPropagation();
        event.preventDefault();
        const eventManager = new CommandDispatcher(photo);
        eventManager.showContextMenu(event as any);
      },
      [],
    );

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

    // Generate accessible label for the grid
    const gridAriaLabel = `Photo grid with ${photos.length} ${
      photos.length === 1 ? 'photo' : 'photos'
    } arranged in ${gridLayout.columns} columns`;

    return (
      <div
        className={`calendar-photo-grid calendar-photo-grid--${gridLayout.screenSize}${
          gridLayout.isResponsive ? ' calendar-photo-grid--responsive' : ''
        }`}
        style={gridStyle}
        data-columns={gridLayout.columns}
        data-screen-size={gridLayout.screenSize}
        role="grid"
        aria-label={gridAriaLabel}
        aria-rowcount={Math.ceil(photos.length / gridLayout.columns)}
        aria-colcount={gridLayout.columns}
      >
        {photos.map((photo, index) => {
          const eventManager = new CommandDispatcher(photo);
          const isSelected = uiStore.fileSelection.has(photo);
          const isFocused = focusedPhotoId === photo.id;

          // Calculate grid position for accessibility
          const row = Math.floor(index / gridLayout.columns) + 1;
          const col = (index % gridLayout.columns) + 1;

          const itemStyle: React.CSSProperties = {
            width: `${gridLayout.itemWidth}px`,
            height: `${gridLayout.itemHeight}px`,
            position: 'relative',
            cursor: 'pointer',
          };

          // Generate accessible label for the photo
          const getPhotoAriaLabel = () => {
            const baseLabel = `${photo.name || 'Untitled photo'}`;
            const positionLabel = `at position ${row}, ${col}`;
            const selectionLabel = isSelected ? ', selected' : '';
            const brokenLabel = photo.isBroken ? ', image unavailable' : '';
            const dateLabel = photo.dateCreated
              ? `, taken ${new Date(photo.dateCreated).toLocaleDateString()}`
              : '';

            return `${baseLabel}${dateLabel}${positionLabel}${selectionLabel}${brokenLabel}`;
          };

          return (
            <div
              key={photo.id}
              ref={(el) => setPhotoRef(photo.id, el)}
              className={`calendar-photo-item${isSelected ? ' calendar-photo-item--selected' : ''}${
                photo.isBroken ? ' calendar-photo-item--broken' : ''
              }${isFocused ? ' calendar-photo-item--focused' : ''}`}
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
              aria-label={getPhotoAriaLabel()}
              aria-describedby={photo.isBroken ? `photo-error-${photo.id}` : undefined}
              role="gridcell"
              aria-rowindex={row}
              aria-colindex={col}
              tabIndex={isFocused ? 0 : -1}
              onKeyDown={(e) => {
                // Handle Enter and Space for selection
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  const additive = e.ctrlKey || e.metaKey;
                  const range = e.shiftKey;
                  onPhotoSelect(photo, additive, range);
                }
              }}
            >
              <div className="calendar-photo-thumbnail">
                <Thumbnail
                  file={photo}
                  mounted={true}
                  forceNoThumbnail={false}
                  galleryVideoPlaybackMode={uiStore.galleryVideoPlaybackMode}
                  isSlideMode={uiStore.isSlideMode}
                />
                {photo.isBroken && (
                  <div
                    id={`photo-error-${photo.id}`}
                    className="calendar-photo-error-description"
                    aria-hidden="true"
                  >
                    Image file is missing or corrupted
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  },
);
