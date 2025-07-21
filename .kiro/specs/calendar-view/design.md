# Calendar View Design Document

## Overview

The calendar view will provide a chronological browsing experience for photos, organizing them by date created with month/year headers. The implementation will focus on performance through virtualization while maintaining the existing app's selection, navigation, and interaction patterns.

Based on analysis of the existing codebase, the calendar view will integrate with the current architecture through the `LayoutSwitcher` component and follow the established `GalleryProps` interface pattern used by other views.

## Architecture

### High-Level Component Structure

```
CalendarGallery (main component)
├── CalendarVirtualizedRenderer (handles virtualization)
├── MonthHeader (renders month/year headers)
├── PhotoGrid (renders photo thumbnails for each month)
└── CalendarLayoutEngine (calculates positions and groupings)
```

### Data Flow

1. **File Processing**: Transform flat file list into date-grouped structure
2. **Layout Calculation**: Calculate virtual positions for month headers and photo grids
3. **Viewport Determination**: Calculate which items are visible based on scroll position
4. **Rendering**: Render only visible month headers and photos

### Integration Points

- **LayoutSwitcher**: Integrates through existing `ViewMethod.Calendar` case
- **GalleryProps**: Follows established interface for selection and navigation
- **UiStore**: Uses existing thumbnail size and selection state management
- **FileStore**: Consumes existing `fileList` and `dateCreated` properties

## Components and Interfaces

### CalendarGallery Component

**Purpose**: Main calendar view component that orchestrates the calendar layout

**Props**: Implements `GalleryProps` interface
- `contentRect: ContentRect` - Available viewport dimensions
- `select: (file: ClientFile, selectAdditive: boolean, selectRange: boolean) => void`
- `lastSelectionIndex: React.MutableRefObject<number | undefined>`

**Key Responsibilities**:
- Group files by month/year using `dateCreated` property
- Calculate layout dimensions for virtualization
- Handle keyboard navigation (arrow keys)
- Manage scroll position persistence

### CalendarVirtualizedRenderer Component

**Purpose**: Handles virtualization logic for smooth scrolling performance

**Props**:
- `monthGroups: MonthGroup[]` - Grouped photo data
- `containerHeight: number` - Total scrollable height
- `containerWidth: number` - Available width
- `overscan: number` - Extra items to render outside viewport

**Key Responsibilities**:
- Determine visible items based on scroll position
- Render only visible month headers and photo grids
- Handle scroll events and viewport updates
- Manage scroll position for view transitions

### MonthHeader Component

**Purpose**: Renders month/year section headers

**Props**:
- `month: number` - Month (0-11)
- `year: number` - Full year
- `photoCount: number` - Number of photos in this month

**Styling**: Follows existing header patterns with clear visual hierarchy

### PhotoGrid Component

**Purpose**: Renders thumbnail grid for photos within a month

**Props**:
- `photos: ClientFile[]` - Photos for this month
- `thumbnailSize: number` - Current thumbnail size setting
- `onPhotoSelect: (photo: ClientFile, additive: boolean, range: boolean) => void`

**Key Responsibilities**:
- Render photo thumbnails in responsive grid
- Handle photo selection events
- Support existing thumbnail size settings

### CalendarLayoutEngine

**Purpose**: Calculates layout positions and dimensions for virtualization

**Key Methods**:
- `groupFilesByMonth(files: ClientFile[]): MonthGroup[]`
- `calculateItemPositions(monthGroups: MonthGroup[], containerWidth: number): LayoutItem[]`
- `findVisibleItems(scrollTop: number, viewportHeight: number): VisibleRange`

**Data Structures**:
```typescript
interface MonthGroup {
  year: number;
  month: number;
  photos: ClientFile[];
  displayName: string; // e.g., "January 2024"
}

interface LayoutItem {
  type: 'header' | 'grid';
  monthGroup: MonthGroup;
  top: number;
  height: number;
  photos?: ClientFile[]; // Only for grid items
}
```

## Data Models

### Date Grouping Strategy

Files will be grouped using the existing `dateCreated` property from `FileDTO`. The grouping logic will:

1. **Primary Grouping**: Group by year and month
2. **Sorting**: Sort groups in descending order (newest first)
3. **Within Group**: Sort photos by `dateCreated` ascending (oldest first within month)
4. **Fallback Handling**: Files with invalid dates grouped into "Unknown Date" category

### Virtualization Data Model

The virtualization system will use a flat array of `LayoutItem` objects representing both headers and photo grids:

```typescript
interface VirtualItem {
  id: string;
  type: 'header' | 'photos';
  top: number;
  height: number;
  monthGroup: MonthGroup;
  visible: boolean;
}
```

## Error Handling

### Missing Date Metadata
- Files with missing or invalid `dateCreated` will be grouped under "Unknown Date"
- Unknown date group will appear at the end of the calendar
- Users will see a clear indication that date information is missing

### Performance Degradation
- Implement progressive loading for very large collections (>10,000 photos)
- Add loading indicators during initial grouping calculations
- Graceful fallback to non-virtualized rendering for small collections (<100 photos)

### Memory Management
- Limit rendered items to viewport + overscan buffer
- Dispose of off-screen thumbnail resources
- Implement efficient re-rendering when thumbnail size changes

## Testing Strategy

### Unit Tests
- Date grouping logic with various date formats and edge cases
- Layout calculation accuracy for different container sizes
- Virtualization viewport calculations

### Integration Tests
- Selection behavior consistency with other views
- Keyboard navigation functionality
- Scroll position persistence across view switches

### Performance Tests
- Smooth scrolling with 1,000+ photos
- Memory usage during extended scrolling
- Initial render time for large collections

### User Experience Tests
- Responsive layout on different screen sizes
- Thumbnail size changes
- Empty state and error state handling

## Implementation Approach

### Phase 1: Basic Structure
- Implement date grouping logic
- Create basic month header and photo grid components
- Integrate with existing LayoutSwitcher

### Phase 2: Virtualization
- Implement CalendarVirtualizedRenderer
- Add scroll position management
- Optimize for large collections

### Phase 3: Polish and Integration
- Add keyboard navigation
- Implement selection consistency
- Add loading states and error handling

### Virtualization Decision

**Recommendation**: Implement custom virtualization similar to the List view approach rather than the complex Rust/WASM solution used in Masonry.

**Rationale**:
1. **Calendar Layout Predictability**: Unlike masonry layouts, calendar layouts have predictable item heights (month headers + photo grids)
2. **Simpler Requirements**: Calendar view doesn't need the complex positioning calculations that justify Rust/WASM
3. **Maintenance**: Custom TypeScript virtualization is easier to maintain and debug
4. **Performance**: For calendar layouts, JavaScript virtualization provides sufficient performance

**Implementation Strategy**:
- Use react-window-like approach with custom logic
- Pre-calculate month group heights for efficient viewport calculations
- Implement binary search for visible item determination (similar to existing `findViewportEdge`)
- Use overscan buffer for smooth scrolling experience

The virtualization will be essential for collections with hundreds of photos across many months, ensuring smooth scrolling performance while maintaining memory efficiency.