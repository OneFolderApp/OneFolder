
/**
 * Example prototype of how you might replace Dexie with Yjs + y-indexeddb,
 * just so it "works" locally and persists in IndexedDB. This is NOT a final,
 * production-ready approach. It shows the rough idea of storing all records
 * in Yjs maps and doing searches in-memory. You lose Dexie’s indexing and
 * advanced queries. For large data, performance might suffer significantly!
 *
 * The rest of your code (e.g. React MobX stores) should remain mostly
 * unchanged if you keep the same DataStorage interface. That said,
 * there's a fair amount of manual rewriting in this file:
 *   - We replaced Dexie calls with simple Yjs Map operations.
 *   - We do searching in-memory by filtering arrays of objects from Yjs.
 *   - We replicate the same ConditionDTO logic as naive JavaScript filters.
 *
 * In reality, you'll also want to handle CRDT sync in your .onefolder folder,
 * but this file focuses on local usage only (i.e. no CRDT merges from other files yet).
 */

import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'

import { DataStorage } from '../api/data-storage'
import {
  ConditionDTO,
  OrderBy,
  OrderDirection,
  ArrayConditionDTO,
  DateConditionDTO,
  NumberConditionDTO,
  StringConditionDTO
} from '../api/data-storage-search'
import { FileDTO } from '../api/file'
import { FileSearchDTO } from '../api/file-search'
import { ID } from '../api/id'
import { LocationDTO } from '../api/location'
import { ROOT_TAG_ID, TagDTO } from '../api/tag'

import { retainArray, shuffleArray } from '../../common/core'

// Reuse the same local filter code as Dexie, but adapted to in-memory arrays:
type SearchConjunction = 'and' | 'or'

export default class Backend implements DataStorage {
  // Instead of Dexie, we have:
  #ydoc: Y.Doc
  #provider: IndexeddbPersistence
  #notifyChange: () => void

  // We'll store each "table" as a Y.Map<ID, Entity>.
  // E.g. #files has shape: { [fileId]: FileDTO, ... }
  #files: Y.Map<FileDTO>
  #tags: Y.Map<TagDTO>
  #locations: Y.Map<LocationDTO>
  #searches: Y.Map<FileSearchDTO>

