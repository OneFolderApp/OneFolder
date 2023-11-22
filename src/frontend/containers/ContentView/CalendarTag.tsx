import React, { useMemo } from 'react';

import { getColorFromBackground } from '../../../../widgets/utility/color';

import { ClientFile } from '../../entities/File';
import { formatDate, formatDateTimeShort } from 'common/fmt';

export const CalendarTag = ({ file, isSelected }: { file: ClientFile; isSelected: boolean }) => {
  const tag = {
    name: isSelected ? formatDateTimeShort(file.dateCreated) : formatDate(file.dateCreated),
    viewColor: '#d9534fdd',
  };
  return (
    <span className="calendar-tag thumbnail-tags">
      <TagWithHint tag={tag} />
    </span>
  );
};

type CalendarTag = {
  name: string;
  viewColor: string;
};

const TagWithHint = ({ tag }: { tag: CalendarTag }) => {
  return <Tag text={tag.name} color={tag.viewColor} />;
};

interface TagProps {
  text: string;
  /** background-color in CSS */
  color?: string;
  className?: string;
}

const Tag = (props: TagProps) => {
  const { text, color, className } = props;

  const style = useMemo(
    () => (color ? { backgroundColor: color, color: getColorFromBackground(color) } : undefined),
    [color],
  );

  return (
    <span className={`tag ${className || ''}`} style={style}>
      <span className="label" title={text}>
        {text}
      </span>
    </span>
  );
};
