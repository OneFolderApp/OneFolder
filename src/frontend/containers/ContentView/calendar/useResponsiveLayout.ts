import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce } from 'common/timeout';
import { CalendarLayoutEngine } from './layoutEngine';
import { MonthGroup } from './types';
import { useWindowResize, WindowDimensions } from '../../../hooks/useWindowResize';

export interface ResponsiveLayoutConfig {
  /** Container width */
  containerWidth: number;
  /** Container height */
  containerHeight: number;
  /** Current thumbnail size */
  thumbnailSize: number;
  /** Debounce delay for layout recalculation (ms) */
  debounceDelay?: number;
  /** Minimum container width to prevent layout issues */
  minContainerWidth?: number;
  /** Maximum items per row to prevent overcrowding */
  maxItemsPerRow?: number;
  /** Whether to enable window resize handling */
  enableWindowResize?: boolean;
  /** Threshold for significant width changes (px) */
  significantWidthChangeThreshold?: number;
  /** Threshold for significant height changes (px) */
  significantHeightChangeThreshold?: number;
}

export interface ResponsiveLayoutResult {
  /** Layout engine instance */
  layoutEngine: CalendarLayoutEngine;
  /** Whether layout is currently being recalculated */
  isRecalculating: boolean;
  /** Current items per row calculation */
  itemsPerRow: number;
  /** Whether the layout is in a responsive state (adapting to size changes) */
  isResponsive: boolean;
  /** Force a layout recalculation */
  forceRecalculate: () => void;
  /** Current window dimensions */
  windowDimensions: WindowDimensions;
  /** Whether window is currently being resized */
  isWindowResizing: boolean;
  /** Screen size information */
  screenInfo: {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isWideDesktop: boolean;
    aspectRatio: number;
  };
}

/**
 * Custom hook for handling responsive calendar layout with debounced recalculation
 */
