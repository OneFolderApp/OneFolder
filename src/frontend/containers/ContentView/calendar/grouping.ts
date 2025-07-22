import { ClientFile } from '../../../entities/File';
import { MonthGroup } from './types';

/**
 * Format month and year for display
 */
function formatMonthYear(year: number, month: number): string {
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Fast grouping using Map for O(1) operations
 * Groups photos by month based on dateCreated, falling back to dateModified or dateAdded
 */
export function groupPhotosByMonth(files: ClientFile[]): MonthGroup[] {
  const groups = new Map<string, ClientFile[]>();

  for (const file of files) {
    // Prioritize dateCreated, fall back to dateModified, then dateAdded
    const date = file.dateCreated || file.dateModified || file.dateAdded;
    if (!date) {
      continue;
    }

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(file);
  }

  // Convert to sorted array (newest first) and sort photos within each group by date
  return Array.from(groups.entries())
    .map(([key, photos]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        id: key,
        displayName: formatMonthYear(year, month - 1),
        year,
        month: month - 1,
        photos: photos.sort((a, b) => {
          const dateA = a.dateCreated || a.dateModified || a.dateAdded;
          const dateB = b.dateCreated || b.dateModified || b.dateAdded;
          return (dateA.getTime() || 0) - (dateB.getTime() || 0);
        }),
      };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

/**
 * Chunked processing to prevent UI blocking for large collections
 * Uses setTimeout(0) to yield control back to the browser between chunks
 */
export async function groupPhotosChunked(files: ClientFile[]): Promise<MonthGroup[]> {
  // Small collections don't need chunking
  if (files.length < 10000) {
    return groupPhotosByMonth(files);
  }

  const chunkSize = 5000;
  const groups = new Map<string, ClientFile[]>();

  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);

    // Process chunk
    for (const file of chunk) {
      const date = file.dateCreated || file.dateModified || file.dateAdded;
      if (!date) {
        continue;
      }

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(file);
    }

    // Yield to browser every chunk to prevent UI blocking
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Convert to final format
  return Array.from(groups.entries())
    .map(([key, photos]) => {
      const [year, month] = key.split('-').map(Number);
      return {
        id: key,
        displayName: formatMonthYear(year, month - 1),
        year,
        month: month - 1,
        photos: photos.sort((a, b) => {
          const dateA = a.dateCreated || a.dateModified || a.dateAdded;
          const dateB = b.dateCreated || b.dateModified || b.dateAdded;
          return (dateA.getTime() || 0) - (dateB.getTime() || 0);
        }),
      };
    })
    .sort((a, b) => b.year - a.year || b.month - a.month);
}
