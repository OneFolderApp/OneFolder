import React from 'react';
import { IconSet, Button } from 'widgets';

export interface EmptyStateProps {
  /** Type of empty state to display */
  type: 'no-photos' | 'no-results' | 'unknown-date' | 'processing-error';
  /** Optional custom message */
  message?: string;
  /** Optional custom icon */
  icon?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * EmptyState component for displaying appropriate messages when no content is available
 */
export const EmptyState: React.FC<EmptyStateProps> = ({ type, message, icon, action }) => {
  const getDefaultContent = () => {
    switch (type) {
      case 'no-photos':
        return {
          icon: IconSet.MEDIA,
          title: 'No photos to display',
          message: 'Import some photos to see them organized by date in calendar view.',
        };
      case 'no-results':
        return {
          icon: IconSet.SEARCH,
          title: 'No photos match your search',
          message: 'Try adjusting your search criteria to find photos.',
        };
      case 'unknown-date':
        return {
          icon: IconSet.WARNING,
          title: 'Photos with unknown dates',
          message: 'These photos have missing or invalid date information.',
        };
      case 'processing-error':
        return {
          icon: IconSet.WARNING,
          title: 'Unable to process photos',
          message: 'There was an error processing your photos for calendar view. This may be due to corrupted metadata or system issues.',
        };
      default:
        return {
          icon: IconSet.INFO,
          title: 'No content available',
          message: 'There is no content to display at this time.',
        };
    }
  };

  const content = getDefaultContent();
  const displayIcon = icon || content.icon;
  const displayMessage = message || content.message;

  return (
    <div className="calendar-empty-state">
      <div className="calendar-empty-state__content">
        <div className="calendar-empty-state__icon">
          <span className="custom-icon-48">{displayIcon}</span>
        </div>
        <h3 className="calendar-empty-state__title">{content.title}</h3>
        <p className="calendar-empty-state__message">{displayMessage}</p>
        {action && (
          <div className="calendar-empty-state__action">
            <Button
              styling="outlined"
              text={action.label}
              onClick={action.onClick}
            />
          </div>
        )}
      </div>
    </div>
  );
};