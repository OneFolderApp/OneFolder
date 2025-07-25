import React, { useMemo, useState, useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { GroupedVirtuoso } from 'react-virtuoso';
import { GalleryProps } from './utils';
import { getThumbnailSize } from './utils';
import { useStore } from '../../contexts/StoreContext';
import { ClientFile } from '../../entities/File';
import { Thumbnail } from './GalleryItem';

// Helper function to create month/year key from date
const getMonthYearKey = (date: Date): string => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Helper function to format month/year for display
const formatMonthYear = (key: string): string => {
  const [year, month] = key.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
};

// Group files by creation date (month/year)
const groupFilesByMonth = (files: ClientFile[]) => {
  const groupMap = new Map<string, ClientFile[]>();

  for (const file of files) {
    const monthYearKey = getMonthYearKey(file.dateCreated);
    if (!groupMap.has(monthYearKey)) {
      groupMap.set(monthYearKey, []);
    }
    groupMap.get(monthYearKey)!.push(file);
  }

  // Sort groups by date (newest first)
  const sortedGroups = Array.from(groupMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

  return {
    groups: sortedGroups.map(([key, files]) => ({
      name: formatMonthYear(key),
      files: files,
    })),
    groupCounts: sortedGroups.map(([, files]) => files.length),
    allFiles: sortedGroups.flatMap(([, files]) => files),
  };
};

// Individual file row component with thumbnail
const FileRow = observer(
  ({
    file,
    thumbnailSize,
    onSelect,
  }: {
    file: ClientFile;
    thumbnailSize: number;
    onSelect: (file: ClientFile, additive: boolean, range: boolean) => void;
  }) => {
    const { uiStore } = useStore();
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
      // Mount the thumbnail after a small delay to improve performance
      const timeout = setTimeout(() => setIsMounted(true), 50);
      return () => clearTimeout(timeout);
    }, []);

    // Scale down the thumbnail size for calendar view (use about 1/4 of the grid size)
    const calendarThumbnailSize = Math.max(32, Math.min(thumbnailSize * 0.25, 80));
    const isSelected = uiStore.fileSelection.has(file);

    return (
      <div
        aria-selected={isSelected}
        className={`calendar-file-row ${isSelected ? 'selected' : ''}`}
        style={{
          padding: '4px 8px',
          borderBottom: '1px solid #eee',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          onSelect(file, e.ctrlKey || e.metaKey, e.shiftKey);
        }}
        onDoubleClick={() => {
          if (!file.isBroken) {
            uiStore.selectFile(file, true);
            uiStore.enableSlideMode();
          }
        }}
      >
        <div
          className="calendar-thumbnail-container"
          style={{
            width: `${calendarThumbnailSize}px`,
            height: `${calendarThumbnailSize}px`,
            flexShrink: 0,
            overflow: 'hidden',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Thumbnail mounted={isMounted} file={file} />
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', color: '#333', fontWeight: '500' }}>{file.filename}</div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>
            {file.dateCreated.toLocaleDateString()} • {file.width} × {file.height}
          </div>
        </div>
      </div>
    );
  },
);

const CalendarGallery = observer(({ contentRect, select, lastSelectionIndex }: GalleryProps) => {
  const { fileStore, uiStore } = useStore();

  // Remove useCommandHandler to prevent double event handling
  // useCommandHandler(select);

  const { groups, groupCounts, allFiles } = useMemo(() => {
    return groupFilesByMonth(fileStore.fileList);
  }, [fileStore.fileList, fileStore.fileListLastModified]);

  const thumbnailSize = getThumbnailSize(uiStore.thumbnailSize);

  // Add keyboard navigation support like other gallery components
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      let index = lastSelectionIndex.current;
      if (index === undefined) {
        return;
      }
      if (e.key === 'ArrowUp' && index > 0) {
        index -= 1;
      } else if (e.key === 'ArrowDown' && index < fileStore.fileList.length - 1) {
        index += 1;
      } else {
        return;
      }
      e.preventDefault();
      select(fileStore.fileList[index], e.ctrlKey || e.metaKey, e.shiftKey);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fileStore, select, lastSelectionIndex]);

  if (fileStore.fileList.length === 0) {
    return (
      <div
        className="calendar-gallery"
        style={{ height: contentRect.height, width: contentRect.width }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#666',
            fontSize: '16px',
          }}
        >
          No files to display
        </div>
      </div>
    );
  }

  return (
    <div
      className="calendar-gallery"
      style={{ height: contentRect.height, width: contentRect.width }}
    >
      <GroupedVirtuoso
        style={{ height: '100%', width: '100%' }}
        groupCounts={groupCounts}
        groupContent={(index) => (
          <div
            style={{
              padding: '16px 16px 8px',
              backgroundColor: '#f8f9fa',
              fontWeight: '600',
              fontSize: '18px',
              borderBottom: '1px solid #e0e0e0',
              position: 'relative',
              zIndex: -1,
            }}
          >
            {groups[index].name}{' '}
            <span style={{ fontWeight: '400', color: '#666' }}>({groupCounts[index]} files)</span>
          </div>
        )}
        itemContent={(index) => {
          const file = allFiles[index];
          return <FileRow file={file} thumbnailSize={thumbnailSize} onSelect={select} />;
        }}
      />
    </div>
  );
});

export default CalendarGallery;