  /**
   * The constructor sets up the Y.Doc and y-indexeddb provider.
   * The provider asynchronously loads data from IndexedDB into #ydoc.
   */
  constructor(docName: string, notifyChange: () => void) {
    console.info(`Yjs + IndexedDB: Initializing doc "${docName}"...`)

    this.#notifyChange = notifyChange

    // Y.Doc holds all CRDT data in memory
    this.#ydoc = new Y.Doc()

    // This provider persists the docName in local IndexedDB
    this.#provider = new IndexeddbPersistence(docName, this.#ydoc)

    // Each "table" is a Y.Map. The keys are the record IDs, the values are the record objects.
    this.#files = this.#ydoc.getMap<FileDTO>('files')
    this.#tags = this.#ydoc.getMap<TagDTO>('tags')
    this.#locations = this.#ydoc.getMap<LocationDTO>('locations')
    this.#searches = this.#ydoc.getMap<FileSearchDTO>('searches')

    // When data is fully loaded from IndexedDB, "synced" fires:
    this.#provider.on('synced', () => {
      console.log('Yjs: content from IndexedDB is loaded!')
    })
  }

  /**
   * Similar to Dexie’s async constructor pattern; wait for the provider to load existing data.
   * Also ensure the root tag is created if missing.
   */
  static async init(docName: string, notifyChange: () => void): Promise<Backend> {
    const backend = new Backend(docName, notifyChange)

    await backend.#provider.whenSynced // Wait for existing data to load from IDB.

    // Ensure we have a root tag
    if (!backend.#tags.has(ROOT_TAG_ID)) {
      backend.#tags.set(ROOT_TAG_ID, {
        id: ROOT_TAG_ID,
        name: 'Root',
        dateAdded: new Date(),
        subTags: [],
        color: '',
        isHidden: false
      })
    }

    return backend
  }

  //////////////////////////////////
  //////////  FETCH METHODS  ////////
  //////////////////////////////////

  async fetchTags(): Promise<TagDTO[]> {
    console.info('Yjs: Fetching tags...')
    return Array.from(this.#tags.values())
  }

  async fetchFiles(order: OrderBy<FileDTO>, fileOrder: OrderDirection): Promise<FileDTO[]> {
    console.info('Yjs: Fetching files...')
    const all = Array.from(this.#files.values())

    if (order === 'random') {
      return shuffleArray(all)
    }

    // Sort by the "order" key. We'll do naive in-memory sort:
    all.sort((a, b) => {
      const valA = a[order] as any
      const valB = b[order] as any
      if (valA === valB) return 0
      return valA < valB ? -1 : 1
    })

    if (fileOrder === OrderDirection.Desc) {
      all.reverse()
    }
    return all
  }

  async fetchFilesByID(ids: ID[]): Promise<FileDTO[]> {
    console.info('Yjs: Fetching files by ID...')
    const result: FileDTO[] = []
    for (const id of ids) {
      const file = this.#files.get(id)
      if (file) {
        result.push(file)
      }
    }
    return result
  }

  async fetchFilesByKey(key: keyof FileDTO, value: any): Promise<FileDTO[]> {
    console.info('Yjs: Fetching files by key/value...', { key, value })
    return Array.from(this.#files.values()).filter((file) => file[key] === value)
  }

  async fetchLocations(): Promise<LocationDTO[]> {
    console.info('Yjs: Fetching locations...')
    return Array.from(this.#locations.values()).sort((a, b) => {
      // default: sort by dateAdded ascending
      return a.dateAdded.getTime() - b.dateAdded.getTime()
    })
  }

  async fetchSearches(): Promise<FileSearchDTO[]> {
    console.info('Yjs: Fetching searches...')
    return Array.from(this.#searches.values())
  }

  /**
   * For `searchFiles`, we just gather all files in memory and apply
   * the same filter logic we had in Dexie. Then we do naive sorting.
   */
  async searchFiles(
    criteria: ConditionDTO<FileDTO> | [ConditionDTO<FileDTO>, ...ConditionDTO<FileDTO>[]],
    order: OrderBy<FileDTO>,
    fileOrder: OrderDirection,
    matchAny?: boolean
  ): Promise<FileDTO[]> {
    console.info('Yjs: Searching files...', { criteria, matchAny })
    const all = Array.from(this.#files.values())
    const criterias = Array.isArray(criteria) ? criteria : [criteria]

    let result: FileDTO[]
    if (matchAny) {
      // OR
      // if item matches ANY of the criterias
      result = all.filter((item) =>
        criterias.some((crit) => filterLambda(crit)(item))
      )
    } else {
      // AND
      // if item matches ALL of the criterias
      result = all.filter((item) =>
        criterias.every((crit) => filterLambda(crit)(item))
      )
    }

    // Handle sort
    if (order === 'random') {
      return shuffleArray(result)
    }

    result.sort((a, b) => {
      const valA = a[order] as any
      const valB = b[order] as any
      if (valA === valB) return 0
      return valA < valB ? -1 : 1
    })
    if (fileOrder === OrderDirection.Desc) {
      result.reverse()
    }

    return result
  }

  //////////////////////////////////
  //////////  CREATE  //////////////
  //////////////////////////////////

  async createTag(tag: TagDTO): Promise<void> {
    console.info('Yjs: Creating tag...', tag)
    this.#tags.set(tag.id, tag)
    this.#notifyChange()
  }

  async createFilesFromPath(path: string, files: FileDTO[]): Promise<void> {
    console.info('Yjs: Creating files from path...', path, files)
    // We skip the "already existing" check from Dexie. For demonstration, let's do a naive approach:
    for (const f of files) {
      if (!this.#files.has(f.id)) {
        this.#files.set(f.id, f)
      }
    }
    this.#notifyChange()
  }

  async createLocation(location: LocationDTO): Promise<void> {
    console.info('Yjs: Creating location...', location)
    this.#locations.set(location.id, location)
    this.#notifyChange()
  }

  async createSearch(search: FileSearchDTO): Promise<void> {
    console.info('Yjs: Creating search...', search)
    this.#searches.set(search.id, search)
    this.#notifyChange()
  }

  //////////////////////////////////
  ///////////  UPDATE  /////////////
  //////////////////////////////////

  async saveTag(tag: TagDTO): Promise<void> {
    console.info('Yjs: Saving tag...', tag)
    this.#tags.set(tag.id, tag)
    this.#notifyChange()
  }

  async saveFiles(files: FileDTO[]): Promise<void> {
    console.info('Yjs: Saving files...', files)
    for (const file of files) {
      this.#files.set(file.id, file)
    }
    this.#notifyChange()
  }

  async saveLocation(location: LocationDTO): Promise<void> {
    console.info('Yjs: Saving location...', location)
    this.#locations.set(location.id, location)
    this.#notifyChange()
  }

  async saveSearch(search: FileSearchDTO): Promise<void> {
    console.info('Yjs: Saving search...', search)
    this.#searches.set(search.id, search)
    this.#notifyChange()
  }

  //////////////////////////////////
  ///////////  DELETE  /////////////
  //////////////////////////////////

  async removeTags(tags: ID[]): Promise<void> {
    console.info('Yjs: Removing tags...', tags)
    // Also remove them from any files referencing them:
    const filesArr = Array.from(this.#files.values())
    for (const file of filesArr) {
      const newTags = file.tags.filter((t) => !tags.includes(t))
      if (newTags.length !== file.tags.length) {
        this.#files.set(file.id, { ...file, tags: newTags })
      }
    }
    // Delete from #tags
    for (const tagId of tags) {
      this.#tags.delete(tagId)
    }
    this.#notifyChange()
  }

  async mergeTags(tagToBeRemoved: ID, tagToMergeWith: ID): Promise<void> {
    console.info('Yjs: Merging tags...', tagToBeRemoved, tagToMergeWith)
    // Update all files that have tagToBeRemoved => replace with tagToMergeWith
    const filesArr = Array.from(this.#files.values())
    for (const file of filesArr) {
      if (file.tags.includes(tagToBeRemoved)) {
        const newTags = file.tags.map((t) => t === tagToBeRemoved ? tagToMergeWith : t)
        // remove duplicates just in case
        const unique = Array.from(new Set(newTags))
        this.#files.set(file.id, { ...file, tags: unique })
      }
    }
    // Finally, remove the old tag from #tags
    this.#tags.delete(tagToBeRemoved)
    this.#notifyChange()
  }

  async removeFiles(files: ID[]): Promise<void> {
    console.info('Yjs: Removing files...', files)
    for (const fid of files) {
      this.#files.delete(fid)
    }
    this.#notifyChange()
  }

  async removeLocation(location: ID): Promise<void> {
    console.info('Yjs: Removing location...', location)
    // Also remove files associated with it
    const filesArr = Array.from(this.#files.values())
    for (const f of filesArr) {
      if (f.locationId === location) {
        this.#files.delete(f.id)
      }
    }
    this.#locations.delete(location)
    this.#notifyChange()
  }

  async removeSearch(search: ID): Promise<void> {
    console.info('Yjs: Removing search...', search)
    this.#searches.delete(search)
    this.#notifyChange()
  }

  //////////////////////////////////
  ///////////  UTILITIES  //////////
  //////////////////////////////////

  async countFiles(): Promise<[fileCount: number, untaggedFileCount: number]> {
    console.info('Yjs: Counting files...')
    const all = Array.from(this.#files.values())
    const fileCount = all.length
    // untagged means files.tags is empty
    let taggedCount = 0
    for (const f of all) {
      if (f.tags && f.tags.length > 0) {
        taggedCount++
      }
    }
    return [fileCount, fileCount - taggedCount]
  }

  async clear(): Promise<void> {
    console.info('Yjs: Clearing entire doc from local storage...')
    // If you truly want to destroy all data in IndexedDB:
    await this.#provider.clearData()
    // Now Yjs doc is empty
    this.#ydoc.destroy()
  }
}

//////////////////////////////////////////////////////////
// The same naive filter-lambda approach used in Dexie code,
// but purely in memory.
//////////////////////////////////////////////////////////

function filterLambda<T>(crit: ConditionDTO<T>): (val: T) => boolean {
  switch (crit.valueType) {
    case 'array':
      return filterArrayLambda(crit as ArrayConditionDTO<T, any>)
    case 'string':
      return filterStringLambda(crit as StringConditionDTO<T>)
    case 'number':
      return filterNumberLambda(crit as NumberConditionDTO<T>)
    case 'date':
      return filterDateLambda(crit as DateConditionDTO<T>)
  }
}

// Implementation "in-memory" versions:

function filterArrayLambda<T>(crit: ArrayConditionDTO<T, any>): (val: T) => boolean {
  if (crit.operator === 'contains') {
    // "value" is an array
    return crit.value.length === 0
      ? (val: T) => (val as any)[crit.key].length === 0
      : (val: T) => {
          const arr = (val as any)[crit.key] as any[]
          return arr.some((item) => crit.value.includes(item))
        }
  } else {
    // 'notContains'
    return crit.value.length === 0
      ? (val: T) => (val as any)[crit.key].length !== 0
      : (val: T) => {
          const arr = (val as any)[crit.key] as any[]
          return arr.every((item) => !crit.value.includes(item))
        }
  }
}

function filterStringLambda<T>(crit: StringConditionDTO<T>): (t: T) => boolean {
  const { key, value, operator } = crit
  const valLow = value.toLowerCase()

  return (obj: T) => {
    const fieldVal = (obj as any)[key] as string
    const fieldValLower = fieldVal.toLowerCase()

    switch (operator) {
      case 'equals':
      case 'equalsIgnoreCase':
        return fieldValLower === valLow
      case 'notEqual':
        return fieldValLower !== valLow
      case 'contains':
        return fieldValLower.includes(valLow)
      case 'notContains':
        return !fieldValLower.includes(valLow)
      case 'startsWith':
      case 'startsWithIgnoreCase':
        return fieldValLower.startsWith(valLow)
      case 'notStartsWith':
        return !fieldValLower.startsWith(valLow)
      default:
        console.warn('Unsupported string operator:', operator)
        return false
    }
  }
}

function filterNumberLambda<T>(crit: NumberConditionDTO<T>): (t: T) => boolean {
  const { key, value, operator } = crit

  return (obj: T) => {
    const fieldVal = (obj as any)[key] as number
    switch (operator) {
      case 'equals':
        return fieldVal === value
      case 'notEqual':
        return fieldVal !== value
      case 'smallerThan':
        return fieldVal < value
      case 'smallerThanOrEquals':
        return fieldVal <= value
      case 'greaterThan':
        return fieldVal > value
      case 'greaterThanOrEquals':
        return fieldVal >= value
      default:
        return false
    }
  }
}

function filterDateLambda<T>(crit: DateConditionDTO<T>): (t: T) => boolean {
  const { key, operator } = crit
  // We interpret "crit.value" as the day in question (0..23:59).
  const start = new Date(crit.value)
  start.setHours(0, 0, 0, 0)
  const end = new Date(crit.value)
  end.setHours(23, 59, 59, 999)

  return (obj: T) => {
    const fieldVal = (obj as any)[key] as Date
    if (!fieldVal) return false

    switch (operator) {
      case 'equals':
        return fieldVal >= start && fieldVal <= end
      case 'notEqual':
        return fieldVal < start || fieldVal > end
      case 'smallerThan':
        return fieldVal < start
      case 'smallerThanOrEquals':
        return fieldVal <= end
      case 'greaterThan':
        return fieldVal > end
      case 'greaterThanOrEquals':
        return fieldVal >= start
      default:
        return false
    }
  }
}
