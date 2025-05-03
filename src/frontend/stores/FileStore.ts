import fse from 'fs-extra';
import * as path from 'path';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';

import { getThumbnailPath } from 'common/fs';
import { promiseAllLimit } from 'common/promise';
import { debounce } from 'common/timeout';
import { DataStorage } from '../../api/data-storage';
import { ConditionDTO, OrderBy, OrderDirection } from '../../api/data-storage-search';
import { FileDTO, IMG_EXTENSIONS_TYPE } from '../../api/file';
import { ID } from '../../api/id';
import { AppToaster } from '../components/Toaster';
import { ClientFile, mergeMovedFile } from '../entities/File';
import { ClientLocation } from '../entities/Location';
import { ClientStringSearchCriteria, ClientTagSearchCriteria } from '../entities/SearchCriteria';
import { ClientTag } from '../entities/Tag';
import RootStore from './RootStore';

export const FILE_STORAGE_KEY = 'OneFolder_File';

/** These fields are stored and recovered when the application opens up */
type PersistentPreferenceFields = 'orderDirection' | 'orderBy' | 'aiTagUrl';

const enum Content {
  All,
  Missing,
  Untagged,
  Query,
}

class FileStore {
  private readonly backend: DataStorage;
  private readonly rootStore: RootStore;

  private fileQueue: { file: ClientFile; resolve: () => void; reject: (err: Error) => void }[] = [];
  private filesQueued: Set<string> = new Set<string>();
  private activeCount = 0;
  private readonly maxConcurrent: number = 4;
  private startTime: number = 0;
  private totalTasks: number = 0;
  private completedTasks: number = 0;
  private taskTimestamps: number[] = [];

  readonly fileList = observable<ClientFile>([]);
  /**
   * The timestamp when the fileList was last modified.
   * Useful for in react component dependencies that need to trigger logic when the fileList changes
   */
  fileListLastModified = observable<Date>(new Date());
  /** A map of file ID to its index in the file list, for quick lookups by ID */
  private readonly index = new Map<ID, number>();

  private filesToSave: Map<ID, FileDTO> = new Map();

  /** The origin of the current files that are shown */
  @observable private content: Content = Content.All;
  @observable orderDirection: OrderDirection = OrderDirection.Desc;
  @observable orderBy: OrderBy<FileDTO> = 'dateAdded';
  @observable aiTagUrl: string = 'http://localhost:5000/api/v1/tag';
  @observable numTotalFiles = 0;
  @observable numUntaggedFiles = 0;
  @observable numMissingFiles = 0;

  debouncedRefetch: () => void;
  debouncedSaveFilesToSave: () => Promise<void>;

  constructor(backend: DataStorage, rootStore: RootStore) {
    this.backend = backend;
    this.rootStore = rootStore;
    makeObservable(this);

    this.debouncedRefetch = debounce(this.refetch, 200).bind(this);
    this.debouncedSaveFilesToSave = debounce(this.saveFilesToSave, 100).bind(this);
  }

  @action.bound async readTagsFromFiles(): Promise<void> {
    const toastKey = 'read-tags-from-file';
    try {
      const numFiles = this.fileList.length;
      for (let i = 0; i < numFiles; i++) {
        AppToaster.show(
          {
            message: `Reading tags from files ${((100 * i) / numFiles).toFixed(0)}%...`,
            timeout: 0,
          },
          toastKey,
        );
        const file = runInAction(() => this.fileList[i]);

        const absolutePath = file.absolutePath;

        try {
          const tagsNameHierarchies = await this.rootStore.exifTool.readTags(absolutePath);

          // Now that we know the tag names in file metadata, add them to the files in OneFolder
          // Main idea: Find matching tag with same name, otherwise, insert new
          //   for now, just match by the name at the bottom of the hierarchy

          const { tagStore } = this.rootStore;
          for (const tagHierarchy of tagsNameHierarchies) {
            const match = tagStore.findByName(tagHierarchy[tagHierarchy.length - 1]);
            if (match) {
              // If there is a match to the leaf tag, just add it to the file
              file.addTag(match);
            } else {
              // If there is no direct match to the leaf, insert it in the tag hierarchy: first check if any of its parents exist
              let curTag = tagStore.root;
              for (const nodeName of tagHierarchy) {
                const nodeMatch = tagStore.findByName(nodeName);
                if (nodeMatch) {
                  curTag = nodeMatch;
                } else {
                  curTag = await tagStore.create(curTag, nodeName);
                }
              }
              file.addTag(curTag);
            }
          }
        } catch (e) {
          console.error('Could not import tags for', absolutePath, e);
        }
      }
      AppToaster.show(
        {
          message: 'Reading tags from files... Done!',
          timeout: 5000,
        },
        toastKey,
      );
    } catch (e) {
      console.error('Could not read tags', e);
      AppToaster.show(
        {
          message: 'Reading tags from files failed. Check the dev console for more details',
          timeout: 5000,
        },
        toastKey,
      );
    }
  }

