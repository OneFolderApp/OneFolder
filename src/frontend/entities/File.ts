import {
  action,
  IReactionDisposer,
  makeObservable,
  observable,
  ObservableSet,
  reaction,
  computed,
} from 'mobx';
import Path from 'path';

import { FileDTO, IMG_EXTENSIONS_TYPE } from '../../api/file';
import { ID } from '../../api/id';
import ImageLoader from '../image/ImageLoader';
import { detectFaces } from '../image/aiModels';
import FileStore from '../stores/FileStore';
import { FileStats } from '../stores/LocationStore';
import { ClientTag } from './Tag';
import ExifIO from 'common/ExifIO';

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
  /** Date when this file was created (from the OS, not related to OneFolder) */
  dateCreated: Date;
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
  private exifTool: ExifIO;

  readonly ino: string;
  readonly id: ID;
  readonly locationId: ID;
  readonly relativePath: string;
  readonly absolutePath: string;
  readonly tags: ObservableSet<ClientTag>;
  readonly size: number;
  readonly width: number;
  readonly height: number;
  readonly dateAdded: Date;
  readonly dateCreated: Date;
  readonly dateModified: Date;
  readonly dateLastIndexed: Date;
  readonly name: string;
  readonly extension: IMG_EXTENSIONS_TYPE;
  /** Same as "name", but without extension */
  readonly filename: string;

  @observable annotations: string;
  @observable thumbnailPath: string = '';
  // Is undefined until existence check has been completed
  @observable isBroken?: boolean;

  constructor(store: FileStore, fileProps: FileDTO, exifTool: ExifIO) {
    this.store = store;
    this.exifTool = exifTool;

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
    this.dateLastIndexed = fileProps.dateLastIndexed;
    this.name = fileProps.name;
    this.extension = fileProps.extension;

    const location = store.getLocation(this.locationId);
    this.absolutePath = Path.join(location.path, this.relativePath);

    const base = Path.basename(this.relativePath);
    this.filename = base.slice(0, base.lastIndexOf('.'));

    this.tags = observable(this.store.getTags(fileProps.tags));

    // string to object
    this.annotations = fileProps.annotations;

    // observe all changes to observable fields
    this.saveHandler = reaction(
      // We need to explicitly define which values this reaction should react to
      () => this.serialize(),
      // Then update the entity in the database
      (file) => {
        // Remove reactive properties, since observable props are not accepted in the backend
        if (this.autoSave) {
          console.log('🌱', file);
          this.store.save(file);
        }
      },
      { delay: 500 },
    );

    makeObservable(this);
  }

  @computed get getAnnotations(): string {
    return this.annotations;
  }

  @computed get hasAiTags(): boolean {
    if (this.tags.size === 0) return false;
    for (const obj of this.tags) {
      if (obj.isAi === true) {
        return true;
      }
    }
    return false;
  }

  @action.bound setThumbnailPath(thumbnailPath: string): void {
    this.thumbnailPath = thumbnailPath;
  }

  @action.bound addTag(tag: ClientTag): void {
    const hasTag = this.tags.has(tag);
    if (!hasTag) {
      this.tags.add(tag);

      const tagHierarchy = Array.from(
        this.tags,
        action((t) => t.path),
      );

      // this.exifTool.writeTags(this.absolutePath, tagHierarchy);

      tag.incrementFileCount();

      if (this.tags.size === 1) {
        this.store.decrementNumUntaggedFiles();
      }
    }
  }

  @action.bound removeTag(tag: ClientTag): void {
    const hadTag = this.tags.delete(tag);
    if (hadTag) {
      const tagHierarchy = Array.from(
        this.tags,
        action((t) => t.path),
      );

      //   this.exifTool.writeTags(this.absolutePath, tagHierarchy);
      tag.decrementFileCount();

      if (this.tags.size === 0) {
        this.store.incrementNumUntaggedFiles();
      }
    }
  }

  @action.bound clearTags(): void {
    if (this.tags.size > 0) {
      this.store.incrementNumUntaggedFiles();
      this.tags.forEach((tag) => tag.decrementFileCount());
      this.tags.clear();
    }
  }

  // @action.bound addFaceAnnotations(annotation: object): void {
  //   this.annotations = JSON.stringify(annotation);
  // }

  @action.bound setBroken(isBroken: boolean): void {
    this.isBroken = isBroken;
    this.autoSave = !isBroken;
  }

  @action.bound updateTagsFromBackend(tags: ClientTag[]): void {
    this.tags.replace(tags);
  }

  serialize(): FileDTO {
    return {
      id: this.id,
      ino: this.ino,
      locationId: this.locationId,
      relativePath: this.relativePath,
      absolutePath: this.absolutePath,
      tags: Array.from(this.tags, (t) => t.id), // removes observable properties from observable array
      size: this.size,
      width: this.width,
      height: this.height,
      dateAdded: this.dateAdded,
      dateCreated: this.dateCreated,
      dateModified: this.dateModified,
      dateLastIndexed: this.dateLastIndexed,
      name: this.name,
      extension: this.extension,
      annotations: this.annotations, // serialize annotations object to string
    };
  }

  dispose(): void {
    this.autoSave = false;
    // clean up the observer
    this.saveHandler();
  }

  // FACES
  // FACES
  // FACES
  @action.bound detectFaces(img: HTMLImageElement): void {
    detectFaces(img);
  }

  @action.bound async addPeopleTag(peopleName: string): Promise<ClientTag> {
    return await this.store.addPeopleTag(peopleName, this);
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
