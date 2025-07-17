import { observer } from 'mobx-react-lite';
import React from 'react';

import { IconSet } from 'widgets';
import { MultiSplitPaneProps } from 'widgets/MultiSplit/MultiSplitPane';
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
}

export const OutlinerActionBar = observer(() => {
  const { fileStore } = useStore();

  return (
    <Toolbar id="actionbar" label="Action Bar" controls="content-view">
      <div>
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
