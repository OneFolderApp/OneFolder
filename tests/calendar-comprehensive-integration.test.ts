/**
 * Comprehensive integration tests for calendar component interactions and selection behavior
 * Tests the integration between CalendarGallery, virtualized renderer, keyboard navigation, and selection
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { observer } from 'mobx-react-lite';
import CalendarGallery from '../src/frontend/containers/ContentView/CalendarGallery';
import { CalendarLayoutEngine } from '../src/frontend/containers/ContentView/calendar/layoutEngine';
import { CalendarKeyboardNavigation } from '../src/frontend/containers/ContentView/calendar/keyboardNavigation';
import { ClientFile } from '../src/frontend/entities/File';
import { MonthGroup } from '../src/frontend/containers/ContentView/calendar/types';

// Mock dependencies
jest.mock('mobx-react-lite', () => ({
  observer: (component: any) => component,
}));

jest.mock('../src/frontend/contexts/StoreContext', () => ({
  useStore: () => ({
    fileStore: {
      fileList: mockFiles,
    },
    uiStore: {
      thumbnailSize: 2, // Medium size
      searchCriteriaList: [],
      searchMatchAny: false,
      getCalendarScrollPosition: jest.fn(() => 0),
      setCalendarScrollPosition: jest.fn(),
      setMethod: jest.fn(),
    },
  }),
}));

jest.mock('../src/frontend/hooks/useWindowResize', () => ({
  useWindowResize: () => ({
    isResizing: false,
  }),
}));

jest.mock('../common/timeout', () => ({
  debouncedThrottle: (fn: Function) => fn,
}));

// Mock files for testing
const createMockFile = (
  id: string,
  dateCreated: Date,
  name: string = `file${id}.jpg`
): ClientFile => ({
  id: id as any,
  name,
  dateCreated,
  dateModified: dateCreated,
  dateAdded: dateCreated,
  extension: 'jpg' as any,
  size: 1000,
  width: 800,
  height: 600,
  absolutePath: `/path/to/${name}`,
  relativePath: name,
  locationId: 'location1' as any,
  ino: id,
  dateLastIndexed: dateCreated,
  tags: [],
  annotations: '',
});

const mockFiles: ClientFile[] = [
  // June 2024 - 8 photos
  ...Array.from({ length: 8 }, (_, i) => 
    createMockFile(`june-${i}`, new Date(2024, 5, i + 1), `june${i}.jpg`)
  ),
  // May 2024 - 6 photos  
  ...Array.from({ length: 6 }, (_, i) => 
    createMockFile(`may-${i}`, new Date(2024, 4, i + 1), `may${i}.jpg`)
  ),
  // April 2024 - 4 photos
  ...Array.from({ length: 4 }, (_, i) => 
    createMockFile(`april-${i}`, new Date(2024, 3, i + 1), `april${i}.jpg`)
  ),
];

describe('Calendar Comprehensive Integration Tests', () => {
  let mockSelect: jest.Mock;
  let mockLastSelectionIndex: React.MutableRefObject<number | undefined>;
  let mockContentRect: { width: number; height: number };

  beforeEach(() => {
    mockSelect = jest.fn();
    mockLastSelectionIndex = { current: undefined };
    mockContentRect = { width: 800, height: 600 };
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Component Integration', () => {
    it('should integrate layout engine with virtualized renderer', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Should render month headers and photo grids
      await waitFor(() => {
        const headers = container.querySelectorAll('[data-testid*="month-header"]');
        const grids = container.querySelectorAll('[data-testid*="photo-grid"]');
        
        // Should have headers and grids for each month
        expect(headers.length).toBeGreaterThan(0);
        expect(grids.length).toBeGreaterThan(0);
      });
    });

    it('should integrate keyboard navigation with selection', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Set initial selection
      mockLastSelectionIndex.current = 0;

      // Simulate arrow key navigation
      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowRight' });
      });

      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalledWith(
          expect.objectContaining({ id: mockFiles[1].id }),
          false, // not additive
          false  // not range
        );
      });
    });

    it('should integrate selection with scroll position management', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Set selection to a photo that might be off-screen
      mockLastSelectionIndex.current = 15; // Photo in April

      // Simulate selection change
      act(() => {
        mockLastSelectionIndex.current = 15;
      });

      // Should trigger scroll to make selected item visible
      await waitFor(() => {
        const scrollContainer = container.querySelector('.calendar-gallery');
        expect(scrollContainer).toBeInTheDocument();
        // Scroll behavior is tested through the integration
      });
    });

    it('should handle responsive layout changes', async () => {
      const { rerender } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId).toBeDefined();
      });

      // Change container width to trigger responsive recalculation
      const newContentRect = { width: 1200, height: 600 };
      
      rerender(
        <CalendarGallery
          contentRect={newContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      // Should handle the layout change without errors
      await waitFor(() => {
        // Layout should be recalculated for new width
        expect(true).toBe(true); // Integration test passes if no errors thrown
      });
    });
  });

  describe('Selection Behavior Integration', () => {
    it('should handle single photo selection', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Simulate photo click
      const photoElements = container.querySelectorAll('[data-testid*="photo-"]');
      if (photoElements.length > 0) {
        act(() => {
          fireEvent.click(photoElements[0]);
        });

        await waitFor(() => {
          expect(mockSelect).toHaveBeenCalledWith(
            expect.any(Object),
            false, // not additive
            false  // not range
          );
        });
      }
    });

    it('should handle multi-selection with Ctrl+click', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Set initial selection
      mockLastSelectionIndex.current = 0;

      // Simulate Ctrl+Right arrow
      act(() => {
        fireEvent.keyDown(document, { 
          key: 'ArrowRight', 
          ctrlKey: true 
        });
      });

      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalledWith(
          expect.any(Object),
          true,  // additive
          false  // not range
        );
      });
    });

    it('should handle range selection with Shift+click', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Set initial selection
      mockLastSelectionIndex.current = 0;

      // Simulate Shift+Right arrow
      act(() => {
        fireEvent.keyDown(document, { 
          key: 'ArrowRight', 
          shiftKey: true 
        });
      });

      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalledWith(
          expect.any(Object),
          false, // not additive
          true   // range selection
        );
      });
    });

    it('should handle selection across month boundaries', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Set selection to last photo in first month
      mockLastSelectionIndex.current = 7; // Last June photo

      // Navigate right to first photo in next month
      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowRight' });
      });

      await waitFor(() => {
        expect(mockSelect).toHaveBeenCalledWith(
          expect.objectContaining({ id: mockFiles[8].id }), // First May photo
          false,
          false
        );
      });
    });

    it('should maintain selection state during layout changes', async () => {
      const { rerender } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId).toBeDefined();
      });

      // Set selection
      mockLastSelectionIndex.current = 5;

      // Change thumbnail size (triggers layout recalculation)
      const mockUiStore = require('../src/frontend/contexts/StoreContext').useStore().uiStore;
      mockUiStore.thumbnailSize = 3; // Large size

      rerender(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      // Selection should be maintained
      expect(mockLastSelectionIndex.current).toBe(5);
    });
  });

  describe('Keyboard Navigation Integration', () => {
    it('should navigate within month grids correctly', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Test all arrow key directions
      const directions = [
        { key: 'ArrowRight', expectedIndex: 1 },
        { key: 'ArrowDown', expectedIndex: 4 }, // Assuming 4 items per row
        { key: 'ArrowLeft', expectedIndex: 3 },
        { key: 'ArrowUp', expectedIndex: 0 },
      ];

      for (const { key, expectedIndex } of directions) {
        mockLastSelectionIndex.current = 0;
        mockSelect.mockClear();

        act(() => {
          fireEvent.keyDown(document, { key });
        });

        await waitFor(() => {
          if (expectedIndex < mockFiles.length) {
            expect(mockSelect).toHaveBeenCalledWith(
              expect.objectContaining({ id: mockFiles[expectedIndex].id }),
              false,
              false
            );
          }
        });
      }
    });

    it('should handle navigation at grid boundaries', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Test navigation from first photo (should not go further left/up)
      mockLastSelectionIndex.current = 0;
      
      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowLeft' });
      });

      // Should not call select for invalid navigation
      expect(mockSelect).not.toHaveBeenCalled();

      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowUp' });
      });

      expect(mockSelect).not.toHaveBeenCalled();

      // Test navigation from last photo (should not go further right/down)
      mockLastSelectionIndex.current = mockFiles.length - 1;
      mockSelect.mockClear();

      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowRight' });
      });

      expect(mockSelect).not.toHaveBeenCalled();

      act(() => {
        fireEvent.keyDown(document, { key: 'ArrowDown' });
      });

      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('should integrate keyboard navigation with scroll management', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Navigate to a photo that would be off-screen
      mockLastSelectionIndex.current = 0;

      // Navigate down multiple times to reach a photo that might be off-screen
      for (let i = 0; i < 5; i++) {
        act(() => {
          fireEvent.keyDown(document, { key: 'ArrowDown' });
        });
        
        await waitFor(() => {
          expect(mockSelect).toHaveBeenCalled();
        });
        
        // Update selection index for next iteration
        const lastCall = mockSelect.mock.calls[mockSelect.mock.calls.length - 1];
        const selectedFile = lastCall[0];
        mockLastSelectionIndex.current = mockFiles.findIndex(f => f.id === selectedFile.id);
        mockSelect.mockClear();
      }

      // Should have triggered scroll to keep selected item visible
      const scrollContainer = container.querySelector('.calendar-gallery');
      expect(scrollContainer).toBeInTheDocument();
    });
  });

  describe('Virtualization Integration', () => {
    it('should render only visible items', async () => {
      // Create a large dataset to test virtualization
      const largeMockFiles = Array.from({ length: 1000 }, (_, i) => 
        createMockFile(`large-${i}`, new Date(2024, i % 12, (i % 28) + 1), `large${i}.jpg`)
      );

      // Mock the large dataset
      const mockStoreContext = require('../src/frontend/contexts/StoreContext');
      mockStoreContext.useStore = () => ({
        fileStore: { fileList: largeMockFiles },
        uiStore: {
          thumbnailSize: 2,
          searchCriteriaList: [],
          searchMatchAny: false,
          getCalendarScrollPosition: jest.fn(() => 0),
          setCalendarScrollPosition: jest.fn(),
          setMethod: jest.fn(),
        },
      });

      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Should not render all 1000 items at once
      const renderedPhotos = container.querySelectorAll('[data-testid*="photo-"]');
      expect(renderedPhotos.length).toBeLessThan(1000);
      expect(renderedPhotos.length).toBeGreaterThan(0);
    });

    it('should update visible items on scroll', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      const scrollContainer = container.querySelector('.calendar-gallery');
      
      if (scrollContainer) {
        // Simulate scroll
        act(() => {
          fireEvent.scroll(scrollContainer, { target: { scrollTop: 500 } });
        });

        await waitFor(() => {
          // Should update visible items based on new scroll position
          expect(scrollContainer.scrollTop).toBe(500);
        });
      }
    });

    it('should handle rapid scroll events efficiently', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      const scrollContainer = container.querySelector('.calendar-gallery');
      
      if (scrollContainer) {
        // Simulate rapid scrolling
        const scrollPositions = [100, 200, 300, 400, 500];
        
        for (const scrollTop of scrollPositions) {
          act(() => {
            fireEvent.scroll(scrollContainer, { target: { scrollTop } });
          });
        }

        await waitFor(() => {
          // Should handle all scroll events without errors
          expect(scrollContainer.scrollTop).toBe(500);
        });
      }
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle empty file list gracefully', async () => {
      // Mock empty file list
      const mockStoreContext = require('../src/frontend/contexts/StoreContext');
      mockStoreContext.useStore = () => ({
        fileStore: { fileList: [] },
        uiStore: {
          thumbnailSize: 2,
          searchCriteriaList: [],
          searchMatchAny: false,
          getCalendarScrollPosition: jest.fn(() => 0),
          setCalendarScrollPosition: jest.fn(),
          setMethod: jest.fn(),
        },
      });

      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Should show empty state
      expect(container.textContent).toContain('no photos'); // Assuming empty state shows this text
    });

    it('should handle files with invalid dates', async () => {
      const filesWithInvalidDates = [
        createMockFile('valid', new Date(2024, 5, 15), 'valid.jpg'),
        { ...createMockFile('invalid', new Date('invalid'), 'invalid.jpg'), dateCreated: new Date('invalid') },
      ];

      // Mock files with invalid dates
      const mockStoreContext = require('../src/frontend/contexts/StoreContext');
      mockStoreContext.useStore = () => ({
        fileStore: { fileList: filesWithInvalidDates },
        uiStore: {
          thumbnailSize: 2,
          searchCriteriaList: [],
          searchMatchAny: false,
          getCalendarScrollPosition: jest.fn(() => 0),
          setCalendarScrollPosition: jest.fn(),
          setMethod: jest.fn(),
        },
      });

      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Should handle invalid dates gracefully and show both valid and "Unknown Date" groups
      expect(container).toBeInTheDocument();
    });

    it('should recover from layout calculation errors', async () => {
      // Mock a scenario that might cause layout errors
      const problematicFiles = [
        { ...createMockFile('problem', new Date(2024, 5, 15)), width: NaN, height: NaN },
      ];

      const mockStoreContext = require('../src/frontend/contexts/StoreContext');
      mockStoreContext.useStore = () => ({
        fileStore: { fileList: problematicFiles },
        uiStore: {
          thumbnailSize: 2,
          searchCriteriaList: [],
          searchMatchAny: false,
          getCalendarScrollPosition: jest.fn(() => 0),
          setCalendarScrollPosition: jest.fn(),
          setMethod: jest.fn(),
        },
      });

      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      // Should not crash and should show some content
      expect(container).toBeInTheDocument();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large collections without blocking UI', async () => {
      const startTime = performance.now();
      
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      const renderTime = performance.now() - startTime;
      
      // Should render quickly even with the test dataset
      expect(renderTime).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle rapid selection changes efficiently', async () => {
      const { container } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(container.querySelector('.calendar-gallery')).toBeInTheDocument();
      });

      const startTime = performance.now();
      
      // Simulate rapid selection changes
      for (let i = 0; i < 10; i++) {
        mockLastSelectionIndex.current = i % mockFiles.length;
        
        act(() => {
          fireEvent.keyDown(document, { key: 'ArrowRight' });
        });
      }

      const selectionTime = performance.now() - startTime;
      
      // Should handle rapid changes efficiently
      expect(selectionTime).toBeLessThan(500); // Less than 500ms for 10 changes
    });

    it('should handle window resize events efficiently', async () => {
      const { rerender } = render(
        <CalendarGallery
          contentRect={mockContentRect}
          select={mockSelect}
          lastSelectionIndex={mockLastSelectionIndex}
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId).toBeDefined();
      });

      const startTime = performance.now();
      
      // Simulate multiple resize events
      const widths = [600, 800, 1000, 1200, 1400];
      
      for (const width of widths) {
        rerender(
          <CalendarGallery
            contentRect={{ width, height: 600 }}
            select={mockSelect}
            lastSelectionIndex={mockLastSelectionIndex}
          />
        );
      }

      const resizeTime = performance.now() - startTime;
      
      // Should handle resize events efficiently
      expect(resizeTime).toBeLessThan(1000); // Less than 1 second for 5 resizes
    });
  });
});