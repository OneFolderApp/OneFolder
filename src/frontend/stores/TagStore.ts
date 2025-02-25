import { action, computed, makeObservable, observable } from 'mobx';

import { DataStorage } from '../../api/data-storage';
import { generateId, ID } from '../../api/id';
import { ROOT_TAG_ID, TagDTO } from '../../api/tag';
import { ClientFile } from '../entities/File';
import { ClientTagSearchCriteria } from '../entities/SearchCriteria';
import { ClientTag } from '../entities/Tag';
import RootStore from './RootStore';

/**
 * Based on https://mobx.js.org/best/store.html
 */
class TagStore {
  private readonly backend: DataStorage;
  private readonly rootStore: RootStore;

  /** A lookup map to speedup finding entities */
  private readonly tagGraph = observable(new Map<ID, ClientTag>());

  constructor(backend: DataStorage, rootStore: RootStore) {
    this.backend = backend;
    this.rootStore = rootStore;

    makeObservable(this);
  }

  async init(): Promise<void> {
    try {
      const fetchedTags = await this.backend.fetchTags();
      this.createTagGraph(fetchedTags);
    } catch (err) {
      console.log('Could not load tags', err);
    }
  }

  @action.bound initializeFileCounts(files: ClientFile[]): void {
    for (const file of files) {
      for (const fileTag of file.tags) {
        fileTag.incrementFileCount();
      }
    }
  }

  @action get(tag: ID): ClientTag | undefined {
    return this.tagGraph.get(tag);
  }

  @computed get root(): ClientTag {
    const root = this.tagGraph.get(ROOT_TAG_ID);
    if (!root) {
      throw new Error('Root tag not found. This should not happen!');
    }
    return root;
  }

  @computed get tagList(): readonly ClientTag[] {
    function* list(tags: ClientTag[]): Generator<ClientTag> {
      for (const tag of tags) {
        yield* tag.getSubTree();
      }
    }
    return Array.from(list(this.root.subTags));
  }

  @computed get count(): number {
    return this.tagList.length;
  }

  @computed get isEmpty(): boolean {
    return this.count === 0;
  }

  @action findFlatTagListIndex(target: ClientTag): number | undefined {
    const index = this.tagList.indexOf(target);
    return index > -1 ? index : undefined;
  }

  @action isSelected(tag: ClientTag): boolean {
    return this.rootStore.uiStore.tagSelection.has(tag);
  }

  isSearched(tag: ClientTag): boolean {
    return this.rootStore.uiStore.searchCriteriaList.some(
      (c) => c instanceof ClientTagSearchCriteria && c.value === tag.id,
    );
  }

  @action.bound async create(parent: ClientTag, tagName: string): Promise<ClientTag> {
    const id = generateId();
    const tag = new ClientTag(this, id, tagName, new Date(), '', false, true);
    this.tagGraph.set(tag.id, tag);
    tag.setParent(parent);
    parent.subTags.push(tag);
    await this.backend.createTag(tag.serialize());
    return tag;
  }

  @action findByName(name: string): ClientTag | undefined {
    return this.tagList.find((t) => t.name === name);
  }

  @action.bound async delete(tag: ClientTag): Promise<void> {
    const {
      rootStore: { uiStore, fileStore },
      tagGraph,
    } = this;
    const ids: ID[] = [];
    tag.parent.subTags.remove(tag);
    for (const t of tag.getSubTree()) {
      t.dispose();
      tagGraph.delete(t.id);
      uiStore.deselectTag(t);
      ids.push(t.id);
    }
    await this.backend.removeTags(ids);
    fileStore.refetch();
  }

  @action.bound async deleteTags(tags: ClientTag[]): Promise<void> {
    const {
      rootStore: { uiStore, fileStore },
      tagGraph,
    } = this;
    const ids: ID[] = [];
    const remove = action((tag: ClientTag): ID[] => {
      tag.parent.subTags.remove(tag);
      for (const t of tag.getSubTree()) {
        t.dispose();
        tagGraph.delete(t.id);
        uiStore.deselectTag(t);
        ids.push(t.id);
      }
      return ids.splice(0, ids.length);
    });
    for (const tag of tags) {
      await this.backend.removeTags(remove(tag));
    }
    fileStore.refetch();
  }

  @action.bound async merge(tagToBeRemoved: ClientTag, tagToMergeWith: ClientTag): Promise<void> {
    // not dealing with tags that have subtags
    if (tagToBeRemoved.subTags.length > 0) {
      throw new Error('Merging a tag with sub-tags is currently not supported.');
    }
    this.rootStore.uiStore.deselectTag(tagToBeRemoved);
    this.tagGraph.delete(tagToBeRemoved.id);
    tagToBeRemoved.parent.subTags.remove(tagToBeRemoved);
    await this.backend.mergeTags(tagToBeRemoved.id, tagToMergeWith.id);
    this.rootStore.fileStore.refetch();
  }

  @action.bound refetchFiles(): void {
    this.rootStore.fileStore.refetch();
  }

  save(tag: TagDTO): void {
    this.backend.saveTag(tag);
  }

  @action private createTagGraph(backendTags: TagDTO[]) {
    // Create tags
    for (const { id, name, dateAdded, color, isHidden, copyImpliedTags } of backendTags) {
      // Create entity and set properties
      // We have to do this because JavaScript does not allow multiple constructor.
      const tag = new ClientTag(this, id, name, dateAdded, color, isHidden, copyImpliedTags);
      // Add to index
      this.tagGraph.set(tag.id, tag);
    }

    // Set parent and add sub and implied tags
    for (const { id, subTags, impliedTags } of backendTags) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const tag = this.tagGraph.get(id)!;

      for (const id of subTags) {
        const subTag = this.get(id);
        if (subTag !== undefined) {
          subTag.setParent(tag);
          tag.subTags.push(subTag);
        }
      }

      for (const id of impliedTags) {
        const impliedTag = this.get(id);
        if (impliedTag !== undefined) {
          tag.impliedTags.push(impliedTag);
        }
      }
    }
    this.root.setParent(this.root);
  }
}

export default TagStore;
