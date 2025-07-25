import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { createPortal } from 'react-dom';
import { GroupedVirtuoso, GroupedVirtuosoHandle } from 'react-virtuoso';
import { GalleryProps } from './utils';
import { getThumbnailSize } from './utils';
import { useStore } from '../../contexts/StoreContext';
import { ClientFile } from '../../entities/File';
import { Thumbnail } from './GalleryItem';
// Using HTML select elements for better compatibility

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

  // Extract years and months for dropdowns
  const yearMap = new Map<number, Set<number>>();
  sortedGroups.forEach(([key]) => {
    const [year, month] = key.split('-').map(Number);
    if (!yearMap.has(year)) {
      yearMap.set(year, new Set());
    }
    yearMap.get(year)!.add(month);
  });

  const availableYears = Array.from(yearMap.keys()).sort((a, b) => b - a);
  const availableMonths = (year: number) =>
    Array.from(yearMap.get(year) || []).sort((a, b) => b - a);

  // Calculate photo counts for years and months
  const getYearPhotoCount = (year: number) => {
    return sortedGroups
      .filter(([key]) => key.startsWith(`${year}-`))
      .reduce((total, [, files]) => total + files.length, 0);
  };

  const getMonthPhotoCount = (year: number, month: number) => {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const group = sortedGroups.find(([groupKey]) => groupKey === key);
    return group ? group[1].length : 0;
  };

  return {
    groups: sortedGroups.map(([key, files], index) => ({
      key,
      name: formatMonthYear(key),
      files: files,
      groupIndex: index, // For scrolling
    })),
    groupCounts: sortedGroups.map(([, files]) => files.length),
    allFiles: sortedGroups.flatMap(([, files]) => files),
    availableYears,
    availableMonths,
    getYearPhotoCount,
    getMonthPhotoCount,
    findGroupIndex: (year: number, month: number) => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      return sortedGroups.findIndex(([groupKey]) => groupKey === key);
    },
    findItemIndex: (year: number, month: number) => {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      const groupIndex = sortedGroups.findIndex(([groupKey]) => groupKey === key);
      if (groupIndex === -1) {
        return -1;
      }

      // Calculate the starting item index for this group
      // Sum all files in previous groups
      let itemIndex = 0;
      for (let i = 0; i < groupIndex; i++) {
        itemIndex += sortedGroups[i][1].length;
      }
      return itemIndex;
    },
  };
};

// Portal-based dropdown component to avoid z-index stacking issues
const PortalDropdown = ({
  isOpen,
  buttonRef,
  onClose,
  children,
}: {
  isOpen: boolean;
  buttonRef: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
  children: React.ReactNode;
}) => {
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen, buttonRef]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      // Check if click is outside both button AND dropdown
      const isOutsideButton = buttonRef.current && !buttonRef.current.contains(target);
      const isOutsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);

      if (isOutsideButton && isOutsideDropdown) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Use a small delay to allow click events to process first
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        minWidth: position.width,
        maxHeight: '300px',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '6px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        overflow: 'auto',
      }}
    >
      {children}
    </div>,
    document.body,
  );
};

