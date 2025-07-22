import React, { useMemo, useCallback, memo } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../../../contexts/StoreContext';
import { getThumbnailSize } from '../utils';
import { MonthSectionProps } from './types';
import { PhotoItem } from './PhotoItem';
import { ClientFile } from '../../../entities/File';

const MonthSectionComponent = ({
  group,
  containerWidth,
  onPhotoSelect,
  focusedPhotoId,
}: MonthSectionProps) => {
  const { uiStore } = useStore();
  const thumbnailSize = getThumbnailSize(uiStore.thumbnailSize);

  // Calculate responsive grid - photos per row based on container width and thumbnail size
  const photosPerRow = useMemo(
    () => Math.floor((containerWidth - 32) / (thumbnailSize + 8)), // 32px total padding, 8px gap
    [containerWidth, thumbnailSize],
  );

  const handlePhotoClick = useCallback(
    (photo: ClientFile, event: React.MouseEvent) => {
      const additive = event.ctrlKey || event.metaKey;
      const range = event.shiftKey;
      onPhotoSelect(photo, additive, range);
    },
    [onPhotoSelect],
  );

  return (
    <div className="calendar-month-section">
      <h2 className="calendar-month-header">
        {group.displayName} ({group.photos.length})
      </h2>
      <div
        className="calendar-photo-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${photosPerRow}, 1fr)`,
          gap: '4px',
          padding: '0 16px',
        }}
      >
        {group.photos.map((photo) => (
          <PhotoItem
            key={photo.id}
            photo={photo}
            isFocused={focusedPhotoId === photo.id}
            isSelected={uiStore.fileSelection.has(photo)}
            onClick={handlePhotoClick}
          />
        ))}
      </div>
    </div>
  );
};

export const MonthSection = memo(observer(MonthSectionComponent));
