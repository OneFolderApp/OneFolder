import { action, IReactionDisposer, makeObservable, observable, reaction } from 'mobx';

import { ID } from '../../api/id';
import ExtraPropertyStore from '../stores/ExtraPropertyStore';
import { ExtraPropertyDTO, ExtraPropertyType } from '../../api/extraProperty';

/**
 * Represents a ExtraProperty object in the client-side MobX store.
 */
export class ClientExtraProperty {
  private store: ExtraPropertyStore;
  private saveHandler: IReactionDisposer;

  readonly id: ID;
  @observable name: string = '';
  readonly type: ExtraPropertyType;
  readonly dateAdded: Date;

  constructor(
    store: ExtraPropertyStore,
    id: ID,
    type: ExtraPropertyType,
    name: string,
    dateAdded: Date,
  ) {
    this.store = store;
    this.id = id;
    this.type = type;
    this.name = name;
    this.dateAdded = dateAdded;

    makeObservable(this);
    // observe all changes to observable fields
    this.saveHandler = reaction(
      // We need to explicitly define which values this reaction should react to
      () => this.serialize(),
      // Then update the entity in the database
      (extraProperty) => {
        this.store.save(extraProperty);
      },
      { delay: 500 },
    );
  }

  @action.bound rename(name: string): void {
    this.name = name;
  }

  async delete(): Promise<void> {
    return this.store.deleteExtraProperty(this);
  }

  serialize(): ExtraPropertyDTO {
    return {
      id: this.id,
      type: this.type,
      name: this.name,
      dateAdded: this.dateAdded,
    };
  }

  dispose(): void {
    this.saveHandler();
  }
}
