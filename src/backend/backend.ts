import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

import { DataStorage } from '../api/data-storage';
import {
  ConditionDTO,
  OrderBy,
  OrderDirection,
  ArrayConditionDTO,
  DateConditionDTO,
  NumberConditionDTO,
  StringConditionDTO,
} from '../api/data-storage-search';
import { FileDTO } from '../api/file';
import { FileSearchDTO } from '../api/file-search';
import { ID } from '../api/id';
import { LocationDTO } from '../api/location';
import { ROOT_TAG_ID, TagDTO } from '../api/tag';

import { retainArray, shuffleArray } from '../../common/core';

export default class Backend implements DataStorage {
  #ydoc: Y.Doc;
  #provider: IndexeddbPersistence;
  #notifyChange: () => void;

  // Yjs Maps
  #files: Y.Map<FileDTO>;
  #tags: Y.Map<TagDTO>;
  #locations: Y.Map<LocationDTO>;
  #searches: Y.Map<FileSearchDTO>;

  /**
   * @param ydoc The shared Y.Doc instance.
   * @param notifyChange Callback for scheduling backups or reacting to data changes.
   * @param dbName The name for the y-indexeddb database. Make sure it doesn't clash with Dexie (e.g. "OneFolderYjs").
   */
  constructor(ydoc: Y.Doc, notifyChange: () => void, dbName: string = 'OneFolderYjs') {
    this.#notifyChange = notifyChange;
    this.#ydoc = ydoc;

    // Use a distinct DB name to avoid collisions with the old Dexie-based DB:
    this.#provider = new IndexeddbPersistence(dbName, this.#ydoc);

    // Initialize references to each table
    this.#files = this.#ydoc.getMap<FileDTO>('files');
    this.#tags = this.#ydoc.getMap<TagDTO>('tags');
    this.#locations = this.#ydoc.getMap<LocationDTO>('locations');
    this.#searches = this.#ydoc.getMap<FileSearchDTO>('searches');

    this.#provider.on('synced', () => {
      console.log(`Yjs: content from IndexedDB ("${dbName}") is loaded!`);
    });
  }

  static async init(ydoc: Y.Doc, notifyChange: () => void, dbName?: string): Promise<Backend> {
    const backend = new Backend(ydoc, notifyChange, dbName);
    await backend.#provider.whenSynced;

    // Ensure root tag
    if (!backend.#tags.has(ROOT_TAG_ID)) {
      backend.#tags.set(ROOT_TAG_ID, {
        id: ROOT_TAG_ID,
        name: 'Root',
        dateAdded: new Date(),
        subTags: [],
        color: '',
        isHidden: false,
      });
    }

    return backend;
  }

  //////////////////////////////////
  //////////  FETCH METHODS  ////////
  //////////////////////////////////

  async fetchTags(): Promise<TagDTO[]> {
    console.info('Yjs: Fetching tags...');
    const all = Array.from(this.#tags.values());
    const rehydrated = all.map((tag) => fixTagDates(tag));
    return rehydrated;
  }

  async fetchFiles(order: OrderBy<FileDTO>, fileOrder: OrderDirection): Promise<FileDTO[]> {
    console.info('Yjs: Fetching files...');
    let all = Array.from(this.#files.values()).map(fixFileDates);

    if (order === 'random') {
      return shuffleArray(all);
    }

    all.sort((a, b) => {
      const valA = a[order] as any;
      const valB = b[order] as any;
      return valA < valB ? -1 : valA > valB ? 1 : 0;
    });

    if (fileOrder === OrderDirection.Desc) {
      all.reverse();
    }
    return all;
  }

  async fetchFilesByID(ids: ID[]): Promise<FileDTO[]> {
    console.info('Yjs: Fetching files by ID...');
    const result: FileDTO[] = [];
    for (const id of ids) {
      const f = this.#files.get(id);
      if (f) result.push(fixFileDates(f));
    }
    return result;
  }

  async fetchFilesByKey(key: keyof FileDTO, value: any): Promise<FileDTO[]> {
    console.info('Yjs: Fetching files by key/value...', { key, value });
    const all = Array.from(this.#files.values());
    return all.filter((file) => file[key] === value).map(fixFileDates);
  }

  async fetchLocations(): Promise<LocationDTO[]> {
    console.info('Yjs: Fetching locations...');
    let all = Array.from(this.#locations.values()).map(fixLocationDates);
    all.sort((a, b) => a.dateAdded.getTime() - b.dateAdded.getTime());
    return all;
  }

  async fetchSearches(): Promise<FileSearchDTO[]> {
    console.info('Yjs: Fetching searches...');
    return Array.from(this.#searches.values());
  }

  async searchFiles(
    criteria: ConditionDTO<FileDTO> | [ConditionDTO<FileDTO>, ...ConditionDTO<FileDTO>[]],
    order: OrderBy<FileDTO>,
    fileOrder: OrderDirection,
    matchAny?: boolean,
  ): Promise<FileDTO[]> {
    console.info('Yjs: Searching files...', { criteria, matchAny });
    const all = Array.from(this.#files.values()).map(fixFileDates);
    const criterias = Array.isArray(criteria) ? criteria : [criteria];

    let result: FileDTO[];
    if (matchAny) {
      // OR
      result = all.filter((item) => criterias.some((crit) => filterLambda(crit)(item)));
    } else {
      // AND
      result = all.filter((item) => criterias.every((crit) => filterLambda(crit)(item)));
    }

    if (order === 'random') {
      return shuffleArray(result);
    }

    result.sort((a, b) => {
      const valA = a[order] as any;
      const valB = b[order] as any;
      if (valA === valB) return 0;
      return valA < valB ? -1 : 1;
    });
    if (fileOrder === OrderDirection.Desc) {
      result.reverse();
    }
    return result;
  }

  //////////////////////////////////
  //////////  CREATE  //////////////
  //////////////////////////////////

  async createTag(tag: TagDTO): Promise<void> {
    console.info('Yjs: Creating tag...', tag);
    this.#tags.set(tag.id, fixTagDates(tag));
    this.#notifyChange();
  }

  async createFilesFromPath(path: string, files: FileDTO[]): Promise<void> {
    console.info('Yjs: Creating files from path...', path, files);
    for (const f of files) {
      if (!this.#files.has(f.id)) {
        this.#files.set(f.id, fixFileDates(f));
      }
    }
    this.#notifyChange();
  }

  async createLocation(location: LocationDTO): Promise<void> {
    console.info('Yjs: Creating location...', location);
    this.#locations.set(location.id, fixLocationDates(location));
    this.#notifyChange();
  }

  async createSearch(search: FileSearchDTO): Promise<void> {
    console.info('Yjs: Creating search...', search);
    this.#searches.set(search.id, search);
    this.#notifyChange();
  }

  //////////////////////////////////
  ///////////  UPDATE  /////////////
  //////////////////////////////////

  async saveTag(tag: TagDTO): Promise<void> {
    console.info('Yjs: Saving tag...', tag);
    this.#tags.set(tag.id, fixTagDates(tag));
    this.#notifyChange();
  }

  async saveFiles(files: FileDTO[]): Promise<void> {
    console.info('Yjs: Saving files...', files);
    for (const file of files) {
      this.#files.set(file.id, fixFileDates(file));
    }
    this.#notifyChange();
  }

  async saveLocation(location: LocationDTO): Promise<void> {
    console.info('Yjs: Saving location...', location);
    this.#locations.set(location.id, fixLocationDates(location));
    this.#notifyChange();
  }

  async saveSearch(search: FileSearchDTO): Promise<void> {
    console.info('Yjs: Saving search...', search);
    this.#searches.set(search.id, search);
    this.#notifyChange();
  }

  //////////////////////////////////
  ///////////  DELETE  /////////////
  //////////////////////////////////

  async removeTags(tags: ID[]): Promise<void> {
    console.info('Yjs: Removing tags...', tags);
    const filesArr = Array.from(this.#files.values());
    for (const file of filesArr) {
      const newTags = file.tags.filter((t) => !tags.includes(t));
      if (newTags.length !== file.tags.length) {
        this.#files.set(file.id, { ...file, tags: newTags });
      }
    }
    for (const tagId of tags) {
      this.#tags.delete(tagId);
    }
    this.#notifyChange();
  }

  async mergeTags(tagToBeRemoved: ID, tagToMergeWith: ID): Promise<void> {
    console.info('Yjs: Merging tags...', tagToBeRemoved, tagToMergeWith);
    const filesArr = Array.from(this.#files.values());
    for (const file of filesArr) {
      if (file.tags.includes(tagToBeRemoved)) {
        const newTags = file.tags.map((t) => (t === tagToBeRemoved ? tagToMergeWith : t));
        const unique = Array.from(new Set(newTags));
        this.#files.set(file.id, { ...file, tags: unique });
      }
    }
    this.#tags.delete(tagToBeRemoved);
    this.#notifyChange();
  }

  async removeFiles(files: ID[]): Promise<void> {
    console.info('Yjs: Removing files...', files);
    for (const fid of files) {
      this.#files.delete(fid);
    }
    this.#notifyChange();
  }

  async removeLocation(location: ID): Promise<void> {
    console.info('Yjs: Removing location...', location);
    const filesArr = Array.from(this.#files.values());
    for (const f of filesArr) {
      if (f.locationId === location) {
        this.#files.delete(f.id);
      }
    }
    this.#locations.delete(location);
    this.#notifyChange();
  }

  async removeSearch(search: ID): Promise<void> {
    console.info('Yjs: Removing search...', search);
    this.#searches.delete(search);
    this.#notifyChange();
  }

  //////////////////////////////////
  ///////////  UTILITIES  //////////
  //////////////////////////////////

  async countFiles(): Promise<[fileCount: number, untaggedFileCount: number]> {
    console.info('Yjs: Counting files...');
    const all = Array.from(this.#files.values());
    const fileCount = all.length;
    let taggedCount = 0;
    for (const f of all) {
      if (f.tags && f.tags.length > 0) {
        taggedCount++;
      }
    }
    return [fileCount, fileCount - taggedCount];
  }

  async clear(): Promise<void> {
    console.info('Yjs: Clearing entire doc from local storage...');
    await this.#provider.clearData();
    this.#ydoc.destroy();
  }
}

/**
 * Rehydrate date fields on a FileDTO.
 */
function fixFileDates(file: FileDTO): FileDTO {
  return {
    ...file,
    dateAdded: toDate(file.dateAdded),
    dateModified: toDate(file.dateModified),
    dateLastIndexed: toDate(file.dateLastIndexed),
    dateCreated: toDate(file.dateCreated),
  };
}

/** Rehydrate date fields on a TagDTO */
function fixTagDates(tag: TagDTO): TagDTO {
  return {
    ...tag,
    dateAdded: toDate(tag.dateAdded),
  };
}

/** Rehydrate date fields on a LocationDTO */
function fixLocationDates(loc: LocationDTO): LocationDTO {
  return {
    ...loc,
    dateAdded: toDate(loc.dateAdded),
  };
}

/** Convert something to a Date object if it's not already. */
function toDate(val: any): Date {
  if (val instanceof Date) return val;
  try {
    return new Date(val);
  } catch {
    return new Date();
  }
}

///////////////////////////////////
// The same "filter-lambda" logic
///////////////////////////////////
function filterLambda<T>(crit: ConditionDTO<T>): (val: T) => boolean {
  switch (crit.valueType) {
    case 'array':
      return filterArrayLambda(crit as ArrayConditionDTO<T, any>);
    case 'string':
      return filterStringLambda(crit as StringConditionDTO<T>);
    case 'number':
      return filterNumberLambda(crit as NumberConditionDTO<T>);
    case 'date':
      return filterDateLambda(crit as DateConditionDTO<T>);
  }
}

function filterArrayLambda<T>(crit: ArrayConditionDTO<T, any>): (val: T) => boolean {
  if (crit.operator === 'contains') {
    return crit.value.length === 0
      ? (val: T) => (val as any)[crit.key].length === 0
      : (val: T) => {
          const arr = (val as any)[crit.key] as any[];
          return arr.some((item) => crit.value.includes(item));
        };
  } else {
    // 'notContains'
    return crit.value.length === 0
      ? (val: T) => (val as any)[crit.key].length !== 0
      : (val: T) => {
          const arr = (val as any)[crit.key] as any[];
          return arr.every((item) => !crit.value.includes(item));
        };
  }
}

function filterStringLambda<T>(crit: StringConditionDTO<T>): (t: T) => boolean {
  const { key, value, operator } = crit;
  const valLow = value.toLowerCase();
  return (obj: T) => {
    const fieldVal = (obj as any)[key] as string;
    const fieldValLower = fieldVal.toLowerCase();
    switch (operator) {
      case 'equals':
      case 'equalsIgnoreCase':
        return fieldValLower === valLow;
      case 'notEqual':
        return fieldValLower !== valLow;
      case 'contains':
        return fieldValLower.includes(valLow);
      case 'notContains':
        return !fieldValLower.includes(valLow);
      case 'startsWith':
      case 'startsWithIgnoreCase':
        return fieldValLower.startsWith(valLow);
      case 'notStartsWith':
        return !fieldValLower.startsWith(valLow);
      default:
        console.warn('Unsupported string operator:', operator);
        return false;
    }
  };
}

function filterNumberLambda<T>(crit: NumberConditionDTO<T>): (t: T) => boolean {
  const { key, value, operator } = crit;
  return (obj: T) => {
    const fieldVal = (obj as any)[key] as number;
    switch (operator) {
      case 'equals':
        return fieldVal === value;
      case 'notEqual':
        return fieldVal !== value;
      case 'smallerThan':
        return fieldVal < value;
      case 'smallerThanOrEquals':
        return fieldVal <= value;
      case 'greaterThan':
        return fieldVal > value;
      case 'greaterThanOrEquals':
        return fieldVal >= value;
      default:
        return false;
    }
  };
}

function filterDateLambda<T>(crit: DateConditionDTO<T>): (t: T) => boolean {
  const { key, operator } = crit;
  const start = new Date(crit.value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(crit.value);
  end.setHours(23, 59, 59, 999);
  return (obj: T) => {
    const fieldVal = (obj as any)[key] as Date;
    if (!(fieldVal instanceof Date)) return false;
    switch (operator) {
      case 'equals':
        return fieldVal >= start && fieldVal <= end;
      case 'notEqual':
        return fieldVal < start || fieldVal > end;
      case 'smallerThan':
        return fieldVal < start;
      case 'smallerThanOrEquals':
        return fieldVal <= end;
      case 'greaterThan':
        return fieldVal > end;
      case 'greaterThanOrEquals':
        return fieldVal >= start;
      default:
        return false;
    }
  };
}