  @action.bound async aiTagFile(file: ClientFile): Promise<void> {
    // const toastKey = 'ai-tag-file';
    try {
      // const tagsNameHierarchies = await this.rootStore.exifTool.readTags(file.absolutePath);
      let tagsNameHierarchies: string[][] = [];
      const config = {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({file: file.absolutePath})
      }
      const response = await fetch(this.aiTagUrl, config);
      if (response.ok) {
        const data = await response.json();
        if (data.error){
          console.error(data.error);
        } else {
          console.log(data.file, data.tags);
          if (data.tags && data.tags.length) {
            let tag: any;
            for (tag of data.tags) {
              if (tag?.name) tagsNameHierarchies.push([tag.name]);
            }
            // file.markAiTagged();
          }
        }
      } else {
          console.error(response);
          try {
            const data = await response.json();
            throw new Error(`${response.status}: ${data.error}`);
          } catch { }
          throw new Error(`${response.status}`);
      }
      // console.info('tagsNameHierarchies', tagsNameHierarchies);

      // Now that we know the tag names in file metadata, add them to the files in OneFolder
      // Main idea: Find matching tag with same name, otherwise, insert new
      //   for now, just match by the name at the bottom of the hierarchy

      const { tagStore } = this.rootStore;
      for (const tagHierarchy of tagsNameHierarchies) {
        const match = tagStore.findByName(tagHierarchy[tagHierarchy.length - 1], true);
        if (match) {
          // If there is a match to the leaf tag, just add it to the file
          file.addTag(match);
        } else {
          // If there is no direct match to the leaf, insert it in the tag hierarchy: first check if any of its parents exist
          let curTag = tagStore.root;
          for (const nodeName of tagHierarchy) {
            const nodeMatch = tagStore.findByName(nodeName, true);
            if (nodeMatch) {
              curTag = nodeMatch;
            } else {
              curTag = await tagStore.create(curTag, nodeName, true);
            }
          }
          file.addTag(curTag);
        }
      }
    } catch (err) {
      console.error('Could not import tags for', file.absolutePath, err);
      throw new Error(`${err.message}`);
    }
  }

  // @action.bound async readFacesAnnotationsFromFiles(): Promise<void> {
  //   const toastKey = 'read-faces-annotations-from-file';
  //   try {
  //     const numFiles = this.fileList.length;
  //     for (let i = 0; i < numFiles; i++) {
  //       AppToaster.show(
  //         {
  //           message: `Reading faces annotations from files ${((100 * i) / numFiles).toFixed(
  //             0,
  //           )}%...`,
  //           timeout: 0,
  //         },
  //         toastKey,
  //       );
  //       const file = runInAction(() => this.fileList[i]);

  //       const absolutePath = file.absolutePath;

  //       try {
  //         const facesAnnotations = await this.rootStore.exifTool.readFacesAnnotations(absolutePath);
  //         if (facesAnnotations !== undefined) {
  //           console.log('👍 facesAnnotations', facesAnnotations);
  //           file.addFaceAnnotations(facesAnnotations);
  //         }
  //       } catch (e) {
  //         console.error('Could not import faces annotations for', absolutePath, e);
  //       }
  //     }
  //     AppToaster.show(
  //       {
  //         message: 'Reading faces annotations from files... Done!',
  //         timeout: 5000,
  //       },
  //       toastKey,
  //     );
  //   } catch (e) {
  //     console.error('Could not read faces annotations', e);
  //     AppToaster.show(
  //       {
  //         message:
  //           'Reading faces annotations from files failed. Check the dev console for more details',
  //         timeout: 5000,
  //       },
  //       toastKey,
  //     );
  //   }
  // }

