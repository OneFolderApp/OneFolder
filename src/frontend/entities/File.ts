import {
  action,
  IReactionDisposer,
  makeObservable,
  observable,
  computed,
  ObservableSet,
  reaction,
  ObservableMap,
} from 'mobx';
import Path from 'path';

import { FileDTO, IMG_EXTENSIONS_TYPE } from '../../api/file';
import { ID } from '../../api/id';
import ImageLoader from '../image/ImageLoader';
import FileStore from '../stores/FileStore';
import { FileStats } from '../stores/LocationStore';
import { ClientTag } from './Tag';
import { ClientExtraProperty } from './ExtraProperty';
import {
  ExtraProperties,
  ExtraPropertyValue,
  getExtraPropertyDefaultValue,
} from 'src/api/extraProperty';

/** Retrieved file meta data information */
interface IMetaData {
  /** Duplicate data; also exists as part of the absolutePath. Used for DB queries */
  name: string;
  /** in lowercase, without the dot */
  extension: IMG_EXTENSIONS_TYPE;
  /** Size in bytes */
  size: number;
  width: number;
  height: number;
  /** Date when this file was created (from the OS, not related to Allusion) */
  dateCreated: Date;
}

export interface Dimensions {
  width: number;
  height: number;
}

/**
 * A File as it is stored in the Client.
 * It is stored in a MobX store, which can observe changed made to it and subsequently
 * update the entity in the backend.
 */
export class ClientFile {
  private store: FileStore;
  private saveHandler: IReactionDisposer;
  private autoSave: boolean = true;

  readonly ino: string;
  readonly id: ID;
  readonly locationId: ID;
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly tags: ObservableSet<ClientTag>;
  readonly extraProperties: ObservableMap<ClientExtraProperty, ExtraPropertyValue>;
  readonly size: number;
  readonly width: number;
  readonly height: number;
  readonly dateAdded: Date;
  readonly dateCreated: Date;
  readonly dateModified: Date;
  readonly OrigDateModified: Date;
  readonly dateLastIndexed: Date;
  readonly name: string;
  readonly extension: IMG_EXTENSIONS_TYPE;
  /** Same as "name", but without extension */
  readonly filename: string;

  @observable thumbnailPath: string = '';

  // Is undefined until existence check has been completed
  @observable isBroken?: boolean;

  constructor(store: FileStore, fileProps: FileDTO) {
    this.store = store;

    this.ino = fileProps.ino;
    this.id = fileProps.id;
    this.locationId = fileProps.locationId;
    this.relativePath = fileProps.relativePath;
    this.size = fileProps.size;
    this.width = fileProps.width;
    this.height = fileProps.height;
    this.dateAdded = fileProps.dateAdded;
    this.dateCreated = fileProps.dateCreated;
    this.dateModified = fileProps.dateModified;
    this.OrigDateModified = fileProps.OrigDateModified;
    this.dateLastIndexed = fileProps.dateLastIndexed;
    this.name = fileProps.name;
    this.extension = fileProps.extension;

    const location = store.getLocation(this.locationId);
    this.absolutePath = Path.join(location.path, this.relativePath);

    const base = Path.basename(this.relativePath);
    this.filename = base.slice(0, base.lastIndexOf('.'));

    this.tags = observable(this.store.getTags(fileProps.tags));
    this.extraProperties = observable(this.store.getExtraProperties(fileProps.extraProperties));

    // observe all changes to observable fields
    this.saveHandler = reaction(
      // We need to explicitly define which values this reaction should react to
      () => this.serialize(),
      // Then update the entity in the database
      (file) => {
        // Remove reactive properties, since observable props are not accepted in the backend
        if (this.autoSave) {
          this.store.save(file);
        }
      },
      { delay: 500 },
    );

    makeObservable(this);
  }

  /**
   * Gets his tags and all inherithed tags from parent and implied tags from his tags.
   */
  @computed get inheritedTags(): ClientTag[] {
    const inheritedTagSet = new Set<ClientTag>();
    const visited = new Set<ClientTag>();
    for (const tag of this.tags) {
      // If the tag is already on the set all it's ancestors are too so skip it.
      if (!inheritedTagSet.has(tag)) {
        for (const inheritedTag of tag.getImpliedAncestors(visited)) {
          // If the tag should be shown add it to the set.
          if (inheritedTag.shouldShowWhenInherited) {
            inheritedTagSet.add(inheritedTag);
          }
        }
      }
      // Ensure to add the explicit assigned tags,
      // it might have been excluded by not passing inheritedTag.shouldShowWhenInherited
      inheritedTagSet.add(tag);
    }
    return Array.from(inheritedTagSet).sort((a, b) => a.flatIndex - b.flatIndex);
  }

