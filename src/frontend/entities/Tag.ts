import { IReactionDisposer, action, computed, makeObservable, observable, reaction } from 'mobx';

import { MAX_TAG_DEPTH } from '../../../common/config';
import { ID } from '../../api/id';
import { ROOT_TAG_ID, TagDTO } from '../../api/tag';
import TagStore from '../stores/TagStore';

/**
 * A Tag as it is stored in the Client.
 * It is stored in a MobX store, which can observe changed made to it and subsequently
 * update the entity in the backend.
 */
export class ClientTag {
  private store: TagStore;
  private saveHandler: IReactionDisposer;

  readonly id: ID;
  readonly dateAdded: Date;
  @observable name: string;
  @observable color: string;
  @observable isHidden: boolean;
  @observable private _parent: ClientTag | undefined;
  readonly subTags = observable<ClientTag>([]);
  @observable private _impliedByTags = observable<ClientTag>([]);
  @observable impliedTags = observable<ClientTag>([]);
  @observable copyImpliedTags: boolean;

  // icon, (fileCount?)

  /** The amount of files that has this tag assigned to it
   * TODO: would be nice to have the amount of files assigned to any of this tag's subtags too,
   * but we can't simply sum them, since there might be duplicates.
   * We'd need a Set of file-ids on every tag, and maintain them when a tag's parent changes.
   */
  @observable fileCount: number;

  constructor(
    store: TagStore,
    id: ID,
    name: string,
    dateAdded: Date,
    color: string,
    isHidden: boolean,
    copyImpliedTags: boolean,
  ) {
    this.store = store;
    this.id = id;
    this.dateAdded = dateAdded;
    this.name = name;
    this.color = color;
    this.fileCount = 0;
    this.isHidden = isHidden;
    this.copyImpliedTags = copyImpliedTags;

    // observe all changes to observable fields
    this.saveHandler = reaction(
      // We need to explicitly define which values this reaction should react to
      () => this.serialize(),
      // Then update the entity in the database
      (tag) => {
        this.store.save(tag);
      },
      { delay: 500 },
    );

    makeObservable(this);
  }

  /** Get actual tag objects based on the IDs retrieved from the backend */
  @computed get parent(): ClientTag {
    if (this._parent === undefined) {
      console.warn('Tag does not have a parent', this);
      return this.store.root;
    }
    return this._parent;
  }

  /** Get actual tag objects based on the IDs retrieved from the backend */
  @computed get getImpliedByTags(): ClientTag[] {
    return this._impliedByTags;
  }

  /** Returns this tag and all of its sub-tags ordered depth-first */
  @action getSubTree(): Generator<ClientTag> {
    function* tree(tag: ClientTag, depth: number): Generator<ClientTag> {
      if (depth > MAX_TAG_DEPTH) {
        console.error('Subtree has too many tags. Is there a cycle in the tag tree?', tag);
        return;
      }

      yield tag;
      for (const subTag of tag.subTags) {
        yield* tree(subTag, depth + 1);
      }
    }
    return tree(this, 0);
  }

  /** Returns this tag and all of its "implied By" sub-tags and their sub-tags ordered depth-first */
  @action getImpliedSubTree(): Generator<ClientTag> {
    function* tree(tag: ClientTag, depth: number): Generator<ClientTag> {
      if (depth > MAX_TAG_DEPTH) {
        console.error('Subtree has too many tags. Is there a cycle in the tag tree?', tag);
        return;
      }

      yield tag;
      for (const subTag of tag.subTags) {
        yield* tree(subTag, depth + 1);
      }
      for (const subTag of tag._impliedByTags) {
        yield* tree(subTag, depth + 1);
      }
    }
    return tree(this, 0);
  }

  /** Returns this tag and all its ancestors (excluding root tag). */
  @action getAncestors(): Generator<ClientTag> {
    function* ancestors(tag: ClientTag, depth: number): Generator<ClientTag> {
      if (depth > MAX_TAG_DEPTH) {
        console.error('Tag has too many ancestors. Is there a cycle in the tag tree?', tag.name);
      } else if (tag.id !== ROOT_TAG_ID) {
        yield tag;
        yield* ancestors(tag.parent, depth + 1);
      }
    }
    return ancestors(this, 0);
  }

  /** Returns this tag and all its implied ancestors (excluding root tag). */
  @action getImpliedAncestors(): Generator<ClientTag> {
    function* ancestors(tag: ClientTag, depth: number): Generator<ClientTag> {
      if (depth > MAX_TAG_DEPTH) {
        console.error('Tag has too many ancestors. Is there a cycle in the implied tag tree?', tag.name);
      } else if (tag.id !== ROOT_TAG_ID) {
        yield tag;
        yield* ancestors(tag.parent, depth + 1);
        for (const impliedTag of tag.impliedTags) {
          yield* ancestors(impliedTag, depth + 1);
        }
      }
    }
    return ancestors(this, 0);
  }

