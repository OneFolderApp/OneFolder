/**
 * Progressive loading component for large photo collections
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ClientFile } from '../../../entities/File';
import { MonthGroup } from './types';
import {
  OptimizedDateGroupingEngine,
  GroupingProgress,
  GroupingResult,
} from './OptimizedDateGrouping';
import { calendarPerformanceMonitor } from './PerformanceMonitor';
import { calendarMemoryManager } from './MemoryManager';

export interface ProgressiveLoaderProps {
  /** Files to process */
  files: ClientFile[];
  /** Callback when grouping is complete */
  onGroupingComplete: (result: GroupingResult) => void;
  /** Callback for progress updates */
  onProgress?: (progress: GroupingProgress) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Whether to start loading immediately */
  autoStart?: boolean;
  /** Custom configuration for grouping engine */
  groupingConfig?: {
    batchSize?: number;
    yieldInterval?: number;
    useDateCache?: boolean;
    useAdaptiveChunks?: boolean;
  };
}

export interface ProgressiveLoaderState {
  isLoading: boolean;
  progress: GroupingProgress | null;
  error: Error | null;
  result: GroupingResult | null;
  canCancel: boolean;
}

/**
 * Hook for using progressive loader
 */
export function useProgressiveLoader(
  files: ClientFile[],
  options: {
    onComplete?: (result: GroupingResult) => void;
    onProgress?: (progress: GroupingProgress) => void;
    onError?: (error: Error) => void;
    autoStart?: boolean;
    groupingConfig?: {
      batchSize?: number;
      yieldInterval?: number;
      useDateCache?: boolean;
      useAdaptiveChunks?: boolean;
    };
  } = {},
) {
  const [state, setState] = useState<ProgressiveLoaderState>({
    isLoading: false,
    progress: null,
    error: null,
    result: null,
    canCancel: false,
  });

  const groupingEngineRef = useRef<OptimizedDateGroupingEngine | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const startLoading = useCallback(async () => {
    if (state.isLoading || files.length === 0) {
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      progress: null,
      error: null,
      result: null,
      canCancel: true,
    }));

    abortControllerRef.current = new AbortController();

    // Configure grouping engine based on collection size
    const isVeryLargeCollection = files.length > 50000;
    const isLargeCollection = files.length > 20000;
    const isMediumCollection = files.length > 5000;

    // Determine optimal batch size and yield interval
    const batchSize =
      options.groupingConfig?.batchSize ||
      (isVeryLargeCollection ? 5000 : isLargeCollection ? 3000 : isMediumCollection ? 2000 : 1000);

    const yieldInterval =
      options.groupingConfig?.yieldInterval ||
      (isVeryLargeCollection ? 2500 : isLargeCollection ? 1500 : isMediumCollection ? 1000 : 500);

    // Create optimized grouping engine
    groupingEngineRef.current = new OptimizedDateGroupingEngine({
      batchSize,
      yieldInterval,
      incrementalGrouping: isMediumCollection,
      useDateCache: options.groupingConfig?.useDateCache !== false,
      useAdaptiveChunks: options.groupingConfig?.useAdaptiveChunks !== false && isLargeCollection,
    });

    // Configure memory manager for large collections
    if (isLargeCollection) {
      calendarMemoryManager.updateConfig({
        maxThumbnailCache: Math.min(2000, Math.floor(files.length * 0.1)),
        aggressiveCleanup: isVeryLargeCollection,
        prioritizeVisible: true,
        preloadAdjacent: !isVeryLargeCollection,
        maxPreloadCount: isVeryLargeCollection ? 20 : 50,
      });
    }

    // Start performance monitoring
    calendarPerformanceMonitor.startTiming('date-grouping');
    calendarPerformanceMonitor.setCollectionMetrics(files.length, 0);
    startTimeRef.current = performance.now();

    try {
      // Process files with progress tracking
      let lastBatchTime = performance.now();

      const result = await groupingEngineRef.current.groupFilesByMonth(
        files,
        (progress) => {
          // Record batch processing time for performance metrics
          const now = performance.now();
          const batchTime = now - lastBatchTime;
          lastBatchTime = now;

          if (progress.currentBatch > 1) {
            calendarPerformanceMonitor.recordProgressiveBatch(
              progress.processed - (state.progress?.processed || 0),
              batchTime,
            );
          }

          setState((prev) => ({ ...prev, progress }));
          options.onProgress?.(progress);
        },
        abortControllerRef.current.signal,
      );

      // End performance monitoring
      const groupingTime = calendarPerformanceMonitor.endTiming('date-grouping');
      calendarPerformanceMonitor.setCollectionMetrics(files.length, result.monthGroups.length);

      // Update result with performance data
      result.processingTime = groupingTime;

      setState((prev) => ({
        ...prev,
        isLoading: false,
        result,
        canCancel: false,
      }));

      options.onComplete?.(result);

      // Log performance summary for large collections
      if (files.length > 1000) {
        console.log('📊 Progressive loading completed:', {
          files: files.length.toLocaleString(),
          groups: result.monthGroups.length,
          time: `${result.processingTime.toFixed(1)}ms`,
          validDates: result.statistics.validDates,
          invalidDates: result.statistics.invalidDates,
          cachingEfficiency: result.statistics.cachingEfficiency
            ? `${result.statistics.cachingEfficiency.toFixed(1)}%`
            : 'N/A',
        });
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown grouping error');

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorObj,
        canCancel: false,
      }));

      options.onError?.(errorObj);

      // Log error for debugging
      console.error('Progressive loading failed:', errorObj);
    } finally {
      // Clean up resources
      if (groupingEngineRef.current) {
        groupingEngineRef.current.clearCache();
      }
    }
  }, [files, options, state.isLoading, state.progress?.processed]);

  const cancelLoading = useCallback(() => {
    if (abortControllerRef.current && state.canCancel) {
      abortControllerRef.current.abort();
      groupingEngineRef.current?.cancel();

      setState((prev) => ({
        ...prev,
        isLoading: false,
        canCancel: false,
        error: new Error('Loading cancelled by user'),
      }));
    }
  }, [state.canCancel]);

  const retryLoading = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
    startLoading();
  }, [startLoading]);

  // Auto-start loading
  useEffect(() => {
    if (options.autoStart !== false && files.length > 0 && !state.isLoading && !state.result) {
      startLoading();
    }
  }, [files, options.autoStart, startLoading, state.isLoading, state.result]);

  // Cleanup
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    ...state,
    startLoading,
    cancelLoading,
    retryLoading,
  };
}