  @action.bound async writeTagsToFiles(): Promise<void> {
    const toastKey = 'write-tags-to-file';
    try {
      const numFiles = this.fileList.length;
      const tagFilePairs = runInAction(() =>
        this.fileList.map((f) => ({
          absolutePath: f.absolutePath,
          tagHierarchy: Array.from(
            f.tags,
            action((t) => t.path),
          ),
        })),
      );
      let lastToastVal = '0';
      for (let i = 0; i < tagFilePairs.length; i++) {
        const newToastVal = ((100 * i) / numFiles).toFixed(0);
        if (lastToastVal !== newToastVal) {
          lastToastVal = newToastVal;
          AppToaster.show(
            {
              message: `Writing tags to files ${newToastVal}%...`,
              timeout: 0,
            },
            toastKey,
          );
        }

        const { absolutePath, tagHierarchy } = tagFilePairs[i];
        try {
          await this.rootStore.exifTool.writeTags(absolutePath, tagHierarchy);
          await this.rootStore.exifTool.writeFacesAnnotations(
            absolutePath,
            JSON.parse(this.fileList[i].getAnnotations),
          );
        } catch (e) {
          console.error('Could not write tags to', absolutePath, tagHierarchy, e);
        }
      }
      AppToaster.show(
        {
          message: 'Writing tags to files... Done!',
          timeout: 5000,
        },
        toastKey,
      );
    } catch (e) {
      console.error('Could not write tags', e);
      AppToaster.show(
        {
          message: 'Writing tags to files failed. Check the dev console for more details',
          timeout: 5000,
        },
        toastKey,
      );
    }
  }

  @computed get showsAllContent(): boolean {
    return this.content === Content.All;
  }

  @computed get showsUntaggedContent(): boolean {
    return this.content === Content.Untagged;
  }

  @computed get showsMissingContent(): boolean {
    return this.content === Content.Missing;
  }

  @computed get showsQueryContent(): boolean {
    return this.content === Content.Query;
  }

  @action.bound switchOrderDirection(): void {
    this.setOrderDirection(
      this.orderDirection === OrderDirection.Desc ? OrderDirection.Asc : OrderDirection.Desc,
    );
    this.refetch();
  }

  @action.bound orderFilesBy(prop: OrderBy<FileDTO> = 'dateAdded'): void {
    this.setOrderBy(prop);
    this.refetch();
  }

  @action.bound setContentQuery(): void {
    this.content = Content.Query;
    if (this.rootStore.uiStore.isSlideMode) {
      this.rootStore.uiStore.disableSlideMode();
    }
  }

  @action.bound setContentAll(): void {
    this.content = Content.All;
    if (this.rootStore.uiStore.isSlideMode) {
      this.rootStore.uiStore.disableSlideMode();
    }
  }

  @action.bound setContentUntagged(): void {
    this.content = Content.Untagged;
    if (this.rootStore.uiStore.isSlideMode) {
      this.rootStore.uiStore.disableSlideMode();
    }
  }

  /**
   * Marks file as missing
   *
   * Marking a file as missing will remove the file from the FileStore stats and
   * automatically 'freezes' the object. Freezing means that changes made to a
   * file will not be saved in the database.
   * @param file
   */
  @action.bound hideFile(file: ClientFile): void {
    file.setBroken(true);
    this.rootStore.uiStore.deselectFile(file);
    this.incrementNumMissingFiles();
    if (file.tags.size === 0) {
      this.decrementNumUntaggedFiles();
    }
  }

  /** Replaces a file's data when it is moved or renamed */
  @action.bound replaceMovedFile(file: ClientFile, newData: FileDTO): void {
    const index = this.index.get(file.id);
    if (index !== undefined) {
      file.dispose();

      const newIFile = mergeMovedFile(file.serialize(), newData);

      // Move thumbnail
      const { thumbnailDirectory } = this.rootStore.uiStore; // TODO: make a config store for this?
      const oldThumbnailPath = file.thumbnailPath.replace('?v=1', '');
      const newThumbPath = getThumbnailPath(newData.absolutePath, thumbnailDirectory);
      fse.move(oldThumbnailPath, newThumbPath).catch(() => {});

      const newClientFile = new ClientFile(this, newIFile, this.rootStore.exifTool);
      newClientFile.thumbnailPath = newThumbPath;
      this.fileList[index] = newClientFile;
      this.save(newClientFile.serialize());
    }
  }

