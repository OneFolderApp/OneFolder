import { ID } from './id';

export type ScoreDTO = {
  id: ID;
  name: string;
  dateCreated: Date;
  dateModified: Date;
};

export type FileScoreDTO = {
  fileId: ID;
  scoreId: ID;
  value: number;
};
