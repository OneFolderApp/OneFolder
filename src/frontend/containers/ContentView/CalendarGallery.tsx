import React, { useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { GroupedVirtuoso } from 'react-virtuoso';
import { GalleryProps } from './utils';
import { useStore } from '../../contexts/StoreContext';
import { ClientFile } from '../../entities/File';

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

const CalendarGallery = observer(({ contentRect, select }: GalleryProps) => {
  const { fileStore } = useStore();

  const { groups, groupCounts, allFiles } = useMemo(() => {
    return groupFilesByMonth(fileStore.fileList);
  }, [fileStore.fileList, fileStore.fileListLastModified]);

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
              padding: '20px 16px 10px',
              backgroundColor: '#f5f5f5',
              fontWeight: 'bold',
              fontSize: '18px',
              borderBottom: '1px solid #ddd',
              position: 'sticky',
              top: 0,
              zIndex: 1,
            }}
          >
            {groups[index].name} ({groupCounts[index]} files)
          </div>
        )}
        itemContent={(index) => {
          const file = allFiles[index];
          return (
            <div
              style={{
                padding: '8px 16px',
                borderBottom: '1px solid #eee',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9f9f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              onClick={() => select(file, false, false)}
            >
              <span style={{ fontSize: '16px' }}>📷</span>
              <span style={{ fontSize: '14px', color: '#333' }}>{file.filename}</span>
              <span style={{ fontSize: '12px', color: '#666', marginLeft: 'auto' }}>
                {file.dateCreated.toLocaleDateString()}
              </span>
            </div>
          );
        }}
      />
    </div>
  );
});

export default CalendarGallery;
