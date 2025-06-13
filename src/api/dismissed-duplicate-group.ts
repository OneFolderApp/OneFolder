import { ID } from './id';

/**
 * Data Transfer Object for a dismissed duplicate group
 * Stores information about duplicate groups that have been dismissed by the user
 */
export interface DismissedDuplicateGroupDTO {
  id: ID;
  groupHash: string; // Unique hash identifying the specific group of files
  algorithm: string; // Which duplicate detection algorithm found this group
  fileIds: string; // JSON array of file IDs for reference/debugging
  dismissedAt: Date; // When the group was dismissed
  userNote?: string; // Optional note from user explaining dismissal reason
}
