import { ID } from './id';

export type LocationDTO = {
  id: ID;
  path: string;
  dateAdded: Date;
  subLocations: SubLocationDTO[];
  tags: ID[];
  index: number;
};

export type SubLocationDTO = {
  name: string;
  isExcluded: boolean;
  subLocations: SubLocationDTO[];
  tags: ID[];
};
