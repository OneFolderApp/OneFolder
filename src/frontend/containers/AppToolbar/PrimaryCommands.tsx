import { observer } from 'mobx-react-lite';
import React from 'react';

import { IconSet } from 'widgets';
import { ToolbarButton } from 'widgets/toolbar';
import { FileRemoval } from '../../components/RemovalAlert';
import FileTagEditor from '../../containers/AppToolbar/FileTagEditor';
import { useStore } from '../../contexts/StoreContext';
import { SortCommand } from './Menus';
import Searchbar from './Searchbar';
import { MenuRadioItem } from 'widgets/menus';
import SecondaryCommands from './SecondaryCommands';

const OutlinerToggle = observer(() => {
  const { uiStore } = useStore();

  return (
    <ToolbarButton
      id="outliner-toggle"
      text="Toggle Outliner"
      icon={uiStore.isOutlinerOpen ? IconSet.DOUBLE_CARET : IconSet.MENU_HAMBURGER}
      controls="outliner"
      pressed={uiStore.isOutlinerOpen}
      onClick={uiStore.toggleOutliner}
      tabIndex={0}
    />
  );
});

const PrimaryCommands = observer(() => {
  const { fileStore } = useStore();
  const { uiStore } = useStore();

  return (
    <div className="primary-commands">
      <div className="primary-commands__top">
        <OutlinerToggle />
        <FileSelectionCommand />

        <Searchbar />

        {/* TODO: Put back tag button (or just the T hotkey) */}
        {fileStore.showsMissingContent ? (
          // Only show option to remove selected files in toolbar when viewing missing files */}
          <RemoveFilesPopover />
        ) : (
          // Only show when not viewing missing files (so it is replaced by the Delete button)
          <FileTagEditor />
        )}

        {/* <ViewCommand /> */}
        <SecondaryCommands />
      </div>
      <div className="primary-commands__bottom">
        <div className="primary-commands__bottom__left">
          <MenuRadioItem
            icon={IconSet.VIEW_LIST}
            onClick={uiStore.setMethodList}
            checked={uiStore.isList}
            text="List"
          />
          <MenuRadioItem
            icon={IconSet.VIEW_GRID}
            onClick={uiStore.setMethodGrid}
            checked={uiStore.isGrid}
            text="Grid"
          />
          <MenuRadioItem
            icon={IconSet.FILTER_DATE}
            onClick={uiStore.setMethodCalendar}
            checked={uiStore.isCalendar}
            text="Calendar"
          />
          <MenuRadioItem
            icon={IconSet.FACE_SMILING}
            onClick={uiStore.setMethodCalendar}
            checked={false}
            disabled={true}
            text="Faces (WIP)"
          />
          <MenuRadioItem
            icon={IconSet.WORLD}
            onClick={uiStore.setMethodCalendar}
            checked={false}
            disabled={true}
            text="Map (WIP)"
          />
        </div>
        <SortCommand />
      </div>
    </div>
  );
});

export default PrimaryCommands;

export const SlideModeCommand = observer(() => {
  const { uiStore } = useStore();
  return (
    <>
      <ToolbarButton
        isCollapsible={false}
        icon={IconSet.ARROW_LEFT}
        onClick={uiStore.disableSlideMode}
        text="Back"
        tooltip="Back to content panel"
      />

      <div className="spacer" />

      <FileTagEditor />

      <ToolbarButton
        icon={IconSet.INFO}
        onClick={uiStore.toggleInspector}
        checked={uiStore.isInspectorOpen}
        text="Toggle the inspector panel"
        tooltip="Toggle the inspector panel"
      />
    </>
  );
});

const FileSelectionCommand = observer(() => {
  const { uiStore, fileStore } = useStore();
  const selectionCount = uiStore.fileSelection.size;
  const fileCount = fileStore.fileList.length;

  const allFilesSelected = fileCount > 0 && selectionCount === fileCount;
  // If everything is selected, deselect all. Else, select all
  const handleToggleSelect = () => {
    selectionCount === fileCount ? uiStore.clearFileSelection() : uiStore.selectAllFiles();
  };

  return (
    <ToolbarButton
      isCollapsible={false}
      icon={allFilesSelected ? IconSet.SELECT_ALL_CHECKED : IconSet.SELECT_ALL}
      onClick={handleToggleSelect}
      pressed={allFilesSelected}
      text={selectionCount}
      tooltip="Selects or deselects all images"
      disabled={fileCount === 0}
    />
  );
});

const RemoveFilesPopover = observer(() => {
  const { uiStore } = useStore();
  return (
    <>
      <ToolbarButton
        icon={IconSet.DELETE}
        disabled={uiStore.fileSelection.size === 0}
        onClick={uiStore.openToolbarFileRemover}
        text="Delete"
        tooltip="Delete selected missing images from library"
      />
      <FileRemoval />
    </>
  );
});
