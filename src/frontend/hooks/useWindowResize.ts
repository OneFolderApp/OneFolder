import { useCallback, useEffect, useRef, useState } from 'react';
import { debounce } from 'common/timeout';

export interface WindowDimensions {
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
}

export interface UseWindowResizeOptions {
  /** Debounce delay for resize events (ms) */
  debounceDelay?: number;
  /** Whether to track inner dimensions */
  trackInnerDimensions?: boolean;
  /** Whether to track device pixel ratio changes */
  trackDevicePixelRatio?: boolean;
  /** Callback for resize events */
  onResize?: (dimensions: WindowDimensions) => void;
  /** Minimum time between resize callbacks (ms) */
  throttleDelay?: number;
}

/**
 * Hook for handling window resize events with debouncing and throttling
 * Provides current window dimensions and resize event handling
 */
export function useWindowResize(options: UseWindowResizeOptions = {}) {
  const {
    debounceDelay = 150,
    trackInnerDimensions = true,
    trackDevicePixelRatio = false,
    onResize,
    throttleDelay = 16, // ~60fps
  } = options;

  const [dimensions, setDimensions] = useState<WindowDimensions>(() => ({
    width: window.outerWidth,
    height: window.outerHeight,
    innerWidth: trackInnerDimensions ? window.innerWidth : window.outerWidth,
    innerHeight: trackInnerDimensions ? window.innerHeight : window.outerHeight,
    devicePixelRatio: trackDevicePixelRatio ? window.devicePixelRatio : 1,
  }));

  const [isResizing, setIsResizing] = useState(false);
  const resizeTimeoutRef = useRef<number | null>(null);
  const lastResizeTimeRef = useRef<number>(0);

  // Get current dimensions
  const getCurrentDimensions = useCallback((): WindowDimensions => {
    return {
      width: window.outerWidth,
      height: window.outerHeight,
      innerWidth: trackInnerDimensions ? window.innerWidth : window.outerWidth,
      innerHeight: trackInnerDimensions ? window.innerHeight : window.outerHeight,
      devicePixelRatio: trackDevicePixelRatio ? window.devicePixelRatio : 1,
    };
  }, [trackInnerDimensions, trackDevicePixelRatio]);

  // Throttled resize handler to prevent excessive updates
  const throttledUpdateDimensions = useCallback(() => {
    const now = Date.now();
    if (now - lastResizeTimeRef.current >= throttleDelay) {
      const newDimensions = getCurrentDimensions();
      setDimensions(newDimensions);
      onResize?.(newDimensions);
      lastResizeTimeRef.current = now;
    }
  }, [getCurrentDimensions, onResize, throttleDelay]);

  // Debounced resize end handler
  const debouncedResizeEnd = useCallback(
    debounce(() => {
      setIsResizing(false);
      const finalDimensions = getCurrentDimensions();
      setDimensions(finalDimensions);
      onResize?.(finalDimensions);
    }, debounceDelay),
    [getCurrentDimensions, onResize, debounceDelay],
  );

  // Main resize handler
  const handleResize = useCallback(() => {
    setIsResizing(true);

    // Clear existing timeout
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    // Throttled update during resize
    throttledUpdateDimensions();

    // Debounced final update
    debouncedResizeEnd();
  }, [throttledUpdateDimensions, debouncedResizeEnd]);

  // Set up event listeners
  useEffect(() => {
    window.addEventListener('resize', handleResize, { passive: true });

    // Also listen for orientation changes on mobile
    const handleOrientationChange = () => {
      // Small delay to allow for orientation change to complete
      setTimeout(handleResize, 100);
    };

    window.addEventListener('orientationchange', handleOrientationChange, { passive: true });

    // Listen for device pixel ratio changes if tracking
    let mediaQuery: MediaQueryList | null = null;
    if (trackDevicePixelRatio) {
      mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mediaQuery.addEventListener('change', handleResize);
    }

    // Store the current timeout ref for cleanup
    const currentResizeTimeoutRef = resizeTimeoutRef;

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);

      if (mediaQuery) {
        mediaQuery.removeEventListener('change', handleResize);
      }

      if (currentResizeTimeoutRef.current) {
        clearTimeout(currentResizeTimeoutRef.current);
      }

      // Cancel any pending debounced calls
      debouncedResizeEnd.cancel();
    };
  }, [handleResize, trackDevicePixelRatio, debouncedResizeEnd]);

  return {
    dimensions,
    isResizing,
    getCurrentDimensions,
  };
}

/**
 * Hook for detecting screen size breakpoints
 */
export function useScreenSize() {
  const { dimensions } = useWindowResize({
    debounceDelay: 100,
    trackInnerDimensions: true,
  });

  const screenSize = {
    isMobile: dimensions.innerWidth <= 768,
    isTablet: dimensions.innerWidth > 768 && dimensions.innerWidth <= 1024,
    isDesktop: dimensions.innerWidth > 1024 && dimensions.innerWidth <= 1440,
    isWideDesktop: dimensions.innerWidth > 1440,
    isNarrow: dimensions.innerWidth <= 480,
    isWide: dimensions.innerWidth >= 1200,
    isUltraWide: dimensions.innerWidth >= 1920,
    aspectRatio: dimensions.innerWidth / dimensions.innerHeight,
    isLandscape: dimensions.innerWidth > dimensions.innerHeight,
    isPortrait: dimensions.innerHeight > dimensions.innerWidth,
  };

  return {
    ...screenSize,
    dimensions,
  };
}
