import React from 'react';
import { MonthGroup } from './types';

export interface MonthHeaderProps {
  /** Month group data containing year, month, and photos */
  monthGroup: MonthGroup;
  /** Number of photos in this month */
  photoCount: number;
}

/**
 * MonthHeader component displays month/year information and photo count
 * for a calendar view section. Follows existing app header patterns and
 * provides proper semantic HTML structure for accessibility.
 */
export const MonthHeader: React.FC<MonthHeaderProps> = ({ monthGroup, photoCount }) => {
  const { displayName, id } = monthGroup;
  
  // Special handling for unknown date groups
  const isUnknownDate = id === 'unknown-date';
  const isFallbackGroup = id === 'fallback-group';
  
  const headerClassName = `calendar-month-header${isUnknownDate ? ' calendar-month-header--unknown-date' : ''}${isFallbackGroup ? ' calendar-month-header--fallback' : ''}`;

  return (
    <header className={headerClassName} role="banner">
      <div className="calendar-month-header__content">
        <h2 className="calendar-month-header__title">
          {displayName}
        </h2>
        <span className="calendar-month-header__count" aria-label={`${photoCount} photos in ${displayName}`}>
          {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
        </span>
      </div>
      {isUnknownDate && (
        <div className="calendar-month-header__description">
          <p className="calendar-month-header__help-text">
            These photos have missing or invalid date information
          </p>
        </div>
      )}
      {isFallbackGroup && (
        <div className="calendar-month-header__description">
          <p className="calendar-month-header__help-text">
            Showing all photos due to grouping error
          </p>
        </div>
      )}
    </header>
  );
};