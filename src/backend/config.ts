import Dexie, { Transaction } from 'dexie';
import fse from 'fs-extra';

import { FileDTO } from '../api/file';

// The name of the IndexedDB
export const DB_NAME = 'OneFolder';

export const NUM_AUTO_BACKUPS = 6;

export const AUTO_BACKUP_TIMEOUT = 1000 * 60 * 10; // 10 minutes

// Schema based on https://dexie.org/docs/Version/Version.stores()#schema-syntax
// Only for the indexes of the DB, not all fields
// Versions help with upgrading DB to new configurations:
// https://dexie.org/docs/Tutorial/Design#database-versioning
const dbConfig: DBVersioningConfig[] = [
  {
    // Version 4, 19-9-20: Added system created date
    version: 4,
    collections: [
      {
        name: 'files',
        schema:
          '++id, locationId, *tags, relativePath, &absolutePath, name, extension, size, width, height, dateAdded, dateModified, dateCreated',
      },
      {
        name: 'tags',
        schema: '++id',
      },
      {
        name: 'locations',
        schema: '++id, dateAdded',
      },
    ],
  },
  {
    // Version 5, 29-5-21: Added sub-locations
    version: 5,
    collections: [],
    upgrade: (tx: Transaction): void => {
      tx.table('locations')
        .toCollection()
        .modify((location: any) => {
          location.subLocations = [];
          return location;
        });
    },
  },
  {
    // Version 6, 13-11-21: Added lastIndexed date to File for recreating thumbnails
    version: 6,
    collections: [],
    upgrade: (tx: Transaction): void => {
      tx.table('files')
        .toCollection()
        .modify((file: FileDTO) => {
          file.dateLastIndexed = file.dateAdded;
          return file;
        });
    },
  },
  {
    // Version 7, 4-1-22: Added saved searches
    version: 7,
    collections: [
      {
        name: 'searches',
        schema: '++id',
      },
    ],
  },
  {
    // Version 8, 9-1-22: Added ino to file for detecting added/removed files as a single rename/move event
    version: 8,
    collections: [
      {
        name: 'files',
        schema:
          '++id, ino, locationId, *tags, relativePath, &absolutePath, name, extension, size, width, height, dateAdded, dateModified, dateCreated',
      },
    ],
    upgrade: (tx: Transaction): void => {
      tx.table('files')
        .toCollection()
        .modify((file: FileDTO) => {
          try {
            // apparently you can't do async stuff here, even though it is typed to return a PromiseLike :/
            const stats = fse.statSync(file.absolutePath);
            // fallback to random value so that it won't be recognized as identical file to others where no ino could be found
            file.ino = stats.ino.toString() || Math.random().toString();
          } catch (e) {
            console.warn(`Could not get ino for ${file.absolutePath}`);
          }
          return file;
        });
    },
  },
  {
    // Version 9, 9-12-23 Added annotations for face detections (WIP)
    version: 9,
    collections: [
      {
        name: 'files',
        schema:
          '++id, locationId, *tags, relativePath, &absolutePath, name, extension, size, width, height, dateAdded, dateModified, dateCreated, annotations',
      },
    ],
    upgrade: (tx: Transaction): void => {
      tx.table('files')
        .toCollection()
        .modify((file: FileDTO) => {
          file.annotations = '{}';
          return file;
        });
    },
  },
  {
    // Version 10, 28-6-24 Added 'ino' back because we removed it by mistake in Version 9
    version: 10,
    collections: [
      {
        name: 'files',
        schema:
          '++id, ino, locationId, *tags, relativePath, &absolutePath, name, extension, size, width, height, dateAdded, dateModified, dateCreated, annotations',
      },
    ],
    upgrade: (tx: Transaction): void => {
      tx.table('files')
        .toCollection()
        .modify((file: FileDTO) => {
          try {
            // apparently you can't do async stuff here, even though it is typed to return a PromiseLike :/
            const stats = fse.statSync(file.absolutePath);
            // fallback to random value so that it won't be recognized as identical file to others where no ino could be found
            file.ino = stats.ino.toString() || Math.random().toString();
          } catch (e) {
            console.warn(`Could not get ino for ${file.absolutePath}`);
          }
          return file;
        });
    },
  },
  {
    // Version 11, Dismissed Duplicate Groups - Store dismissed duplicate group hashes
    version: 11,
    collections: [
      {
        name: 'dismissedDuplicateGroups',
        schema: '++id, &groupHash, algorithm, fileIds, dismissedAt, userNote',
      },
    ],
  },
];

type DBVersioningConfig = {
  version: number;
  collections: Array<{ name: string; schema: string }>;
  upgrade?: (tx: Transaction) => void | Promise<void>;
};

/**
 * A function that should be called before using the database.
 * It initializes the object stores
 */
export function dbInit(dbName: string): Dexie {
  const db = new Dexie(dbName);

  // Initialize for each DB version: https://dexie.org/docs/Tutorial/Design#database-versioning
  for (const config of dbConfig) {
    const { version, collections, upgrade } = config;
    const dbSchema: { [key: string]: string } = {};
    collections.forEach(({ name, schema }) => (dbSchema[name] = schema));
    const stores = db.version(version).stores(dbSchema);
    if (upgrade) {
      stores.upgrade(upgrade);
    }
  }

  return db;
}
