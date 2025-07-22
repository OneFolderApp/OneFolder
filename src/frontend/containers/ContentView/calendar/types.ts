import { ClientFile } from '../../../entities/File';

export interface MonthGroup {
  id: string; // "2024-03"
  displayName: string; // "March 2024"
  year: number;
  month: number; // 0-11 (JavaScript date month)
  photos: ClientFile[];
}

export interface PhotoItemProps {
  photo: ClientFile;
  isFocused: boolean;
  isSelected: boolean;
  onClick: (photo: ClientFile, event: React.MouseEvent) => void;
}

export interface MonthSectionProps {
  group: MonthGroup;
  containerWidth: number;
  onPhotoSelect: (photo: ClientFile, additive: boolean, range: boolean) => void;
  focusedPhotoId?: string;
}
