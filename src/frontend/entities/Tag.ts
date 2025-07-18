import { IReactionDisposer, action, computed, makeObservable, observable, reaction } from 'mobx';

import { MAX_TAG_DEPTH } from '../../../common/config';
import { ID } from '../../api/id';
import { PEOPLE_TAG_NAME, ROOT_TAG_ID, TagDTO } from '../../api/tag';
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
  ) {
    this.store = store;
    this.id = id;
    this.dateAdded = dateAdded;
    this.name = name;
    this.color = color;
    this.fileCount = 0;
    this.isHidden = isHidden;

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

  @computed get isPeopleTag(): boolean {
    return this._parent?.name === PEOPLE_TAG_NAME;
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

  /** Returns this tag and all its ancestors (excluding root tag). */
  @action getAncestors(): Generator<ClientTag> {
    function* ancestors(tag: ClientTag, depth: number): Generator<ClientTag> {
      if (depth > MAX_TAG_DEPTH) {
        console.error('Tag has too many ancestors. Is there a cycle in the tag tree?', tag);
      } else if (tag.id !== ROOT_TAG_ID) {
        yield tag;
        yield* ancestors(tag.parent, depth + 1);
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

  @action setParent(parent: ClientTag): void {
    this._parent = parent;
  }

  @action.bound rename(name: string): void {
    const oldName = this.name;
    this.name = name;

    // Update metadata in all files that have this tag OR any of its descendant tags
    if (oldName !== name) {
      console.log(`Renaming tag "${oldName}" to "${name}"`);

      // Get this tag and all its descendants (children, grandchildren, etc.)
      const allAffectedTags = Array.from(this.getSubTree());
      console.log(
        'Affected tags (including descendants):',
        allAffectedTags.map((t) => t.name),
      );

      // Update metadata for files with each affected tag
      for (const tag of allAffectedTags) {
        console.log(
          `Updating metadata for files with tag "${tag.name}" (new path: [${tag.path.join(
            ' > ',
          )}])`,
        );
        this.store.updateMetadataForTag(tag);
      }
    }
  }

  @action.bound setColor(color: string): void {
    this.color = color;
  }

  @action.bound insertSubTag(tag: ClientTag, at: number): boolean {
    if (this === tag || this.isAncestor(tag) || tag.id === ROOT_TAG_ID) {
      return false;
    }

    const oldParentName = tag.parent.name;
    const newParentName = this.name;
    let hierarchyChanged = false;

    console.log(
      `Moving tag "${tag.name}" from parent "${oldParentName}" to parent "${newParentName}"`,
    );
    console.log(`Old hierarchy: [${tag.path.join(' > ')}]`);

    // Move to different pos in same parent: Reorder tag.subTags and return
    if (this === tag.parent) {
      const currentIndex = this.subTags.indexOf(tag);
      if (currentIndex !== at && at >= 0 && at <= this.subTags.length) {
        // If moving below current position, take into account removing self affecting the index
        const newIndex = currentIndex < at ? at - 1 : at;
        this.subTags.remove(tag);
        this.subTags.splice(newIndex, 0, tag);
        console.log('Reordered within same parent - no hierarchy change needed');
      }
    } else {
      // Insert subTag into tag - this changes the hierarchy
      hierarchyChanged = true;
      tag.parent.subTags.remove(tag);
      if (at >= 0 && at < this.subTags.length) {
        this.subTags.splice(at, 0, tag);
      } else {
        this.subTags.push(tag);
      }
      tag.setParent(this);

      console.log(`New hierarchy: [${tag.path.join(' > ')}]`);
      console.log(`Hierarchy changed: ${hierarchyChanged}`);
    }

    // Update metadata in all files that have this tag if hierarchy changed
    // Use setTimeout to ensure the parent relationship and computed path are fully updated
    if (hierarchyChanged) {
      console.log(`Scheduling metadata update for moved tag "${tag.name}" and all its descendants`);
      setTimeout(() => {
        console.log(`Executing metadata update for moved tag "${tag.name}" with new path`);

        // Get the moved tag and all its descendants (children, grandchildren, etc.)
        const allAffectedTags = Array.from(tag.getSubTree());
        console.log('All affected tags count:', allAffectedTags.length);

        // Update metadata for files with each affected tag
        for (const affectedTag of allAffectedTags) {
          console.log('Updating metadata for files with tag:', affectedTag.name);
          this.store.updateMetadataForTag(affectedTag);
        }
      }, 100);
    }

    return true;
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
