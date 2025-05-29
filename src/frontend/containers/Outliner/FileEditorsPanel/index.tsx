import React, { useRef } from 'react';
import { useStore } from 'src/frontend/contexts/StoreContext';
import { FloatingPanel } from 'widgets/FloatingPanel';
import { FileScoresEditor } from 'src/frontend/components/FileScoresEditor';
import { FileTagsEditor } from 'src/frontend/components/FileTagsEditor';
import { observer } from 'mobx-react-lite';
import { MultiSplitPaneProps } from 'widgets/MultiSplit/MultiSplitPane';

const defaultPanel = {
  type: 'none',
  title: '---',
  isOpen: false,
  onBlur: () => {},
  ignoreOnBlur: (e: React.FocusEvent) => {
    void e;
    return false;
  },
  content: <></>,
};

const FileEditorsPanel = observer(({ className }: Partial<MultiSplitPaneProps>) => {
  const { uiStore } = useStore();

  const getActivePanel = useRef((): typeof defaultPanel => {
    if (uiStore.isFileTagsEditorOpen) {
      return {
        type: 'tags',
        isOpen: true,
        title: 'File Tags Editor',
        content: <FileTagsEditor />,
        onBlur: uiStore.closeFileTagsEditor,
        ignoreOnBlur: (e: React.FocusEvent) => {
          return e.relatedTarget?.id === 'file-tags-editor-button';
        },
      };
    }
    if (uiStore.isFileScoresEditorOpen) {
      return {
        type: 'score',
        isOpen: true,
        title: 'Score Editor',
        content: <FileScoresEditor />,
        onBlur: uiStore.closeFileScoresEditor,
        ignoreOnBlur: (e: React.FocusEvent) => {
          return e.relatedTarget?.id === 'file-scores-editor-button';
        },
      };
    }

    return defaultPanel;
  }).current;

  const activePanel = getActivePanel();

  return (
    <FloatingPanel
      id="file-editors-panel"
      type={activePanel.type}
      title={activePanel.title}
      dataOpen={activePanel.isOpen}
      isDocked={uiStore.areFileEditorsDocked}
      onBlur={activePanel.onBlur}
      ignoreOnBlur={activePanel.ignoreOnBlur}
      onToggleDock={uiStore.toggleFileEditorsDocked}
      className={className}
      children={activePanel.content}
    />
  );
});

export default FileEditorsPanel;
