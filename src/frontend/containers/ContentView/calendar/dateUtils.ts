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
    // Try to get a safe date for grouping (with fallbacks)
    const safeDate = getSafeDateForGrouping(file);
    const monthYear = safeDate ? extractMonthYear(safeDate) : null;
    
    if (monthYear === null) {
      // Handle files with invalid dates - use enhanced fallback handling
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
    
    // Sort files within the group by their best available date (oldest first within month)
    const sortedFiles = groupFiles.sort((a, b) => {
      const dateA = getSafeDateForGrouping(a) || new Date(0);
      const dateB = getSafeDateForGrouping(b) || new Date(0);
      return dateA.getTime() - dateB.getTime();
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
    // Sort unknown date files by filename as fallback, with secondary sort by file size
    const sortedUnknownFiles = unknownDateFiles.sort((a, b) => {
      const nameComparison = a.name.localeCompare(b.name);
      if (nameComparison !== 0) return nameComparison;
      // Secondary sort by file size for files with identical names
      return (a.size || 0) - (b.size || 0);
    });
    
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

/**
 * Safely groups files with error handling and graceful degradation
 * @param files Array of ClientFile objects to group
 * @returns Array of MonthGroup objects, with fallback handling for errors
 */
export function safeGroupFilesByMonth(files: ClientFile[]): MonthGroup[] {
  try {
    return groupFilesByMonth(files);
  } catch (error) {
    console.error('Error grouping files by month:', error);
    
    // Fallback: create a single group with all files
    const fallbackGroup: MonthGroup = {
      year: new Date().getFullYear(),
      month: new Date().getMonth(),
      photos: Array.isArray(files) ? files.sort((a, b) => a.name.localeCompare(b.name)) : [],
      displayName: 'All Photos (Fallback)',
      id: 'fallback-group'
    };
    
    return [fallbackGroup];
  }
}

/**
 * Validates that a month group has reasonable data
 * @param group MonthGroup to validate
 * @returns true if group is valid, false otherwise
 */
export function isValidMonthGroup(group: MonthGroup): boolean {
  if (!group || typeof group !== 'object') {
    return false;
  }
  
  // Check required properties
  if (typeof group.year !== 'number' || typeof group.month !== 'number') {
    return false;
  }
  
  if (!Array.isArray(group.photos)) {
    return false;
  }
  
  if (typeof group.displayName !== 'string' || typeof group.id !== 'string') {
    return false;
  }
  
  // Check month is in valid range (except for special groups like unknown-date)
  if (group.id !== 'unknown-date' && group.id !== 'fallback-group') {
    if (group.month < 0 || group.month > 11) {
      return false;
    }
  }
  
  return true;
}

/**
 * Filters out invalid month groups and logs warnings
 * @param groups Array of MonthGroup objects to validate
 * @returns Array of valid MonthGroup objects
 */
export function validateMonthGroups(groups: MonthGroup[]): MonthGroup[] {
  const validGroups = groups.filter((group, index) => {
    const isValid = isValidMonthGroup(group);
    if (!isValid) {
      console.warn(`Invalid month group at index ${index}:`, group);
    }
    return isValid;
  });
  
  if (validGroups.length !== groups.length) {
    console.warn(`Filtered out ${groups.length - validGroups.length} invalid month groups`);
  }
  
  return validGroups;
}

/**
 * Progressive grouping for very large collections
 * @param files Array of ClientFile objects to group
 * @param batchSize Number of files to process per batch
 * @param onProgress Callback for progress updates
 * @returns Promise that resolves to array of MonthGroup objects
 */
export async function progressiveGroupFilesByMonth(
  files: ClientFile[],
  batchSize: number = 1000,
  onProgress?: (processed: number, total: number) => void
): Promise<MonthGroup[]> {
  if (files.length <= batchSize) {
    // For small collections, use regular grouping
    return safeGroupFilesByMonth(files);
  }

  const groupMap = new Map<string, ClientFile[]>();
  const unknownDateFiles: ClientFile[] = [];
  let processed = 0;

  // Process files in batches
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    
    for (const file of batch) {
      try {
        const safeDate = getSafeDateForGrouping(file);
        const monthYear = safeDate ? extractMonthYear(safeDate) : null;
        
        if (monthYear === null) {
          unknownDateFiles.push(file);
          continue;
        }
        
        const groupId = createMonthGroupId(monthYear.month, monthYear.year);
        
        if (!groupMap.has(groupId)) {
          groupMap.set(groupId, []);
        }
        
        groupMap.get(groupId)!.push(file);
      } catch (error) {
        console.warn('Error processing file in progressive grouping:', file.name, error);
        unknownDateFiles.push(file);
      }
    }
    
    processed += batch.length;
    onProgress?.(processed, files.length);
    
    // Yield control to prevent blocking the UI
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  // Convert to MonthGroup array (same logic as regular grouping)
  const monthGroups: MonthGroup[] = [];
  
  for (const [groupId, groupFiles] of groupMap.entries()) {
    const [yearStr, monthStr] = groupId.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    
    const sortedFiles = groupFiles.sort((a, b) => {
      const dateA = getSafeDateForGrouping(a) || new Date(0);
      const dateB = getSafeDateForGrouping(b) || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });
    
    monthGroups.push({
      year,
      month,
      photos: sortedFiles,
      displayName: formatMonthYear(month, year),
      id: groupId
    });
  }
  
  // Add unknown date group if needed
  if (unknownDateFiles.length > 0) {
    const sortedUnknownFiles = unknownDateFiles.sort((a, b) => {
      const nameComparison = a.name.localeCompare(b.name);
      if (nameComparison !== 0) return nameComparison;
      return (a.size || 0) - (b.size || 0);
    });
    
    monthGroups.push({
      year: 0,
      month: 0,
      photos: sortedUnknownFiles,
      displayName: 'Unknown Date',
      id: 'unknown-date'
    });
  }
  
  // Sort month groups
  monthGroups.sort((a, b) => {
    if (a.id === 'unknown-date') return 1;
    if (b.id === 'unknown-date') return -1;
    
    if (a.year !== b.year) {
      return b.year - a.year;
    }
    return b.month - a.month;
  });
  
  return monthGroups;
}