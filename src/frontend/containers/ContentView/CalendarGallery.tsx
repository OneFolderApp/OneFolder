import React from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { GalleryProps } from './utils';

// Hardcoded example data for testing
const generateMockData = () => {
  const groups = [
    { name: 'January 2024', items: Array.from({ length: 15 }, (_, i) => `Jan Item ${i + 1}`) },
    { name: 'December 2023', items: Array.from({ length: 23 }, (_, i) => `Dec Item ${i + 1}`) },
    { name: 'November 2023', items: Array.from({ length: 18 }, (_, i) => `Nov Item ${i + 1}`) },
    { name: 'October 2023', items: Array.from({ length: 12 }, (_, i) => `Oct Item ${i + 1}`) },
    { name: 'September 2023', items: Array.from({ length: 30 }, (_, i) => `Sep Item ${i + 1}`) },
  ];

  const groupCounts = groups.map((group) => group.items.length);
  const items = groups.flatMap((group) => group.items);

  return { groups, groupCounts, items };
};

const CalendarGallery = ({ contentRect, select, lastSelectionIndex }: GalleryProps) => {
  const { groups, groupCounts, items } = generateMockData();

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
            }}
          >
            {groups[index].name}
          </div>
        )}
        itemContent={(index) => (
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #eee',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f9f9f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            📷 {items[index]}
          </div>
        )}
      />
    </div>
  );
};

export default CalendarGallery;
