import React from 'react';
import { useStore } from 'src/frontend/contexts/StoreContext';
import { IconSet } from 'widgets/icons';
import { ToolbarButton } from 'widgets/toolbar';

export const FileTagEditorButton = () => {
  const { uiStore } = useStore();
  return (
    <>
      <ToolbarButton
        id="file-tags-editor-button"
        icon={IconSet.TAG_LINE}
        onClick={uiStore.toggleFileTagsEditor}
        text="Tag selected files"
        tooltip="Add or remove tags from selected images"
      />
    </>
  );
};

export const FileExtraPropertiesEditorButton = () => {
  const { uiStore } = useStore();
  return (
    <>
      <ToolbarButton
        id="file-extra-properties-editor-button"
        icon={IconSet.OUTLINER4}
        onClick={uiStore.toggleFileExtraPropertiesEditor}
        text="File extra properties"
        tooltip="Add or remove extra properties from selected images"
      />
    </>
  );
};
