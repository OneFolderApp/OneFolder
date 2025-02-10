/**
 * Example prototype of how you might replace Dexie-based backups with Yjs-based backups.
 * Instead of using `dexie-export-import`, we simply encode & decode the entire Y.Doc state
 * using Yjs' update API. Then we write/read that from the filesystem (e.g. as a binary file).
 *
 * We keep the same scheduling logic (auto-backups, daily/weekly copies) as before. The only
 * real difference is how `backupToFile()` and `restoreFromFile()` (and `peekFile()`) work.
 *
 * IMPORTANT: This assumes you have one "global" Y.Doc with all data (files, tags, etc.).
 * You'll need to pass that Y.Doc in the constructor. Then we encodeStateAsUpdate() for backup
 * and applyUpdate() to restore. The "peek" function loads the backup into a temporary doc
 * to count how many files & tags it contains. This mirrors the old Dexie logic for counting rows.
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

/**
 * A BackupScheduler that creates full "snapshots" of the Y.Doc state on a regular schedule.
 * Then it writes those snapshots to a file. We can also restore from these snapshots, or
 * peek how many files/tags are in the backup without fully overwriting our existing doc.
 */
export default class BackupScheduler implements DataBackup {
  #ydoc: Y.Doc;
  #backupDirectory: string;
  #lastBackupIndex: number = 0;
  #lastBackupDate: Date = new Date(0);

  /**
   * @param ydoc The Y.Doc that holds all data (files, tags, locations, etc).
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
   * Called whenever there's a data change that might merit an auto-backup.
   * We check if enough time has passed since the last backup, then schedule it.
   */
  schedule(): void {
    if (Date.now() > this.#lastBackupDate.getTime() + AUTO_BACKUP_TIMEOUT) {
      this.#createPeriodicBackup();
    }
  }

  /**
   * Copies a backup file to `targetPath` if that file is older than `dateToCheck`.
   * E.g. if daily.json is from yesterday, we copy the newly created auto-backup to daily.json.
   */
  static async #copyFileIfCreatedBeforeDate(
    srcPath: string,
    targetPath: string,
    dateToCheck: Date,
  ): Promise<boolean> {
    let createBackup = false;
    try {
      // If file creation date is less than provided date, create a back-up
      const stats = await fse.stat(targetPath);
      createBackup = stats.ctime < dateToCheck;
    } catch {
      // File not found
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
   * Creates a single-file snapshot of the entire Y.Doc in its current state.
   * We encode the doc as a Yjs update (Uint8Array), then store that as raw binary
   * to disk. Here, we store it as a JSON file for demonstration, but it’s actually
   * a binary content. You could rename it to .bin if you like.
   */
  async backupToFile(filePath: string): Promise<void> {
    console.info('Yjs: Exporting document backup...', filePath);

    // 1. Encode entire doc state as a single "update" (snapshot).
    const update = Y.encodeStateAsUpdate(this.#ydoc);

    // 2. Ensure the file exists, then write. We'll store it as raw binary,
    //    but let's keep a .json extension for consistency with your original code.
    //    In Node, you can do:
    await fse.ensureFile(filePath);
    await fse.writeFile(filePath, Buffer.from(update));
  }

  /**
   * Restores the doc from a previously saved snapshot.
   * We read the file as raw binary, then apply it to our existing doc.
   * If you intend to fully overwrite local changes, you may want to
   * create a new doc. But typically you can simply "applyUpdate" to merge it in.
   */
  async restoreFromFile(filePath: string): Promise<void> {
    console.info('Yjs: Importing document backup...', filePath);

    const buffer = await fse.readFile(filePath);
    const update = new Uint8Array(buffer);

    // Option A: If you want a fresh doc, you'd do:
    //   this.#ydoc.destroy()
    //   this.#ydoc = new Y.Doc()
    //   Y.applyUpdate(this.#ydoc, update)
    // Option B: Merge the backup state into your current doc:
    Y.applyUpdate(this.#ydoc, update);
  }

  /**
   * We replicate Dexie's "peekFile" concept by creating a temporary doc,
   * applying the snapshot from disk, then counting how many tags/files it contains.
   */
  async peekFile(filePath: string): Promise<[numTags: number, numFiles: number]> {
    console.info('Yjs: Peeking document backup...', filePath);

    const buffer = await fse.readFile(filePath);
    const update = new Uint8Array(buffer);

    // 1. Create a temp doc and apply the update
    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, update);

    // 2. In our new Y-based architecture, we store:
    //    - tags in tempDoc.getMap<TagDTO>('tags')
    //    - files in tempDoc.getMap<FileDTO>('files')
    // So we simply read their sizes. If either map is empty, the doc has none.
    const tagsMap = tempDoc.getMap('tags');
    const filesMap = tempDoc.getMap('files');

    const numTags = tagsMap.size;
    const numFiles = filesMap.size;

    return [numTags, numFiles];
  }
}
