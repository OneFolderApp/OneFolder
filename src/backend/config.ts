
/**
 * Minimal config file now that we've removed Dexie-specific logic.
 * We simply keep the constants that are used elsewhere.
 */

export const DB_NAME = 'OneFolder'
export const NUM_AUTO_BACKUPS = 6
export const AUTO_BACKUP_TIMEOUT = 1000 * 60 * 10 // 10 minutes
