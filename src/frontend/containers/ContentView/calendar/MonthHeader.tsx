import React from 'react';
import { MonthGroup } from './types';

export interface MonthHeaderProps {
  /** Month group data containing year, month, and photos */
  monthGroup: MonthGroup;
  /** Number of photos in this month */
  photoCount: number;
  /** Whether this header is currently in view (for screen readers) */
  isInView?: boolean;
}

/**
 * MonthHeader component displays month/year information and photo count
 * for a calendar view section. Follows existing app header patterns and
 * provides proper semantic HTML structure for accessibility.
 */
export const MonthHeader: React.FC<MonthHeaderProps> = ({ 
  monthGroup, 
  photoCount, 
  isInView = false 
}) => {
  const { displayName, id } = monthGroup;
  
  // Special handling for unknown date groups
  const isUnknownDate = id === 'unknown-date';
  const isFallbackGroup = id === 'fallback-group';
  
  const headerClassName = `calendar-month-header${isUnknownDate ? ' calendar-month-header--unknown-date' : ''}${isFallbackGroup ? ' calendar-month-header--fallback' : ''}`;

  // Generate accessible description for screen readers
  const getAccessibleDescription = () => {
    if (isUnknownDate) {
      return `${displayName} section containing ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} with missing or invalid date information`;
    }
    if (isFallbackGroup) {
      return `${displayName} section containing ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} shown due to grouping error`;
    }
    return `${displayName} section containing ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'}`;
  };

  return (
    <header 
      className={headerClassName} 
      role="banner"
      aria-label={getAccessibleDescription()}
      aria-live={isInView ? "polite" : undefined}
    >
      <div className="calendar-month-header__content">
        <h2 
          className="calendar-month-header__title"
          id={`month-header-${id}`}
          aria-describedby={isUnknownDate || isFallbackGroup ? `month-description-${id}` : undefined}
        >
          {displayName}
        </h2>
        <span 
          className="calendar-month-header__count" 
          aria-label={`${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} in ${displayName}`}
          role="status"
        >
          {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
        </span>
      </div>
      {(isUnknownDate || isFallbackGroup) && (
        <div 
          className="calendar-month-header__description"
          id={`month-description-${id}`}
          role="note"
          aria-live="polite"
        >
          <p className="calendar-month-header__help-text">
            {isUnknownDate 
              ? 'These photos have missing or invalid date information. You can update photo dates in the metadata editor.'
              : 'Showing all photos due to grouping error. Try refreshing the view or switching to a different layout.'
            }
          </p>
        </div>
      )}
    </header>
  );
};