import { ID } from './id';

export const ROOT_TAG_ID = 'root';
export const PEOPLE_TAG_NAME = 'People';

export type TagDTO = {
  id: ID;
  name: string;
  dateAdded: Date;
  color: string;
  subTags: ID[];
  /** Whether any files with this tag should be hidden */
  isHidden: boolean;
  isAi: boolean;
};
