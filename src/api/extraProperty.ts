import { ID } from './id';

export enum ExtraPropertyType {
  text = 'text',
  number = 'number',
}

//ToDo: Only support number and string for now, more types could be added in the future.
export type ExtraPropertyValue = number | string;

export type ExtraProperties = { [id: ID]: ExtraPropertyValue };

// ToDo: Add an "exifTag" property to specify the corresponding EXIF tag each custom ExtraProperty targets.
// This property should be made unique in Dexie to avoid duplicate mappings.
// Additionally, define a set of default extraProperties.
//
// Currently, all extraProperties are written to a custom XMP tag: 'XMP-xmp:ExtraProperties'.
// This tag stores a stringified object representing each extraProperty and its value assigned to a file.
export type ExtraPropertyDTO = {
  id: ID;
  type: ExtraPropertyType;
  name: string;
  dateAdded: Date;
};

export function detectExtraPropertyType(value: any): ExtraPropertyType | undefined {
  switch (typeof value) {
    case 'string':
      return ExtraPropertyType.text;
    case 'number':
      return ExtraPropertyType.number;
    default:
      return undefined;
  }
}

export function getExtraPropertyDefaultValue(type: ExtraPropertyType): ExtraPropertyValue {
  switch (type) {
    case ExtraPropertyType.number:
      return 0;
    case ExtraPropertyType.text:
      return '';
    default:
      throw new Error(`Unsupported type: ${type}`);
  }
}