  /** Removes a file from the internal state of this store and the DB. Does not remove from disk. */
  @action async deleteFiles(files: ClientFile[]): Promise<void> {
    if (files.length === 0) {
      return;
    }

    try {
      // Remove from backend
      // Deleting non-exiting keys should not throw an error!
      await this.backend.removeFiles(files.map((f) => f.id));

      // Remove files from stores
      for (const file of files) {
        file.dispose();
        this.rootStore.uiStore.deselectFile(file);
        this.removeThumbnail(file.absolutePath);
      }
      this.fileListLastModified = new Date();
      return this.refetch();
    } catch (err) {
      console.error('Could not remove files', err);
    }
  }

  @action async deleteFilesByExtension(ext: IMG_EXTENSIONS_TYPE): Promise<void> {
    try {
      const crit = new ClientStringSearchCriteria('extension', ext, 'equals');
      const files = await this.backend.searchFiles(crit.toCondition(), 'id', OrderDirection.Asc);
      console.log('Files to delete', ext, files);
      await this.backend.removeFiles(files.map((f) => f.id));

      for (const file of files) {
        this.removeThumbnail(file.absolutePath);
      }
    } catch (e) {
      console.error('Could not delete files bye extension', ext);
    }
  }

  @action.bound async refetch(): Promise<void> {
    if (this.showsAllContent) {
      return this.fetchAllFiles();
    } else if (this.showsUntaggedContent) {
      return this.fetchUntaggedFiles();
    } else if (this.showsQueryContent) {
      return this.fetchFilesByQuery();
    } else if (this.showsMissingContent) {
      return this.fetchMissingFiles();
    }
  }

  @action.bound async fetchAllFiles(): Promise<void> {
    try {
      this.rootStore.uiStore.clearSearchCriteriaList();
      const fetchedFiles = await this.backend.fetchFiles(this.orderBy, this.orderDirection);
      this.setContentAll();
      return this.updateFromBackend(fetchedFiles);
    } catch (err) {
      console.error('Could not load all files', err);
    }
  }

  @action.bound async fetchUntaggedFiles(): Promise<void> {
    try {
      const { uiStore } = this.rootStore;
      uiStore.clearSearchCriteriaList();
      const criteria = new ClientTagSearchCriteria('tags');
      uiStore.searchCriteriaList.push(criteria);
      const fetchedFiles = await this.backend.searchFiles(
        criteria.toCondition(this.rootStore),
        this.orderBy,
        this.orderDirection,
        uiStore.searchMatchAny,
      );
      this.setContentUntagged();
      return this.updateFromBackend(fetchedFiles);
    } catch (err) {
      console.error('Could not load all files', err);
    }
  }

  @action.bound async fetchMissingFiles(): Promise<void> {
    try {
      const {
        orderBy,
        orderDirection,
        rootStore: { uiStore },
      } = this;

      uiStore.searchCriteriaList.clear();
      this.setContentMissing();

      // Fetch all files, then check their existence and only show the missing ones
      // Similar to {@link updateFromBackend}, but the existence check needs to be awaited before we can show the images
      const backendFiles = await this.backend.fetchFiles(orderBy, orderDirection);

      // For every new file coming in, either re-use the existing client file if it exists,
      // or construct a new client file
      const [newClientFiles, reusedStatus] = this.filesFromBackend(backendFiles);

      // Dispose of unused files
      runInAction(() => {
        for (const oldFile of this.fileList) {
          if (!reusedStatus.has(oldFile.id)) {
            oldFile.dispose();
          }
        }
      });

      // We don't store whether files are missing (since they might change at any time)
      // So we have to check all files and check their existence them here
      const existenceCheckPromises = newClientFiles.map((clientFile) => async () => {
        clientFile.setBroken(!(await fse.pathExists(clientFile.absolutePath)));
      });

      const N = 50; // TODO: same here as in fetchFromBackend: number of concurrent checks should be system dependent
      await promiseAllLimit(existenceCheckPromises, N);

      runInAction(() => {
        const missingClientFiles = newClientFiles.filter((file) => file.isBroken);
        this.fileList.replace(missingClientFiles);
        this.numMissingFiles = missingClientFiles.length;
        this.index.clear();
        for (let index = 0; index < this.fileList.length; index++) {
          const file = this.fileList[index];
          this.index.set(file.id, index);
        }
        this.fileListLastModified = new Date();
      });
      this.cleanFileSelection();

      AppToaster.show(
        {
          message:
            'Some files can no longer be found. Either move them back to their location, or delete them from OneFolder',
          timeout: 12000,
        },
        'recovery-view',
      );
    } catch (err) {
      console.error('Could not load broken files', err);
    }
  }

