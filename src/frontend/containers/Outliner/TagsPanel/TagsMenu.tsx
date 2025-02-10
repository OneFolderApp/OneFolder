import React, { useCallback } from 'react';
import { Menu, MenuDivider, MenuItem } from 'widgets/menus';
import { IconSet } from 'widgets';
import { useContextMenu } from 'widgets/menus';

interface TagsMenuProps {
  onSortAscending: () => void;
  onSortDescending: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
}

const TagsMenu: React.FC<TagsMenuProps> = ({
  onSortAscending,
  onSortDescending,
  onCollapseAll,
  onExpandAll,
}) => {
  const showContextMenu = useContextMenu();

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(
        e.clientX,
        e.clientY,
        <Menu>
          <MenuItem text="Sort A-Z" icon={IconSet.FILTER_NAME_DOWN} onClick={onSortAscending} />
          <MenuItem text="Sort Z-A" icon={IconSet.FILTER_NAME_UP} onClick={onSortDescending} />
          <MenuDivider />
          <MenuItem text="Collapse All" icon={IconSet.TAG_GROUP} onClick={onCollapseAll} />
          <MenuItem text="Expand All" icon={IconSet.TAG_GROUP_OPEN} onClick={onExpandAll} />
        </Menu>,
      );
    },
    [showContextMenu, onSortAscending, onSortDescending, onCollapseAll, onExpandAll],
  );

  return (
    <button onClick={handleClick} title="More options">
      {IconSet.MORE}
    </button>
  );
};

export default TagsMenu;
