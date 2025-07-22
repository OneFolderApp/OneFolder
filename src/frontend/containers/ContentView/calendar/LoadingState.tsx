import React from 'react';
import { IconSet } from 'widgets';

export interface LoadingStateProps {
  /** Type of loading operation */
  type:
    | 'initial'
    | 'grouping'
    | 'layout'
    | 'large-collection'
    | 'virtualization'
    | 'progressive'
    | 'optimized-grouping';
  /** Optional custom message */
  message?: string;
  /** Show progress indicator */
  showProgress?: boolean;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Number of items being processed (for context) */
  itemCount?: number;
  /** Number of items processed so far (for progressive loading) */
  processedCount?: number;
  /** Estimated time remaining (in milliseconds) */
  estimatedTimeRemaining?: number;
  /** Current batch being processed */
  currentBatch?: number;
  /** Total number of batches */
  totalBatches?: number;
}

/**
 * LoadingState component for displaying loading indicators during various operations
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  type,
  message,
  showProgress = false,
  progress = 0,
  itemCount,
  processedCount,
  estimatedTimeRemaining,
  currentBatch,
  totalBatches,
}) => {
  const getDefaultContent = () => {
    switch (type) {
      case 'initial':
        return {
          title: 'Loading calendar view...',
          message: 'Preparing your photos for calendar display.',
        };
      case 'grouping':
        return {
          title: 'Organizing photos...',
          message: 'Grouping photos by date for calendar view.',
        };
      case 'layout':
        return {
          title: 'Calculating layout...',
          message: 'Optimizing display for your screen size.',
        };
      case 'large-collection':
        return {
          title: 'Processing large collection...',
          message: itemCount
            ? `Processing ${itemCount.toLocaleString()} photos. This may take a moment.`
            : 'This may take a moment for collections with many photos.',
        };
      case 'virtualization':
        return {
          title: 'Optimizing display...',
          message: 'Preparing virtualized rendering for smooth scrolling.',
        };
      case 'progressive':
        return {
          title: 'Processing photos...',
          message:
            processedCount && itemCount
              ? `Processed ${processedCount.toLocaleString()} of ${itemCount.toLocaleString()} photos`
              : 'Processing photos in batches for optimal performance.',
        };
      case 'optimized-grouping':
        return {
          title: 'Optimizing large collection...',
          message:
            currentBatch && totalBatches
              ? `Processing batch ${currentBatch} of ${totalBatches}${
                  estimatedTimeRemaining
                    ? ` (${Math.round(estimatedTimeRemaining / 1000)}s remaining)`
                    : ''
                }`
              : 'Using advanced algorithms for optimal performance with large collections.',
        };
      default:
        return {
          title: 'Loading...',
          message: 'Please wait while content is being prepared.',
        };
    }
  };

  const content = getDefaultContent();
  const displayMessage = message || content.message;

  return (
    <div className="calendar-loading-state">
      <div className="calendar-loading-state__content">
        <div className="calendar-loading-state__spinner">
          <span className="custom-icon-32 calendar-loading-state__icon">{IconSet.LOADING}</span>
        </div>
        <h3 className="calendar-loading-state__title">{content.title}</h3>
        <p className="calendar-loading-state__message">{displayMessage}</p>
        {showProgress && (
          <div className="calendar-loading-state__progress">
            <div className="calendar-loading-state__progress-bar">
              <div
                className="calendar-loading-state__progress-fill"
                style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
              />
            </div>
            <span className="calendar-loading-state__progress-text">{Math.round(progress)}%</span>
          </div>
        )}
      </div>
    </div>
  );
};
