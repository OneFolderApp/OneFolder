import { ID } from './id';

/**
 * DTO for storing computed visual hashes to avoid recomputation
 */
export interface VisualHashDTO {
  id?: ID; // Auto-incremented by Dexie
  absolutePath: string; // Unique file path (indexed)
  fileSize: number; // File size for change detection
  dateModified: Date; // File modification date for change detection
  hashType: 'aHash' | 'dctHash' | 'waveletHash'; // Algorithm used
  hash: string; // The computed hash (binary string)
  dateComputed: Date; // When this hash was computed
  thumbnailPath?: string; // Path to thumbnail used (for debugging)
}

/**
 * Simplified version for worker communication
 */
export interface VisualHashCache {
  absolutePath: string;
  hash: string;
  hashType: string;
  isValid: boolean; // Whether the cached hash is still valid
}