  /** Returns the tags up the hierarchy from this tag, excluding the root tag */
  @computed get path(): string[] {
    return Array.from(this.getAncestors(), (t) => t.name).reverse();
  }

  get isSelected(): boolean {
    return this.store.isSelected(this);
  }

  @computed get viewColor(): string {
    for (const tag of this.getAncestors()) {
      if (tag.color !== 'inherit') {
        return tag.color;
      }
    }
    return this.color;
  }

  @computed get isSearched(): boolean {
    return this.store.isSearched(this);
  }

  /**
   * Returns true if tag is an ancestor of this tag.
   * @param tag possible ancestor node
   */
  @action isAncestor(tag: ClientTag): boolean {
    if (this === tag) {
      return false;
    }
    for (const ancestor of this.parent.getAncestors()) {
      if (ancestor === tag) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns true if tag is an implied ancestor of this tag.
   * @param tag possible ancestor node
   */
  @action isImpliedAncestor(tag: ClientTag): boolean {
    if (this === tag) {
      return false;
    }
    for (const ancestor of this.getImpliedAncestors()) {
      if (ancestor === tag) {
        return true;
      }
    }
    return false;
  }

  @action setParent(parent: ClientTag): void {
    this._parent = parent;
  }

  @action addImpliedByTag(tag: ClientTag): void {
    this._impliedByTags.push(tag);
  }

  @action.bound rename(name: string): void {
    this.name = name;
  }

  @action.bound setColor(color: string): void {
    this.color = color;
  }

  @action.bound insertSubTag(tag: ClientTag, at: number): boolean {
    if (this === tag || this.isAncestor(tag) || tag.id === ROOT_TAG_ID) {
      return false;
    }
    // Move to different pos in same parent: Reorder tag.subTags and return
    if (this === tag.parent) {
      const currentIndex = this.subTags.indexOf(tag);
      if (currentIndex !== at && at >= 0 && at <= this.subTags.length) {
        // If moving below current position, take into account removing self affecting the index
        const newIndex = currentIndex < at ? at - 1 : at;
        this.subTags.remove(tag);
        this.subTags.splice(newIndex, 0, tag);
      }
    } else {
      // Insert subTag into tag
      tag.parent.subTags.remove(tag);
      if (at >= 0 && at < this.subTags.length) {
        this.subTags.splice(at, 0, tag);
      } else {
        this.subTags.push(tag);
      }
      tag.setParent(this);
    }
    return true;
  }

  @action.bound replaceImpliedTags(newTags: ClientTag[]): void {
    //convert to set for efficient comparison and avoid duplicates
    const newTagsSet = new Set(newTags);

    for (const tag of this.impliedTags.slice()) {
      if (!newTagsSet.has(tag)) {
        this.removeImpliedTag(tag);
      }
    }

    for (const tag of newTags) {
      if (!this.impliedTags.includes(tag)) {
        this.addImpliedTag(tag);
      }
    }
  }

  @action.bound replaceImpliedByTags(newTags: ClientTag[]): void {
    //convert to set for efficient comparison and avoid duplicates
    const newTagsSet = new Set(newTags);

    for (const tag of this._impliedByTags.slice()) {
      if (!newTagsSet.has(tag)) {
        tag.removeImpliedTag(this);
      }
    }

    for (const tag of newTags) {
      if (!this._impliedByTags.includes(tag)) {
        tag.addImpliedTag(this);
      }
    }
  }

  @action.bound addImpliedTag(tag: ClientTag): void {
    if (!this.impliedTags.includes(tag)) {
      this.impliedTags.push(tag);
      tag._impliedByTags.push(this);
    }
    this.store.refetchFiles();
  }

  @action.bound removeImpliedTag(tag: ClientTag): void {
    const index = this.impliedTags.indexOf(tag);
    const ipliedBy_index = tag._impliedByTags.indexOf(this);
    console.log(`${tag.name}: ${ipliedBy_index}`);
    if (index !== -1) {
      this.impliedTags.splice(index, 1);
    }
    if (ipliedBy_index !== -1) {
      tag._impliedByTags.splice(ipliedBy_index, 1);
    }
    this.store.refetchFiles();
  }

  @action.bound incrementFileCount(amount = 1): void {
    this.fileCount += amount;
  }

  @action.bound decrementFileCount(amount = 1): void {
    this.fileCount -= amount;
  }

  @action.bound toggleHidden(): void {
    this.isHidden = !this.isHidden;
    this.store.refetchFiles();
  }

  serialize(): TagDTO {
    return {
      id: this.id,
      name: this.name,
      dateAdded: this.dateAdded,
      color: this.color,
      subTags: this.subTags.map((subTag) => subTag.id),
      isHidden: this.isHidden,
      impliedTags: this.impliedTags.map((impliedTag) => impliedTag.id),
      copyImpliedTags: true,
    };
  }

  async delete(): Promise<void> {
    return this.store.delete(this);
  }

  dispose(): void {
    // clean up the observer
    this.saveHandler();
  }
}
