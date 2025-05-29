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

export const FileScoreEditorButton = () => {
  const { uiStore } = useStore();
  return (
    <>
      <ToolbarButton
        id="file-scores-editor-button"
        icon={IconSet.META_INFO}
        onClick={uiStore.toggleFileScoresEditor}
        text="Score selected files"
        tooltip="Add or remove scores from selected images"
      />
    </>
  );
};