export function useResponsiveLayout(
  config: ResponsiveLayoutConfig,
  monthGroups: MonthGroup[],
): ResponsiveLayoutResult {
  const {
    containerWidth,
    containerHeight,
    thumbnailSize,
    debounceDelay = 150,
    minContainerWidth = 200,
    maxItemsPerRow = 20,
    enableWindowResize = true,
    significantWidthChangeThreshold = 10,
    significantHeightChangeThreshold = 10,
  } = config;

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isResponsive, setIsResponsive] = useState(false);
  const previousConfigRef = useRef<ResponsiveLayoutConfig | null>(null);
  const recalculationTimeoutRef = useRef<number | null>(null);
  const previousWindowDimensionsRef = useRef<WindowDimensions | null>(null);

  // Create layout engine with responsive configuration
  const layoutEngine = useMemo(() => {
    const safeContainerWidth = Math.max(containerWidth, minContainerWidth);

    return new CalendarLayoutEngine({
      containerWidth: safeContainerWidth,
      thumbnailSize,
      thumbnailPadding: 8,
      headerHeight: 48,
      groupMargin: 24,
    });
  }, [containerWidth, thumbnailSize, minContainerWidth]);

  // Calculate current items per row
  const itemsPerRow = useMemo(() => {
    const safeContainerWidth = Math.max(containerWidth, minContainerWidth);
    const itemSize = thumbnailSize + 8; // thumbnail + padding
    const availableWidth = safeContainerWidth - 8; // container padding
    const calculated = Math.floor(availableWidth / itemSize);

    return Math.min(Math.max(1, calculated), maxItemsPerRow);
  }, [containerWidth, thumbnailSize, minContainerWidth, maxItemsPerRow]);

  // Debounced layout recalculation function
  const debouncedRecalculate = useCallback(
    debounce(async () => {
      setIsRecalculating(true);
      setIsResponsive(true);

      try {
        // Small delay to allow UI to update
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Update layout engine configuration
        const safeContainerWidth = Math.max(containerWidth, minContainerWidth);
        layoutEngine.updateConfig({
          containerWidth: safeContainerWidth,
          thumbnailSize,
        });

        // Recalculate layout if we have month groups
        if (monthGroups.length > 0) {
          layoutEngine.calculateLayout(monthGroups);
        }
      } catch (error) {
        console.error('Error during responsive layout recalculation:', error);
      } finally {
        setIsRecalculating(false);

        // Reset responsive state after a delay
        if (recalculationTimeoutRef.current) {
          clearTimeout(recalculationTimeoutRef.current);
        }
        recalculationTimeoutRef.current = window.setTimeout(() => {
          setIsResponsive(false);
        }, 500);
      }
    }, debounceDelay),
    [containerWidth, containerHeight, thumbnailSize, minContainerWidth, layoutEngine, monthGroups],
  );

  // Window resize handling
  const handleWindowResize = useCallback(
    (dimensions: WindowDimensions) => {
      const previousDimensions = previousWindowDimensionsRef.current;

      if (previousDimensions) {
        const widthChanged =
          Math.abs(dimensions.innerWidth - previousDimensions.innerWidth) >
          significantWidthChangeThreshold;
        const heightChanged =
          Math.abs(dimensions.innerHeight - previousDimensions.innerHeight) >
          significantHeightChangeThreshold;

        // Only trigger recalculation for significant changes
        if (widthChanged) {
          console.log('Window width changed significantly, triggering layout recalculation');
          debouncedRecalculate();
        } else if (heightChanged) {
          // Height changes don't require full layout recalculation, just viewport updates
          setIsResponsive(true);
          setTimeout(() => setIsResponsive(false), 200);
        }
      }

      previousWindowDimensionsRef.current = dimensions;
    },
    [debouncedRecalculate, significantWidthChangeThreshold, significantHeightChangeThreshold],
  );

  // Use window resize hook
  const { dimensions: windowDimensions, isResizing: isWindowResizing } = useWindowResize({
    debounceDelay: debounceDelay,
    trackInnerDimensions: true,
    onResize: enableWindowResize ? handleWindowResize : undefined,
  });

  // Screen size information
  const screenInfo = useMemo(
    () => ({
      isMobile: windowDimensions.innerWidth <= 768,
      isTablet: windowDimensions.innerWidth > 768 && windowDimensions.innerWidth <= 1024,
      isDesktop: windowDimensions.innerWidth > 1024 && windowDimensions.innerWidth <= 1440,
      isWideDesktop: windowDimensions.innerWidth > 1440,
      aspectRatio: windowDimensions.innerWidth / windowDimensions.innerHeight,
    }),
    [windowDimensions],
  );

  // Force recalculation function (non-debounced)
  const forceRecalculate = useCallback(() => {
    setIsRecalculating(true);
    setIsResponsive(true);

    try {
      const safeContainerWidth = Math.max(containerWidth, minContainerWidth);
      layoutEngine.updateConfig({
        containerWidth: safeContainerWidth,
        thumbnailSize,
      });

      if (monthGroups.length > 0) {
        layoutEngine.calculateLayout(monthGroups);
      }
    } catch (error) {
      console.error('Error during forced layout recalculation:', error);
    } finally {
      setIsRecalculating(false);
      setIsResponsive(false);
    }
  }, [containerWidth, thumbnailSize, layoutEngine, monthGroups, minContainerWidth]);

  // Detect significant configuration changes that require recalculation
  useEffect(() => {
    const currentConfig = { containerWidth, containerHeight, thumbnailSize };
    const previousConfig = previousConfigRef.current;

    if (previousConfig) {
      const widthChanged =
        Math.abs(currentConfig.containerWidth - previousConfig.containerWidth) > 10;
      const heightChanged =
        Math.abs(currentConfig.containerHeight - previousConfig.containerHeight) > 10;
      const thumbnailSizeChanged = currentConfig.thumbnailSize !== previousConfig.thumbnailSize;

      // Only recalculate if there are significant changes
      if (widthChanged || thumbnailSizeChanged) {
        debouncedRecalculate();
      }

      // Height changes don't require layout recalculation, just viewport updates
      if (heightChanged && !widthChanged && !thumbnailSizeChanged) {
        // Height change only affects viewport, not layout calculations
        setIsResponsive(true);
        setTimeout(() => setIsResponsive(false), 200);
      }
    }

    previousConfigRef.current = currentConfig;
  }, [containerWidth, containerHeight, thumbnailSize, debouncedRecalculate]);

  // Handle month groups changes
  useEffect(() => {
    if (monthGroups.length > 0) {
      // Force immediate recalculation when month groups change
      forceRecalculate();
    }
  }, [monthGroups, forceRecalculate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (recalculationTimeoutRef.current) {
        clearTimeout(recalculationTimeoutRef.current);
      }
      // Cancel any pending debounced calls
      debouncedRecalculate.cancel();
    };
  }, [debouncedRecalculate]);

  return {
    layoutEngine,
    isRecalculating,
    itemsPerRow,
    isResponsive,
    forceRecalculate,
    windowDimensions,
    isWindowResizing,
    screenInfo,
  };
}
