import { ClientFile } from '../../../entities/File';
import { MonthGroup } from './types';

/**
 * Month names for display formatting
 */
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Creates a display name for a month and year
 * @param month Month (0-11)
 * @param year Full year
 * @returns Formatted display name (e.g., "January 2024")
 */
export function formatMonthYear(month: number, year: number): string {
  if (month < 0 || month > 11) {
    throw new Error(`Invalid month: ${month}. Month must be between 0 and 11.`);
  }
  return `${MONTH_NAMES[month]} ${year}`;
}

/**
 * Creates a unique identifier for a month group
 * @param month Month (0-11)
 * @param year Full year
 * @returns Unique identifier (e.g., "2024-01")
 */
export function createMonthGroupId(month: number, year: number): string {
  if (month < 0 || month > 11) {
    throw new Error(`Invalid month: ${month}. Month must be between 0 and 11.`);
  }
  // Pad month with zero for consistent sorting
  const paddedMonth = (month + 1).toString().padStart(2, '0');
  return `${year}-${paddedMonth}`;
}

/**
 * Extracts month and year from a date, handling invalid dates gracefully
 * @param date Date to extract from
 * @returns Object with month (0-11) and year, or null if date is invalid
 */
export function extractMonthYear(date: Date): { month: number; year: number } | null {
  if (!date || isNaN(date.getTime())) {
    return null;
  }
  
  return {
    month: date.getMonth(),
    year: date.getFullYear()
  };
}

/**
 * Groups files by month and year based on their dateCreated property
 * @param files Array of ClientFile objects to group
 * @returns Array of MonthGroup objects sorted by date (newest first)
 */
export function groupFilesByMonth(files: ClientFile[]): MonthGroup[] {
  // Group files by month-year key
  const groupMap = new Map<string, ClientFile[]>();
  const unknownDateFiles: ClientFile[] = [];
  
  for (const file of files) {
    const monthYear = extractMonthYear(file.dateCreated);
    
    if (monthYear === null) {
      // Handle files with invalid dates
      unknownDateFiles.push(file);
      continue;
    }
    
    const groupId = createMonthGroupId(monthYear.month, monthYear.year);
    
    if (!groupMap.has(groupId)) {
      groupMap.set(groupId, []);
    }
    
    groupMap.get(groupId)!.push(file);
  }
  
  // Convert map to MonthGroup array
  const monthGroups: MonthGroup[] = [];
  
  for (const [groupId, groupFiles] of groupMap.entries()) {
    // Parse the group ID to get month and year
    const [yearStr, monthStr] = groupId.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1; // Convert back to 0-11
    
    // Sort files within the group by dateCreated (oldest first within month)
    const sortedFiles = groupFiles.sort((a, b) => {
      const dateA = a.dateCreated.getTime();
      const dateB = b.dateCreated.getTime();
      return dateA - dateB;
    });
    
    monthGroups.push({
      year,
      month,
      photos: sortedFiles,
      displayName: formatMonthYear(month, year),
      id: groupId
    });
  }
  
  // Add unknown date group if there are files with invalid dates
  if (unknownDateFiles.length > 0) {
    // Sort unknown date files by filename as fallback
    const sortedUnknownFiles = unknownDateFiles.sort((a, b) => 
      a.name.localeCompare(b.name)
    );
    
    monthGroups.push({
      year: 0,
      month: 0,
      photos: sortedUnknownFiles,
      displayName: 'Unknown Date',
      id: 'unknown-date'
    });
  }
  
  // Sort month groups by date (newest first)
  monthGroups.sort((a, b) => {
    // Unknown date group goes to the end
    if (a.id === 'unknown-date') return 1;
    if (b.id === 'unknown-date') return -1;
    
    // Compare by year first, then by month
    if (a.year !== b.year) {
      return b.year - a.year; // Newest year first
    }
    return b.month - a.month; // Newest month first
  });
  
  return monthGroups;
}

/**
 * Validates that a date is reasonable for photo metadata
 * @param date Date to validate
 * @returns true if date is reasonable, false otherwise
 */
export function isReasonablePhotoDate(date: Date): boolean {
  if (!date || isNaN(date.getTime())) {
    return false;
  }
  
  const year = date.getFullYear();
  const currentYear = new Date().getFullYear();
  
  // Photos should be between 1900 and 10 years in the future
  // (to account for camera clock issues)
  return year >= 1900 && year <= currentYear + 10;
}

/**
 * Gets a safe date for grouping, handling edge cases
 * @param file ClientFile to get date from
 * @returns Date for grouping, or null if no valid date available
 */
export function getSafeDateForGrouping(file: ClientFile): Date | null {
  // Try dateCreated first
  if (isReasonablePhotoDate(file.dateCreated)) {
    return file.dateCreated;
  }
  
  // Fallback to dateModified if dateCreated is unreasonable
  if (isReasonablePhotoDate(file.dateModified)) {
    return file.dateModified;
  }
  
  // Fallback to dateAdded as last resort
  if (isReasonablePhotoDate(file.dateAdded)) {
    return file.dateAdded;
  }
  
  return null;
}