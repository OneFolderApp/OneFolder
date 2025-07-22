import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { PhotoItemProps } from './types';
import { Thumbnail } from '../GalleryItem';
import { CommandDispatcher } from '../Commands';

export const PhotoItem = observer(({ photo, isFocused, isSelected, onClick }: PhotoItemProps) => {
  const [isInView, setIsInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const eventManager = useMemo(() => new CommandDispatcher(photo), [photo]);

  // Intersection observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: '100px' }, // Load slightly before visible for smooth scrolling
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // Use both CommandDispatcher for full integration AND the passed onClick for keyboard navigation
      eventManager.select(e as any); // Type casting needed for CommandDispatcher compatibility
      onClick(photo, e);
    },
    [onClick, photo, eventManager],
  );

  return (
    <div
      ref={ref}
      className={`calendar-photo-item ${isSelected ? 'selected' : ''} ${
        isFocused ? 'focused' : ''
      }`}
      onClick={handleClick}
      onDoubleClick={eventManager.preview}
      onContextMenu={(e) => eventManager.showContextMenu(e as any)}
      onDragStart={(e) => eventManager.dragStart(e as any)}
      onDragEnter={(e) => eventManager.dragEnter(e as any)}
      onDragOver={(e) => eventManager.dragOver(e as any)}
      onDragLeave={(e) => eventManager.dragLeave(e as any)}
      onDrop={(e) => eventManager.drop(e as any)}
      onDragEnd={(e) => eventManager.dragEnd(e as any)}
      draggable
      style={{ aspectRatio: '1' }}
    >
      {isInView ? (
        <Thumbnail
          file={photo}
          mounted={true}
          forceNoThumbnail={false}
          hovered={false}
          galleryVideoPlaybackMode="disabled"
          isSlideMode={false}
        />
      ) : (
        <div
          className="photo-placeholder"
          style={{ aspectRatio: '1', background: 'var(--surface-secondary)' }}
        />
      )}
    </div>
  );
});
