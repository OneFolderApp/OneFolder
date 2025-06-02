import Dexie, { Transaction } from 'dexie';
import fse from 'fs-extra';

import { FileDTO } from '../api/file';
import { TagDTO } from 'src/api/tag';
import { ID } from '../api/id';
import { ExtraProperties, ExtraPropertyType } from 'src/api/extraProperty';

// The name of the IndexedDB
export const DB_NAME = 'Allusion';

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
    version: 9,
    collections: [
      {
        name: 'tags',
        schema: '++id',
      },
    ],
    upgrade: (tx: Transaction): void => {
      tx.table('tags')
        .toCollection()
        .modify((tag: TagDTO) => {
          tag.impliedTags = [];
          return tag;
        });
    },
  },
  {
    // Version 10, 6-3-25: Added scores and .scores to file
    version: 10,
    collections: [
      {
        name: 'scores',
        schema: '++id, name, dateCreated, dateModified',
      },
      {
        name: 'files',
        schema:
          '++id, ino, locationId, *tags, scores, relativePath, &absolutePath, name, extension, size, width, height, dateAdded, dateModified, dateCreated',
      },
    ],
    upgrade: (tx: Transaction): void => {
      tx.table('files')
        .toCollection()
        .modify((file: any) => {
          file.scores = new Map<ID, number>();
          return file;
        });
    },
  },
  {
    // Version 11, Added OrigDateModified date to File for recreating thumbnails and metadata
    version: 11,
    collections: [],
    upgrade: (tx: Transaction): void => {
      tx.table('files')
        .toCollection()
        .modify((file: FileDTO) => {
          file.OrigDateModified = file.dateAdded;
          return file;
        });
    },
  },
  {
    // Version 12 29-5-25: Rename table Scores to extraProperties, redefine scores in files to extraProperties, add skipInherit: bool to tags and add tags to locations.
    version: 12,
    collections: [
      {
        name: 'extraProperties',
        schema: '++id, name',
      },
      {
        name: 'files',
        schema:
          '++id, ino, locationId, *tags, *extraPropertyIDs, relativePath, &absolutePath, name, extension, size, width, height, dateAdded, dateModified, dateCreated, OrigDateModified',
      },
    ],
    upgrade: (tx: Transaction): void => {
      // Migrate "scores" to "extraProperties"
      const oldScores = tx.table('scores');
      const extraProperties = tx.table('extraProperties');

      oldScores.toArray().then((records) => {
        const transformed = records.map((oldRecord: any) => {
          return {
            ...oldRecord,
            type: ExtraPropertyType.number,
            dateAdded: oldRecord.dateCreated,
            dateCreated: undefined,
            dateModified: undefined,
          };
        });
        const cleaned = transformed.map((r) => {
          delete r.dateCreated;
          delete r.dateModified;
          return r;
        });

        return extraProperties.bulkAdd(cleaned);
      });

      // Migrate property "scores" in files to "extraProperties"
      tx.table('files')
        .toCollection()
        .modify((file: any) => {
          if (file.scores instanceof Map) {
            file.extraPropertyIDs = Array.from(file.scores.keys());
            file.extraProperties = Object.fromEntries(file.scores) as ExtraProperties;
          } else {
            file.extraPropertyIDs = [];
            file.extraProperties = {};
          }
          delete file.scores;
          return file;
        });

      // Add skipInherit to tags
      tx.table('tags')
        .toCollection()
        .modify((tag: any) => {
          tag.skipInherit = false;
          return tag;
        });

      // Add campo tags to locations
      tx.table('locations')
        .toCollection()
        .modify((location: any) => {
          location.tags = [];
          return location;
        });
    },
  },
  {
    // Version 12 29-5-25: Drop table scores
    version: 13,
    collections: [
      {
        name: 'scores',
        schema: null,
      },
    ],
  },
];

type DBVersioningConfig = {
  version: number;
  collections: Array<{ name: string; schema: string | null }>;
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
    const dbSchema: { [key: string]: string | null } = {};
    collections.forEach(({ name, schema }) => (dbSchema[name] = schema));
    const stores = db.version(version).stores(dbSchema);
    if (upgrade) {
      stores.upgrade(upgrade);
    }
  }

  return db;
}
