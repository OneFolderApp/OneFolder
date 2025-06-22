import { ID } from './id';

export const ROOT_TAG_ID = 'root';

export type TagDTO = {
  id: ID;
  name: string;
  dateAdded: Date;
  color: string;
  subTags: ID[];
  impliedTags: ID[];
  /** Whether any files with this tag should be hidden */
  isHidden: boolean;
  skipInherit: boolean;
};
