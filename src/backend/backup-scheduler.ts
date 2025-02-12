/**
 * BackupScheduler for Yjs that creates full snapshots of the Y.Doc state and supports full-overwrite restoration.
 *
 * When restoring from backup, the persistent storage (y-indexeddb) is cleared, a new Y.Doc is created,
 * the backup update is applied to it, and the y-indexeddb provider is reinitialized.
 * Finally, the application reloads so that all components reinitialize using the new document.
 *
 * This approach mimics the Dexie behavior:
 *   1. Delete the persistent database.
 *   2. Create a new document.
 *   3. Import the backup update.
 *   4. Reinitialize the persistence provider so the new state is saved.
 *   5. Reload the application.
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
  #lastBackupIndex: number = 0;
  #lastBackupDate: Date = new Date(0);

  /**
   * @param ydoc The Y.Doc that holds all data (files, tags, locations, searches, etc).
   * @param directory The folder path where backup files are stored.
   */
  constructor(ydoc: Y.Doc, directory: string) {
    this.#ydoc = ydoc;
    this.#backupDirectory = directory;
  }

  static async init(ydoc: Y.Doc, backupDirectory: string): Promise<BackupScheduler> {
    await fse.ensureDir(backupDirectory);
    return new BackupScheduler(ydoc, backupDirectory);
  }

  /**
   * Updates the backup directory to a new path.
   * This is useful for setting the backup directory based on a user-defined location.
   * @param newDir The new backup directory path.
   */
  async updateBackupDirectory(newDir: string): Promise<void> {
    this.#backupDirectory = newDir;
    await fse.ensureDir(newDir);
    console.log('BackupScheduler: Updated backup directory to', newDir);
  }

  /**
   * Returns the current backup directory.
   */
  getBackupDirectory(): string {
    return this.#backupDirectory;
  }

  /**
   * Called whenever there's a data change that might merit an auto-backup.
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

  // Wait 10 seconds after a change for any other changes before creating a backup.
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
   * Creates a single-file snapshot of the entire Y.Doc state.
   * The state is encoded as a Yjs update (Uint8Array) and written to disk.
   */
  async backupToFile(filePath: string): Promise<void> {
    console.info('Yjs: Exporting document backup...', filePath);
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
   */
  async restoreFromFile(filePath: string): Promise<void> {
    console.info('Yjs: Importing document backup...', filePath);
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
   */
  async peekFile(filePath: string): Promise<[numTags: number, numFiles: number]> {
    console.info('Yjs: Peeking document backup...', filePath);
    const buffer = await fse.readFile(filePath);
    const update = new Uint8Array(buffer);

    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, update);

    // Assuming all persisted data is stored in the following top-level maps:
    // "tags", "files", "locations", and "searches". If additional maps are used, add them as needed.
    const tagsMap = tempDoc.getMap('tags');
    const filesMap = tempDoc.getMap('files');

    return [tagsMap.size, filesMap.size];
  }
}
