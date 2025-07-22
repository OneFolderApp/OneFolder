import React from 'react';
import { GalleryProps } from './utils';
import { CalendarView } from './calendar';

const CalendarGallery = ({ contentRect, select, lastSelectionIndex }: GalleryProps) => {
  return (
    <CalendarView
      contentRect={contentRect}
      select={select}
      lastSelectionIndex={lastSelectionIndex}
    />
  );
};

export default CalendarGallery;