  @action.bound async fetchFilesByQuery(): Promise<void> {
    const { uiStore } = this.rootStore;

    if (uiStore.searchCriteriaList.length === 0) {
      return this.fetchAllFiles();
    }

    const criterias = uiStore.searchCriteriaList.map((c) => c.toCondition(this.rootStore));
    try {
      const fetchedFiles = await this.backend.searchFiles(
        criterias as [ConditionDTO<FileDTO>, ...ConditionDTO<FileDTO>[]],
        this.orderBy,
        this.orderDirection,
        uiStore.searchMatchAny,
      );
      this.setContentQuery();
      return this.updateFromBackend(fetchedFiles);
    } catch (e) {
      console.log('Could not find files based on criteria', e);
    }
  }

  @action.bound incrementNumUntaggedFiles(): void {
    this.numUntaggedFiles++;
  }

  @action.bound decrementNumUntaggedFiles(): void {
    if (this.numUntaggedFiles === 0) {
      throw new Error('Invalid Database State: Cannot have less than 0 untagged files.');
    }
    this.numUntaggedFiles--;
  }

  // Removes all items from fileList
  @action.bound clearFileList(): void {
    this.fileList.clear();
    this.index.clear();
  }

  @action get(id: ID): ClientFile | undefined {
    const fileIndex = this.index.get(id);
    return fileIndex !== undefined ? this.fileList[fileIndex] : undefined;
  }

  getIndex(id: ID): number | undefined {
    return this.index.get(id);
  }

  getTags(ids: ID[]): Set<ClientTag> {
    const tags = new Set<ClientTag>();
    for (const id of ids) {
      const tag = this.rootStore.tagStore.get(id);
      if (tag !== undefined) {
        tags.add(tag);
      }
    }
    return tags;
  }

  getLocation(location: ID): ClientLocation {
    const loc = this.rootStore.locationStore.get(location);
    if (!loc) {
      throw new Error(
        `Location of file was not found! This should never happen! Location ${location}`,
      );
    }
    return loc;
  }

  save(file: FileDTO): void {
    file.dateModified = new Date();

    // Save files in bulk so saving many files at once is faster.
    // Each file will call this save() method individually after detecting a change on its observable fields,
    // these can be batched by collecting the changes and debouncing the save operation
    this.filesToSave.set(file.id, file);
    this.debouncedSaveFilesToSave();
  }

  private async saveFilesToSave() {
    await this.backend.saveFiles(Array.from(this.filesToSave.values()));
    this.filesToSave.clear();
  }

  @action recoverPersistentPreferences(): void {
    const prefsString = localStorage.getItem(FILE_STORAGE_KEY);
    if (prefsString) {
      try {
        const prefs = JSON.parse(prefsString);
        // BACKWARDS_COMPATIBILITY: orderDirection used to be called fileOrder
        this.setOrderDirection(prefs.orderDirection ?? prefs.fileOrder);
        this.setOrderBy(prefs.orderBy);
      } catch (e) {
        console.error('Cannot parse persistent preferences:', FILE_STORAGE_KEY, e);
      }
    }
  }

  getPersistentPreferences(): Partial<Record<keyof FileStore, unknown>> {
    const preferences: Record<PersistentPreferenceFields, unknown> = {
      orderBy: this.orderBy,
      orderDirection: this.orderDirection,
      aiTagUrl: this.aiTagUrl,
    };
    return preferences;
  }

  clearPersistentPreferences(): void {
    localStorage.removeItem(FILE_STORAGE_KEY);
  }

