import { action, computed, makeObservable, observable } from 'mobx';
import { DataStorage } from '../../api/data-storage';
import { ExtraPropertyDTO, ExtraPropertyType } from '../../api/extraProperty';
import { generateId, ID } from '../../api/id';
import { ClientExtraProperty } from '../entities/ExtraProperty';
import RootStore from './RootStore';
import { ClientFile } from '../entities/File';

class ExtraPropertyStore {
  private readonly backend: DataStorage;
  private readonly rootStore: RootStore;

  private readonly extraPropertiesMap = observable(new Map<ID, ClientExtraProperty>());

  constructor(backend: DataStorage, rootStore: RootStore) {
    this.backend = backend;
    this.rootStore = rootStore;

    makeObservable(this);
  }

  async init(): Promise<void> {
    try {
      const fetchedExtraProperties = await this.backend.fetchExtraProperties();
      for (const sp of fetchedExtraProperties) {
        const extraProperty = new ClientExtraProperty(this, sp.id, sp.type, sp.name, sp.dateAdded);
        this.extraPropertiesMap.set(extraProperty.id, extraProperty);
      }
    } catch (err) {
      console.log('Could not load extraProperties', err);
    }
  }

  @action get(id: string): ClientExtraProperty | undefined {
    return this.extraPropertiesMap.get(id);
  }

  @action getByNameAndType(name: string, type: ExtraPropertyType): ClientExtraProperty | undefined {
    for (const [, extraProperty] of this.extraPropertiesMap) {
      if (extraProperty.name === name && extraProperty.type === type) {
        return extraProperty;
      }
    }
    return undefined;
  }

  @computed get extraPropertiesList(): readonly ClientExtraProperty[] {
    return Array.from(this.extraPropertiesMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  @computed get count(): number {
    return this.extraPropertiesMap.size;
  }

  @computed get isEmpty(): boolean {
    return this.count === 0;
  }

  @action.bound async createExtraProperty(
    propertyName: string,
    type: ExtraPropertyType,
  ): Promise<ClientExtraProperty> {
    const id = generateId();
    const extraProperty = new ClientExtraProperty(this, id, type, propertyName, new Date());
    this.extraPropertiesMap.set(extraProperty.id, extraProperty);
    await this.backend.createExtraProperty(extraProperty.serialize());
    return extraProperty;
  }

  @action.bound async deleteExtraProperty(extraProperty: ClientExtraProperty): Promise<void> {
    this.extraPropertiesMap.delete(extraProperty.id);
    extraProperty.dispose();
    await this.backend.removeExtraProperties([extraProperty.id]);
    this.rootStore.fileStore.refetch();
  }

  @action.bound removeFromFiles(files: ClientFile[], extraProperty: ClientExtraProperty): void {
    files.forEach((f) => f.removeExtraProperty(extraProperty));
  }

  @action.bound setOnFiles(
    files: ClientFile[],
    extraProperty: ClientExtraProperty,
    value: number,
  ): void {
    files.forEach((f) => f.setExtraProperty(extraProperty, value));
  }

  save(extraProperty: ExtraPropertyDTO): void {
    this.backend.saveExtraProperty(extraProperty);
  }
}

export default ExtraPropertyStore;
