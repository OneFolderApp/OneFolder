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
  const { displayName } = monthGroup;

  return (
    <header className="calendar-month-header" role="banner">
      <div className="calendar-month-header__content">
        <h2 className="calendar-month-header__title">
          {displayName}
        </h2>
        <span className="calendar-month-header__count" aria-label={`${photoCount} photos in ${displayName}`}>
          {photoCount} {photoCount === 1 ? 'photo' : 'photos'}
        </span>
      </div>
    </header>
  );
};