  @action.bound setThumbnailPath(thumbnailPath: string): void {
    this.thumbnailPath = `${thumbnailPath.split('?')[0]}?v=${Date.now()}`;
  }

  @action.bound addTag(tag: ClientTag): void {
    const hasTag = this.tags.has(tag);
    if (!hasTag) {
      this.tags.add(tag);
      this.store.addRecentlyUsedTag(tag);
      tag.incrementFileCount();

      if (this.tags.size === 1) {
        this.store.decrementNumUntaggedFiles();
      }
    }
  }

  @action.bound setExtraProperty(
    extraProperty: ClientExtraProperty,
    value?: ExtraPropertyValue,
  ): void {
    const finalValue =
      value !== undefined ? value : getExtraPropertyDefaultValue(extraProperty.type);
    this.extraProperties.set(extraProperty, finalValue);
  }

  @action.bound removeTag(tag: ClientTag): void {
    const hadTag = this.tags.delete(tag);
    if (hadTag) {
      tag.decrementFileCount();

      if (this.tags.size === 0) {
        this.store.incrementNumUntaggedFiles();
      }
    }
  }

  @action.bound removeExtraProperty(extraProperty: ClientExtraProperty): void {
    this.extraProperties.delete(extraProperty);
  }

  @action.bound clearTags(): void {
    if (this.tags.size > 0) {
      this.store.incrementNumUntaggedFiles();
      this.tags.forEach((tag) => tag.decrementFileCount());
      this.tags.clear();
    }
  }

  @action.bound setBroken(isBroken: boolean): void {
    this.isBroken = isBroken;
    this.autoSave = !isBroken;
  }

  @action.bound updateTagsFromBackend(tags: ClientTag[]): void {
    this.tags.replace(tags);
  }

  @action.bound updateExtraPropertiesFromBackend(
    extraProperties: Map<ClientExtraProperty, ExtraPropertyValue>,
  ): void {
    this.extraProperties.replace(extraProperties);
  }

  serialize(): FileDTO {
    const entries: [string, ExtraPropertyValue][] = Array.from(
      this.extraProperties.entries(),
      ([extraProperty, value]) => [extraProperty.id, value],
    );
    const extraProperties: ExtraProperties = Object.fromEntries(entries);
    const extraPropertyIDs = entries.map(([id]) => id);
    return {
      id: this.id,
      ino: this.ino,
      locationId: this.locationId,
      relativePath: this.relativePath,
      absolutePath: this.absolutePath,
      tags: Array.from(this.tags, (t) => t.id), // removes observable properties from observable array
      extraPropertyIDs: extraPropertyIDs,
      extraProperties: extraProperties,
      size: this.size,
      width: this.width,
      height: this.height,
      dateAdded: this.dateAdded,
      dateCreated: this.dateCreated,
      dateModified: this.dateModified,
      OrigDateModified: this.OrigDateModified,
      dateLastIndexed: this.dateLastIndexed,
      name: this.name,
      extension: this.extension,
    };
  }

  dispose(): void {
    this.autoSave = false;
    // clean up the observer
    this.saveHandler();
  }
}

/** Should be called when after constructing a file before sending it to the backend. */
export async function getMetaData(stats: FileStats, imageLoader: ImageLoader): Promise<IMetaData> {
  const path = stats.absolutePath;
  const dimensions = await imageLoader.getImageResolution(stats.absolutePath);

  return {
    name: Path.basename(path),
    extension: Path.extname(path).slice(1).toLowerCase() as IMG_EXTENSIONS_TYPE,
    size: stats.size,
    width: dimensions.width,
    height: dimensions.height,
    dateCreated: stats.dateCreated,
  };
}

/** Merges an existing IFile file with a newly detected IFile: only the paths of the oldFile will be updated  */
export function mergeMovedFile(oldFile: FileDTO, newFile: FileDTO): FileDTO {
  return {
    ...oldFile,
    ino: newFile.ino,
    name: newFile.name,
    extension: newFile.extension,
    absolutePath: newFile.absolutePath,
    relativePath: newFile.relativePath,
    locationId: newFile.locationId,
    dateModified: new Date(),
  };
}
