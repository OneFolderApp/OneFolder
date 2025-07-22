# Calendar View Core Utilities

This directory contains the core data structures and utilities for the calendar view feature.

## Overview

The calendar view organizes photos by date created, displaying them in a chronological layout with month/year headers and thumbnail grids. This implementation focuses on performance through efficient date grouping and virtualization support.

## Components

### Types (`types.ts`)
- **MonthGroup**: Represents a group of photos from the same month/year
- **LayoutItem**: Represents items in the virtualized layout (headers and grids)
- **VirtualItem**: Optimized representation for rendering
- **VisibleRange**: Defines the range of visible items in viewport
- **CalendarLayoutConfig**: Configuration for layout calculations

### Date Utilities (`dateUtils.ts`)
- **groupFilesByMonth()**: Groups files by month/year with proper sorting
- **formatMonthYear()**: Creates display names for month groups
- **extractMonthYear()**: Safely extracts month/year from dates
- **isReasonablePhotoDate()**: Validates photo dates (1900-current+10 years)
- **getSafeDateForGrouping()**: Handles fallback date selection

### Layout Engine (`layoutEngine.ts`)
- **CalendarLayoutEngine**: Main class for layout calculations
- Calculates item positions and dimensions for virtualization
- Provides binary search for efficient viewport calculations
- Supports responsive grid layouts

## Key Features

### Date Handling
- Graceful handling of invalid/missing dates
- Timezone-aware date processing
- Fallback date selection (dateCreated → dateModified → dateAdded)
- "Unknown Date" group for files with invalid dates

### Performance Optimizations
- Efficient binary search for visible item detection
- Pre-calculated layout positions for smooth scrolling
- Minimal re-calculations on configuration changes
- Memory-efficient data structures

### Sorting Behavior
- Month groups sorted newest first (descending)
- Photos within groups sorted oldest first (ascending)
- Unknown date files sorted alphabetically by filename

## Usage Example

```typescript
import { 
  groupFilesByMonth, 
  CalendarLayoutEngine,
  DEFAULT_LAYOUT_CONFIG 
} from './calendar';

// Group files by month
const monthGroups = groupFilesByMonth(files);

// Create layout engine
const engine = new CalendarLayoutEngine({
  containerWidth: 800,
  thumbnailSize: 160
});

// Calculate layout
const layoutItems = engine.calculateLayout(monthGroups);

// Find visible items
const visibleRange = engine.findVisibleItems(scrollTop, viewportHeight);
```

## Testing

Comprehensive unit tests cover:
- Date grouping edge cases (invalid dates, timezone handling)
- Layout calculations with various container sizes
- Binary search algorithms for viewport detection
- Performance with large datasets
- Error handling and fallback scenarios

Run tests with:
```bash
npm test -- --testPathPattern="calendar"
```

## Integration

These utilities integrate with the existing OneFolder architecture:
- Uses `ClientFile` entities from the file store
- Compatible with existing thumbnail size settings
- Follows established patterns for gallery components
- Supports existing selection and navigation systems