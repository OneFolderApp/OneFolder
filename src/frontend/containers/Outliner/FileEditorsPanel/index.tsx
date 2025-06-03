import React, { useRef } from 'react';
import { useStore } from 'src/frontend/contexts/StoreContext';
import { FloatingPanel } from 'widgets/FloatingPanel';
import { FileExtraPropertiesEditor } from 'src/frontend/components/FileExtraPropertiesEditor';
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
    if (uiStore.isFileExtraPropertiesEditorOpen) {
      return {
        type: 'extra-properties',
        isOpen: true,
        title: 'Extra File Properties Editor',
        content: (
          <FileExtraPropertiesEditor
            addButtonContainerID="file-editors-panel-header"
            menuPlacement="right-start"
          />
        ),
        onBlur: uiStore.closeFileExtraPropertiesEditor,
        ignoreOnBlur: (e: React.FocusEvent) => {
          return e.relatedTarget?.id === 'file-extra-properties-editor-button';
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