  @action private async removeThumbnail(path: string) {
    const thumbnailPath = getThumbnailPath(path, this.rootStore.uiStore.thumbnailDirectory);
    try {
      if (await fse.pathExists(thumbnailPath)) {
        return fse.remove(thumbnailPath);
      }
    } catch (error) {
      // TODO: Show a notification that not all thumbnails could be removed?
      console.error(error);
    }
  }

  @action async updateFromBackend(backendFiles: FileDTO[]): Promise<void> {
    if (backendFiles.length === 0) {
      this.rootStore.uiStore.clearFileSelection();
      this.fileListLastModified = new Date();
      return this.clearFileList();
    }

    // Filter out images with hidden tags
    // TODO: could also do it in search query, this is simpler though (maybe also more performant)
    const hiddenTagIds = new Set(
      this.rootStore.tagStore.tagList.filter((t) => t.isHidden).map((t) => t.id),
    );
    backendFiles = backendFiles.filter((f) => !f.tags.some((t) => hiddenTagIds.has(t)));

    // For every new file coming in, either re-use the existing client file if it exists,
    // or construct a new client file
    const [newClientFiles, reusedStatus] = this.filesFromBackend(backendFiles);

    // Dispose of Client files that are not re-used (to get rid of MobX observers)
    for (const file of this.fileList) {
      if (!reusedStatus.has(file.id)) {
        file.dispose();
      }
    }

    // Check existence of new files asynchronously, no need to wait until they can be shown
    // we can simply check whether they exist after they start rendering
    // TODO: We can already get this from chokidar (folder watching), pretty much for free
    const existenceCheckPromises = newClientFiles.map((clientFile) => async () => {
      clientFile.setBroken(!(await fse.pathExists(clientFile.absolutePath)));
    });

    // Run the existence check with at most N checks in parallel
    // TODO: Should make N configurable, or determine based on the system/disk performance
    // NOTE: This is _not_ await intentionally, since we want to show the files to the user as soon as possible
    runInAction(() => {
      // TODO: restores this line later, currently broken for large lists, see https://github.com/mobxjs/mobx/pull/3189 (look ma, I'm contributing to open source!)
      // this.fileList.replace(newClientFiles);
      this.fileList.clear();
      this.fileList.push(...newClientFiles);

      this.cleanFileSelection();
      this.updateFileListState(); // update index & untagged image counter
      this.fileListLastModified = new Date();
    });
    const N = 50;
    return promiseAllLimit(existenceCheckPromises, N)
      .then(() => {
        this.updateFileListState(); // update missing image counter
      })
      .catch((e) => console.error('An error occured during existence checking!', e));
  }

  /** Remove files from selection that are not in the file list anymore */
  @action private cleanFileSelection() {
    const { fileSelection } = this.rootStore.uiStore;
    for (const file of fileSelection) {
      if (!this.index.has(file.id)) {
        fileSelection.delete(file);
      }
    }
  }

  /**
   *
   * @param backendFiles
   * @returns A list of Client files, and a set of keys that was reused from the existing fileList
   */
  @action private filesFromBackend(backendFiles: FileDTO[]): [ClientFile[], Set<ID>] {
    const reusedStatus = new Set<ID>();

    const clientFiles = backendFiles.map((f) => {
      // Might already exist!
      const existingFile = this.get(f.id);
      if (existingFile !== undefined) {
        reusedStatus.add(existingFile.id);
        // Update tags (might have changes, e.g. removed/merged)
        const newTags = f.tags
          .map((t) => this.rootStore.tagStore.get(t))
          .filter((t) => t !== undefined) as ClientTag[];
        if (
          existingFile.tags.size !== newTags.length ||
          Array.from(existingFile.tags).some((t, i) => t.id !== newTags[i].id)
        ) {
          existingFile.updateTagsFromBackend(newTags);
        }
        return existingFile;
      }

      // Otherwise, create new one.
      // TODO: Maybe better performance by always keeping the same pool of client files,
      // and just replacing their properties instead of creating new objects
      // But that's micro optimization...

      const file = new ClientFile(this, f, this.rootStore.exifTool);
      // Initialize the thumbnail path so the image can be loaded immediately when it mounts.
      // To ensure the thumbnail actually exists, the `ensureThumbnail` function should be called
      file.thumbnailPath = this.rootStore.imageLoader.needsThumbnail(f)
        ? getThumbnailPath(f.absolutePath, this.rootStore.uiStore.thumbnailDirectory)
        : f.absolutePath;
      return file;
    });

    return [clientFiles, reusedStatus];
  }

