/**
 * BackupScheduler for Yjs that creates full snapshots of the Y.Doc state and supports full-overwrite restoration.
 *
 * This implementation provides two separate backup mechanisms:
 *
 * 1. **Auto Backup Functionality:**
 *    - Triggered via the `schedule()` method (using a debounced function), it writes a file named
 *      `auto-backup-<index>.json` and makes daily/weekly copies.
 *
 * 2. **Auto Dump Functionality:**
 *    - Independently, every 10 seconds the entire Y.Doc is dumped (exported) to a single file named
 *      `database.db` inside the backup folder. This file is overwritten on each dump.
 *
 * The folder structure is:
 *   <baseBackupDirectory>/database/<sessionId>/
 * where the auto backup files and the dump file reside.
 *
 * When restoring, the persistent storage (y-indexeddb) is cleared, a new Y.Doc is created,
 * the backup update is applied, and the y-indexeddb provider is reinitialized.
 */

import * as Y from 'yjs';
import fse from 'fs-extra';
import path from 'path';
import { debounce } from '../../common/timeout';
import { DataBackup } from '../api/data-backup';
import { AUTO_BACKUP_TIMEOUT, NUM_AUTO_BACKUPS } from './config';

/** Returns the date at 00:00 today */
function getToday(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/** Returns the date at the start of the current week (Sunday at 00:00) */
function getWeekStart(): Date {
  const date = getToday();
  const dayOfWeek = date.getDay();
  date.setDate(date.getDate() - dayOfWeek);
  return date;
}

export default class BackupScheduler implements DataBackup {
  #ydoc: Y.Doc;
  #backupDirectory: string;
  #sessionId: string;
  #lastBackupIndex: number = 0;
  #lastBackupDate: Date = new Date(0);
  #dumpInterval: NodeJS.Timeout | null = null;

  /**
   * @param ydoc The Y.Doc that holds all data (files, tags, locations, searches, etc).
   * @param directory The base folder path where backup files are stored.
   * @param sessionId The unique session ID for this installation.
   *
   * The actual backup folder is: path.join(directory, "database", sessionId)
   */
  constructor(ydoc: Y.Doc, directory: string, sessionId: string) {
    this.#ydoc = ydoc;
    this.#sessionId = sessionId;
    this.#backupDirectory = path.join(directory, 'database', sessionId);
    fse.ensureDirSync(this.#backupDirectory);
    // Start the auto dump functionality independently.
    this.#startAutoDump();
  }

  /**
   * Initializes the BackupScheduler by ensuring the session-specific backup folder exists.
   * @param ydoc The Y.Doc instance.
   * @param backupDirectory The base backup directory.
   * @param sessionId The unique session id.
   */
  static async init(
    ydoc: Y.Doc,
    backupDirectory: string,
    sessionId: string,
  ): Promise<BackupScheduler> {
    const directory = path.join(backupDirectory, 'database', sessionId);
    await fse.ensureDir(directory);
    return new BackupScheduler(ydoc, backupDirectory, sessionId);
  }

  /**
   * Updates the backup directory to a new base path.
   * The actual backup path will be the new directory joined with "database" and the sessionId.
   * Also restarts the auto dump functionality to use the new directory.
   * @param newDir The new base backup directory.
   */
  async updateBackupDirectory(newDir: string): Promise<void> {
    this.#backupDirectory = path.join(newDir, 'database', this.#sessionId);
    await fse.ensureDir(this.#backupDirectory);
    console.log('BackupScheduler: Updated backup directory to', this.#backupDirectory);
    // Restart auto dump with the new backup directory.
    this.stopAutoDump();
    this.#startAutoDump();
  }

  /**
   * Returns the current backup directory.
   */
  getBackupDirectory(): string {
    return this.#backupDirectory;
  }

  /**
   * **Auto Backup Functionality:**
   * Called whenever there's a data change that might merit an auto-backup.
   * Uses a debounced periodic backup that creates files named `auto-backup-<index>.json`
   * along with daily and weekly copies.
   */
  schedule(): void {
    if (Date.now() > this.#lastBackupDate.getTime() + AUTO_BACKUP_TIMEOUT) {
      this.#createPeriodicBackup();
    }
  }

  /**
   * Copies a backup file to `targetPath` if that file is older than `dateToCheck`.
   * E.g. if daily.json is from a previous day, copy the current auto-backup to daily.json.
   */
  static async #copyFileIfCreatedBeforeDate(
    srcPath: string,
    targetPath: string,
    dateToCheck: Date,
  ): Promise<boolean> {
    let createBackup = false;
    try {
      const stats = await fse.stat(targetPath);
      createBackup = stats.ctime < dateToCheck;
    } catch {
      // File not found: must create backup.
      createBackup = true;
    }
    if (createBackup) {
      try {
        await fse.copyFile(srcPath, targetPath);
        console.log('Created backup', targetPath);
        return true;
      } catch (e) {
        console.error('Could not create backup', targetPath, e);
      }
    }
    return false;
  }

  /**
   * Debounced function that creates an auto-backup file.
   * It writes a file named `auto-backup-<index>.json` and makes daily and weekly copies.
   */
  #createPeriodicBackup = debounce(async (): Promise<void> => {
    const filePath = path.join(this.#backupDirectory, `auto-backup-${this.#lastBackupIndex}.json`);

    this.#lastBackupDate = new Date();
    this.#lastBackupIndex = (this.#lastBackupIndex + 1) % NUM_AUTO_BACKUPS;

    try {
      await this.backupToFile(filePath);
      console.log('Created automatic backup', filePath);

      // Check for daily backup
      await BackupScheduler.#copyFileIfCreatedBeforeDate(
        filePath,
        path.join(this.#backupDirectory, 'daily.json'),
        getToday(),
      );

      // Check for weekly backup
      await BackupScheduler.#copyFileIfCreatedBeforeDate(
        filePath,
        path.join(this.#backupDirectory, 'weekly.json'),
        getWeekStart(),
      );
    } catch (e) {
      console.error('Could not create periodic backup', filePath, e);
    }
  }, 10000);

  /**
   * **Auto Dump Functionality:**
   * Starts an interval that dumps the entire Y.Doc state to a file named "database.db"
   * every 10 seconds. The file is overwritten on each dump.
   */
  #startAutoDump(): void {
    const dumpFilePath = path.join(this.#backupDirectory, 'database.db');
    this.#dumpInterval = setInterval(async () => {
      try {
        await this.backupToFile(dumpFilePath);
        console.log('Auto-dumped database to', dumpFilePath);
      } catch (error) {
        console.error('Error during auto dump:', error);
      }
    }, 10000); // every 10 seconds
  }

  /**
   * Stops the auto dump interval.
   */
  stopAutoDump(): void {
    if (this.#dumpInterval) {
      clearInterval(this.#dumpInterval);
      this.#dumpInterval = null;
    }
  }

  /**
   * Creates a single-file snapshot of the entire Y.Doc state.
   * The state is encoded as a Yjs update (Uint8Array) and written to disk.
   * @param filePath The destination file path.
   */
  async backupToFile(filePath: string): Promise<void> {
    console.info('Yjs: Exporting document backup to', filePath);
    const update = Y.encodeStateAsUpdate(this.#ydoc);
    await fse.ensureFile(filePath);
    await fse.writeFile(filePath, Buffer.from(update));
  }

  /**
   * Restores the Y.Doc from a backup file.
   *
   * This method performs a full overwrite by first clearing the persistent y-indexeddb storage,
   * then creating a new Y.Doc, applying the backup update, and reinitializing the y-indexeddb provider.
   * Finally, the application is reloaded so that all components reinitialize with the restored state.
   * @param filePath The backup file to restore from.
   */
  async restoreFromFile(filePath: string): Promise<void> {
    console.info('Yjs: Importing document backup from', filePath);
    const buffer = await fse.readFile(filePath);
    const update = new Uint8Array(buffer);

    // Clear the persistent y-indexeddb storage BEFORE applying the backup update.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase('OneFolderYjs');
      req.onsuccess = () => {
        console.log('Cleared y-indexeddb database: OneFolderYjs');
        resolve();
      };
      req.onerror = (e) => reject(e);
      req.onblocked = () => console.warn('Deletion of OneFolderYjs is blocked');
    });

    // Destroy the current Y.Doc and create a new one.
    this.#ydoc.destroy();
    this.#ydoc = new Y.Doc();

    // Apply the backup update to the new document.
    Y.applyUpdate(this.#ydoc, update);

    // Reinitialize the y-indexeddb provider for the new Y.Doc.
    const { IndexeddbPersistence } = await import('y-indexeddb');
    const persistence = new IndexeddbPersistence('OneFolderYjs', this.#ydoc);

    // Wait for the persistence provider to finish syncing before reloading.
    persistence.once('synced', () => {
      console.log('y-indexeddb persistence initialized with restored data.');
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    });
  }

  /**
   * Mimics Dexie's "peekFile" by creating a temporary Y.Doc,
   * applying the backup update, and returning the counts of tags and files.
   * @param filePath The backup file to peek into.
   */
  async peekFile(filePath: string): Promise<[numTags: number, numFiles: number]> {
    console.info('Yjs: Peeking document backup from', filePath);
    const buffer = await fse.readFile(filePath);
    const update = new Uint8Array(buffer);

    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, update);

    // Assuming all persisted data is stored in the following top-level maps:
    // "tags", "files", "locations", and "searches".
    const tagsMap = tempDoc.getMap('tags');
    const filesMap = tempDoc.getMap('files');

    return [tagsMap.size, filesMap.size];
  }
}