// Navigation header component with year/month buttons that toggle dropdowns
const NavigationHeader = observer(
  ({
    groupIndex,
    groups,
    groupCounts,
    availableYears,
    availableMonths,
    getYearPhotoCount,
    getMonthPhotoCount,
    onYearChange,
    onMonthChange,
  }: {
    groupIndex: number;
    groups: Array<{ key: string; name: string; files: ClientFile[]; groupIndex: number }>;
    groupCounts: number[];
    availableYears: number[];
    availableMonths: (year: number) => number[];
    getYearPhotoCount: (year: number) => number;
    getMonthPhotoCount: (year: number, month: number) => number;
    onYearChange: (year: number) => void;
    onMonthChange: (month: number) => void;
  }) => {
    const { uiStore } = useStore();
    const group = groups[groupIndex];
    const [year, month] = group.key.split('-').map(Number);

    // All hooks must be called before any early returns
    const [showYearDropdown, setShowYearDropdown] = useState(false);
    const [showMonthDropdown, setShowMonthDropdown] = useState(false);

    const yearButtonRef = useRef<HTMLButtonElement>(null);
    const monthButtonRef = useRef<HTMLButtonElement>(null);

    // Safety checks to prevent empty arrays
    const yearOptions = availableYears.length > 0 ? availableYears : [year];
    const monthOptions = availableMonths(year);
    const safeMonthOptions = monthOptions.length > 0 ? monthOptions : [month];

    const monthName = new Date(2000, month - 1).toLocaleDateString('en-US', { month: 'long' });

    // Always read observables to satisfy MobX (prevent derivation warnings)
    const isSlideMode = uiStore.isSlideMode;
    const isPreviewOpen = uiStore.isPreviewOpen;
    const isPreviewActive = isSlideMode || isPreviewOpen;

    // Return minimal element when preview is active to avoid Virtuoso sizing issues
    if (isPreviewActive) {
      return (
        <div
          style={{
            height: '1px', // Minimal height to avoid zero-size warnings
            width: '100%',
            position: 'sticky',
            top: 0,
            zIndex: -1,
            visibility: 'hidden',
          }}
        />
      );
    }

    return (
      <div
        style={{
          padding: '16px 16px 8px',
          backgroundColor: '#f8f9fa',
          fontWeight: '600',
          fontSize: '18px',
          borderBottom: '1px solid #e0e0e0',
          position: 'sticky',
          top: 0,
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        {/* Year Button with Portal Dropdown */}
        <div>
          <button
            ref={yearButtonRef}
            onClick={() => setShowYearDropdown(!showYearDropdown)}
            style={{
              padding: '6px 12px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              background: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {year}
            <span style={{ fontSize: '12px' }}>▼</span>
          </button>

          <PortalDropdown
            isOpen={showYearDropdown}
            buttonRef={yearButtonRef}
            onClose={() => setShowYearDropdown(false)}
          >
            <select
              value={year}
              onChange={(e) => {
                onYearChange(Number(e.target.value));
                setShowYearDropdown(false);
              }}
              style={{
                width: '100%',
                padding: '8px',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '16px',
                cursor: 'pointer',
              }}
              size={Math.min(yearOptions.length, 8)}
              autoFocus
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y} ({getYearPhotoCount(y)} files)
                </option>
              ))}
            </select>
          </PortalDropdown>
        </div>

        {/* Month Button with Portal Dropdown */}
        <div>
          <button
            ref={monthButtonRef}
            onClick={() => setShowMonthDropdown(!showMonthDropdown)}
            style={{
              padding: '6px 12px',
              border: '1px solid #ccc',
              borderRadius: '6px',
              background: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              outline: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {monthName}
            <span style={{ fontSize: '12px' }}>▼</span>
          </button>

          <PortalDropdown
            isOpen={showMonthDropdown}
            buttonRef={monthButtonRef}
            onClose={() => setShowMonthDropdown(false)}
          >
            <select
              value={month}
              onChange={(e) => {
                onMonthChange(Number(e.target.value));
                setShowMonthDropdown(false);
              }}
              style={{
                width: '100%',
                padding: '8px',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '16px',
                cursor: 'pointer',
              }}
              size={Math.min(safeMonthOptions.length, 8)}
              autoFocus
            >
              {safeMonthOptions.map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleDateString('en-US', { month: 'long' })} (
                  {getMonthPhotoCount(year, m)} files)
                </option>
              ))}
            </select>
          </PortalDropdown>
        </div>

        <span style={{ fontWeight: '400', color: '#666', marginLeft: '8px' }}>
          ({groupCounts[groupIndex]} files)
        </span>
      </div>
    );
  },
);

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
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null);

  // Navigation state no longer needed - each header shows its own month/year

  // Remove useCommandHandler to prevent double event handling
  // useCommandHandler(select);

  const {
    groups,
    groupCounts,
    allFiles,
    availableYears,
    availableMonths,
    getYearPhotoCount,
    getMonthPhotoCount,
    findItemIndex,
  } = useMemo(() => {
    return groupFilesByMonth(fileStore.fileList);
  }, [fileStore.fileList, fileStore.fileListLastModified]);

  // Navigation handlers - now just handle scrolling to selected year/month
  const handleYearChange = useCallback(
    (year: number) => {
      const firstMonthOfYear = availableMonths(year)[0];
      const itemIndex = findItemIndex(year, firstMonthOfYear);
      if (itemIndex >= 0 && virtuosoRef.current) {
        // Try scrolling to the item index with specific alignment
        virtuosoRef.current.scrollToIndex({
          index: itemIndex,
          align: 'start',
          behavior: 'smooth',
        });
      }
    },
    [availableMonths, findItemIndex],
  );

  const handleMonthChange = useCallback(
    (month: number) => {
      // Find which year this month belongs to by looking at available data
      const targetYear = availableYears.find((year) => availableMonths(year).includes(month));
      if (targetYear) {
        const itemIndex = findItemIndex(targetYear, month);
        if (itemIndex >= 0 && virtuosoRef.current) {
          // Try scrolling to the item index with specific alignment
          virtuosoRef.current.scrollToIndex({
            index: itemIndex,
            align: 'start',
            behavior: 'smooth',
          });
        }
      }
    },
    [availableYears, availableMonths, findItemIndex],
  );

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
        ref={virtuosoRef}
        style={{ height: '100%', width: '100%' }}
        groupCounts={groupCounts}
        groupContent={(index) => (
          <NavigationHeader
            groupIndex={index}
            groups={groups}
            groupCounts={groupCounts}
            availableYears={availableYears}
            availableMonths={availableMonths}
            getYearPhotoCount={getYearPhotoCount}
            getMonthPhotoCount={getMonthPhotoCount}
            onYearChange={handleYearChange}
            onMonthChange={handleMonthChange}
          />
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