  /** Derive fields from `fileList`
   * - `index`
   * - `numUntaggedFiles`
   * - `numMissingFiles`
   */
  @action private updateFileListState() {
    let missingFiles = 0;
    let untaggedFiles = 0;
    this.index.clear();
    for (let index = 0; index < this.fileList.length; index++) {
      const file = this.fileList[index];
      if (file.isBroken) {
        missingFiles += 1;
      } else if (file.tags.size === 0) {
        untaggedFiles += 1;
      }
      this.index.set(file.id, index);
    }
    this.numMissingFiles = missingFiles;
    if (this.showsAllContent) {
      this.numTotalFiles = this.fileList.length;
      this.numUntaggedFiles = untaggedFiles;
    } else if (this.showsUntaggedContent) {
      this.numUntaggedFiles = this.fileList.length;
    }
  }

  public enqueueFile(file: ClientFile): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.totalTasks++;
      
      // Initialize startTime on first enqueue if not already set
      if (this.startTime === 0) {
        this.startTime = Date.now();
      }
      
      this.filesQueued.add(file.id);
      this.fileQueue.push({ file, resolve, reject });
      this.processQueue();
    });
  }
  
  public async processFiles(files: ClientFile[]): Promise<void> {
    await Promise.all(files.map(file => this.enqueueFile(file)));
  }
  
  // Add a public method to retrieve progress information
  public getProgress(): {
    totalTasks: number;
    remaining: number;
    completed: number;
    tasksPerMinute: number;
    eta: string;
  } {
    const tasksPerMinute = this.getTasksPerMinute();
    const remaining = this.fileQueue.length + this.activeCount;
    
    // Calculate ETA
    let eta = "Unknown";
    if (tasksPerMinute > 0) {
      const minutesRemaining = remaining / tasksPerMinute;
      eta = this.formatTimeRemaining(minutesRemaining);
    } else if (this.completedTasks === 0) {
      eta = "Calculating...";
    } else if (remaining === 0) {
      eta = "Done";
    }
    
    return {
      totalTasks: this.totalTasks,
      remaining: remaining,
      completed: this.completedTasks,
      tasksPerMinute: tasksPerMinute,
      eta: eta
    };
  }
  
  // Format time remaining as a human-readable string
  private formatTimeRemaining(minutes: number): string {
    if (minutes < 0.1) {
      return "Less than 6 seconds";
    }
    
    if (minutes < 1) {
      return `${Math.round(minutes * 60)} seconds`;
    }
    
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    
    if (hours === 0) {
      return `${mins} minute${mins !== 1 ? 's' : ''}`;
    } else {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${mins} minute${mins !== 1 ? 's' : ''}`;
    }
  }
  
  private getTasksPerMinute(): number {
    const now = Date.now();
    const elapsedMs = now - this.startTime;
    const minutesElapsed = elapsedMs / 60000;
    
    // No tasks completed or no time elapsed
    if (this.completedTasks === 0 || minutesElapsed <= 0) {
      return 0;
    }
    
    // If we have enough data from the last minute, use that
    if (minutesElapsed >= 1) {
      const oneMinuteAgo = now - 60000;
      const recentTasks = this.taskTimestamps.filter(timestamp => timestamp >= oneMinuteAgo);
      
      if (recentTasks.length > 0) {
        return recentTasks.length;
      }
    }
    
    // Otherwise, extrapolate from all data so far
    return this.completedTasks / minutesElapsed;
  }  
  
  private processQueue(): void {
    // if (this.activeCount) return;
    while (this.fileQueue.length > 0 && this.activeCount < this.maxConcurrent) {
      const task = this.fileQueue.shift();
      if (!task) break;
      
      this.activeCount++;
      
      this.aiTagFile(task.file)
        .then(() => {
          this.completedTasks++;
          this.taskTimestamps.push(Date.now());
          
          // Keep only the last 10 minutes of timestamps to avoid memory issues
          const tenMinutesAgo = Date.now() - 600000;
          this.taskTimestamps = this.taskTimestamps.filter(t => t >= tenMinutesAgo);
          
          // Log progress with ETA
          const progress = this.getProgress();;

          AppToaster.show(
            {
              message: `${progress.completed}/${progress.totalTasks} completed (${progress.remaining} remaining)\n${progress.tasksPerMinute.toFixed(2)} tasks/min\nETA: ${progress.eta}`,
              timeout: 5000,
            },
            'ai-tag-processing',
          );

          if (progress.completed === progress.totalTasks) {
            this.totalTasks = 0;
            this.completedTasks = 0;
          }
          
          task.resolve();
        })
        .catch(err => {
          AppToaster.show(
            {
              message: `AI tag error ${err.message}`,
              timeout: 5000,
            },
            'ai-tag-error',
          );
          task.reject(err);
        })
        .finally(() => {
          this.activeCount--;
          this.processQueue();
        });
    }
  }

  async aiTagFiles(fileSelection: Array<ClientFile>): Promise<any> {
    const fileDirList = fileSelection.filter((f) => {
      // might emmit a lot of Observable browser warnings
      return !this.filesQueued.has(f.id) && !f.hasAiTags;
    });

    if (!fileDirList.length){
      AppToaster.show(
        {
          message: `No files to process or already tagged`,
          timeout: 5000,
        },
        'ai-tag-files',
      );
      return;
    }

    AppToaster.show(
      {
        message: `Added ${fileDirList.length} items to process`,
        timeout: 5000,
      },
      'ai-tag-files',
    );

    try {
      await this.processFiles(fileDirList);
      AppToaster.show(
        {
          message: `Completed tagging items`,
          timeout: 5000,
        },
        'ai-tag-files',
      );
    } catch (error) {
      console.error('Batch processing failed:', error);
      AppToaster.show(
        {
          message: `AI tagging error: ${error.message}`,
          timeout: 5000,
        },
        'ai-tag-files',
      );
    }
  }

  async aiTagDirectory(dirPath: string): Promise<any> {
    const fetchedFiles = await this.backend.fetchFiles(this.orderBy, this.orderDirection);
    const [newClientFiles, reusedStatus] = this.filesFromBackend(fetchedFiles);
    const fileDirList = newClientFiles.filter((f) => {
      // might emmit a lot of Observable browser warnings
      return !this.filesQueued.has(f.id) && f.absolutePath.startsWith(dirPath) && !f.hasAiTags;
    });

    if (!fileDirList.length){
      AppToaster.show(
        {
          message: `No files to process or already tagged`,
          timeout: 5000,
        },
        'ai-tag-directory',
      );
      return;
    }

    AppToaster.show(
      {
        message: `Added ${fileDirList.length} items to process`,
        timeout: 5000,
      },
      'ai-tag-directory',
    );

    try {
      await this.processFiles(fileDirList);
      AppToaster.show(
        {
          message: `Completed tagging ${path.basename(dirPath)}`,
          timeout: 5000,
        },
        'ai-tag-directory',
      );
    } catch (error) {
      console.error('Batch processing failed:', error);
      AppToaster.show(
        {
          message: `AI tagging error: ${error.message}`,
          timeout: 5000,
        },
        'ai-tag-directory',
      );
    }
  }

  /** Initializes the total and untagged file counters by querying the database with count operations */
  async refetchFileCounts(): Promise<void> {
    const [numTotalFiles, numUntaggedFiles] = await this.backend.countFiles();
    runInAction(() => {
      this.numUntaggedFiles = numUntaggedFiles;
      this.numTotalFiles = numTotalFiles;
    });
  }

  @action private setOrderDirection(order: OrderDirection) {
    this.orderDirection = order;
  }

  @action private setOrderBy(prop: OrderBy<FileDTO> = 'dateAdded') {
    this.orderBy = prop;
  }

  @action.bound setAiTagUrl(event: React.ChangeEvent<HTMLInputElement>): void {
    this.aiTagUrl = event.target.value;
  }

  @action private setContentMissing() {
    this.content = Content.Missing;
  }

  @action private incrementNumMissingFiles() {
    this.numMissingFiles++;
  }

  // FACES
  // FACES
  // FACES
  @action.bound async addPeopleTag(peopleName: string, file: ClientFile): Promise<ClientTag> {
    const peopleTag = await this.rootStore.tagStore.addPeopleTag(peopleName);
    file.addTag(peopleTag);
    return peopleTag;
  }
}

export default FileStore;
