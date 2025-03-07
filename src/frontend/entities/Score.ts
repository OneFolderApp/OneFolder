import { action, IReactionDisposer, makeObservable, observable, reaction } from 'mobx';

import { ID } from '../../api/id';
import ScoreStore from '../stores/ScoreStore';
import { ScoreDTO } from '../../api/score';

/**
 * Represents a Score object in the client-side MobX store.
 */
export class ClientScore {
  private store: ScoreStore;
  private saveHandler: IReactionDisposer;

  readonly id: ID;
  readonly name: string;
  readonly dateCreated: Date;
  readonly dateModified: Date;

  @observable notes: string = '';

  constructor(store: ScoreStore, id: ID, name: string, dateCreated: Date, dateModified: Date) {
    this.store = store;
    this.id = id;
    this.name = name;
    this.dateCreated = dateCreated;
    this.dateModified = dateModified;

    this.saveHandler = reaction(
      () => this.serialize(),
      (score) => {
        this.store.save(score);
      },
      { delay: 500 },
    );

    makeObservable(this);
  }

  @action.bound setNotes(notes: string): void {
    this.notes = notes;
  }

  serialize(): ScoreDTO {
    return {
      id: this.id,
      name: this.name,
      dateCreated: this.dateCreated,
      dateModified: this.dateModified,
    };
  }

  dispose(): void {
    this.saveHandler();
  }
}
