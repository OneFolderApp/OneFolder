import { observer } from 'mobx-react-lite';
import React, { useCallback } from 'react';

import { Row } from 'widgets';
import { IconSet } from 'widgets/icons';
import { Menu, useContextMenu } from 'widgets/menus';
import { FileTagMenuItems } from '../containers/ContentView/menu-items';
import { useStore } from '../contexts/StoreContext';
import { ClientFile } from '../entities/File';
import { ClientTag } from '../entities/Tag';
import { TagSelector } from './TagSelector';

interface IFileTagProp {
  file?: ClientFile;
}

const FileTags = observer(({ file }: IFileTagProp) => {
  const { tagStore } = useStore();

  const renderCreateOption = useCallback(
    (tagName: string, resetTextBox: () => void) => (
      <Row
        id="file-tags-create-option"
        index={0}
        key="create"
        value={`Create tag "${tagName}"`}
        icon={IconSet.TAG_ADD}
        onClick={async () => {
          const tag = await tagStore.create(tagStore.root, tagName);
          if (file) {
            file.addTag(tag);
          }
          resetTextBox();
        }}
      />
    ),
    [file, tagStore],
  );

  const show = useContextMenu();
  const handleTagContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, tag: ClientTag) => {
      event.stopPropagation();
      show(
        event.clientX,
        event.clientY,
        <Menu>
          <FileTagMenuItems file={file} tag={tag} />
        </Menu>,
      );
    },
    [file, show],
  );

  if (!file) {
    return <></>;
  }

  const isExplicitEntries = file.sortedInheritedTags.map(
    (t) => [t, file.tags.has(t)] as [ClientTag, boolean],
  );

  return (
    <TagSelector
      disabled={file.isBroken}
      selection={isExplicitEntries}
      onClear={file.clearTags}
      onDeselect={file.removeTag}
      onSelect={file.addTag}
      renderCreateOption={renderCreateOption}
      showTagContextMenu={handleTagContextMenu}
      multiline
    />
  );
});

export default FileTags;
