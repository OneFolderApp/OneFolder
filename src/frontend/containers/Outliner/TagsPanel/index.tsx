import { observer } from 'mobx-react-lite';
import React, { useState } from 'react';

import { IconSet } from 'widgets';
import { MultiSplitPaneProps } from 'widgets/MultiSplit/MultiSplitPane';
import { Alert, DialogButton } from 'widgets/popovers';
import { Toolbar, ToolbarButton } from 'widgets/toolbar';
import { useStore } from '../../../contexts/StoreContext';
import { useAction } from '../../../hooks/mobx';
import { comboMatches, getKeyCombo, parseKeyCombo } from '../../../hotkeyParser';
import TagsTree from './TagsTree';

// Tooltip info
const enum TooltipInfo {
  AllImages = 'View all images in library',
  Untagged = 'View all untagged images',
  Missing = 'View missing images on your system',
  ReIndex = 'Re-index all files in library',
}

export const OutlinerActionBar = observer(() => {
  const { fileStore } = useStore();
  const [showReIndexModal, setShowReIndexModal] = useState(false);

  const handleReIndexConfirm = (button: DialogButton) => {
    setShowReIndexModal(false);
    if (button === DialogButton.PrimaryButton) {
      // TODO: Implement actual re-indexing functionality
      console.log('Re-indexing would start here...');
    } else if (button === DialogButton.SecondaryButton) {
      // Export tags to metadata first
      fileStore.writeTagsToFiles();
    }
  };

  return (
    <>
      <Toolbar id="actionbar" label="Action Bar" controls="content-view">
        <div>
          {/* <ToolbarButton
            text=""
            icon={IconSet.RELOAD}
            onClick={handleReIndexClick}
            tooltip={TooltipInfo.ReIndex}
          /> */}

          <ToolbarButton
            text={fileStore.numTotalFiles}
            icon={IconSet.MEDIA}
            onClick={fileStore.fetchAllFiles}
            pressed={fileStore.showsAllContent}
            tooltip={TooltipInfo.AllImages}
          />

          {fileStore.numMissingFiles > 0 && (
            <ToolbarButton
              text={fileStore.numMissingFiles}
              icon={IconSet.WARNING_FILL}
              onClick={fileStore.fetchMissingFiles}
              pressed={fileStore.showsMissingContent}
              tooltip={TooltipInfo.Missing}
            />
          )}
        </div>
      </Toolbar>

      <Alert
        open={showReIndexModal}
        title="Re-index Library"
        icon={IconSet.WARNING}
        type="warning"
        primaryButtonText="Re-index"
        secondaryButtonText="Export Tags First"
        defaultButton={DialogButton.SecondaryButton}
        onClick={handleReIndexConfirm}
      >
        <p>
          Are you sure you want to re-index your entire library? This will rebuild the database
          scratch and may take several minutes depending on your library size.
        </p>
        <p>
          <strong>Important:</strong> Only tags that have been synced to image metadata will be
          preserved. Tags that exist only in the database may be lost.
        </p>
        <p>
          <strong>Recommendation:</strong> Export your tags first as a backup before proceeding the
          re-index operation.
        </p>
      </Alert>
    </>
  );
});

const TagsPanel = (props: Partial<MultiSplitPaneProps>) => {
  const { uiStore } = useStore();

  const handleShortcuts = useAction((e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).matches('input')) {
      return;
    }
    const combo = getKeyCombo(e.nativeEvent);
    const matches = (c: string): boolean => {
      return comboMatches(combo, parseKeyCombo(c));
    };
    const { hotkeyMap } = uiStore;
    if (matches(hotkeyMap.selectAll)) {
      uiStore.selectAllTags();
    } else if (matches(hotkeyMap.deselectAll)) {
      uiStore.clearTagSelection();
    }
  });

  return <TagsTree onKeyDown={handleShortcuts} {...props} />;
};

export default TagsPanel;
