import { observer } from 'mobx-react-lite';
import React from 'react';
import { IconSet } from 'widgets';

import { MultiSplitPaneProps } from 'widgets/MultiSplit/MultiSplitPane';
import { useStore } from '../../../contexts/StoreContext';

type NavigationButtonProps = {
  icon?: JSX.Element;
  text: string;
  accelerator?: JSX.Element;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  checked: boolean;
};

export const NavigationButton = ({
  text,
  icon,
  onClick,
  disabled,
  checked,
}: NavigationButtonProps) => (
  <button
    className={'navigation-button' + (checked ? ' navigation-button--checked' : '')}
    tabIndex={-1}
    aria-checked={checked}
    onClick={disabled ? undefined : onClick}
    aria-disabled={disabled}
  >
    <p className="navigation-button__icon" aria-hidden>
      {icon}
    </p>
    {/* <p className="navigation-button__label">{text}</p> */}
  </button>
);
const TagsPanel = observer((props: Partial<MultiSplitPaneProps>) => {
  const { uiStore } = useStore();

  return (
    <div className="navigation-buttons">
      <NavigationButton
        icon={IconSet.VIEW_LIST}
        onClick={uiStore.setMethodList}
        checked={uiStore.isList}
        text="List"
      />
      <NavigationButton
        icon={IconSet.VIEW_GRID}
        onClick={uiStore.setMethodMasonry}
        checked={uiStore.isMasonry}
        text="Grid"
      />
      <br />
      <NavigationButton
        icon={IconSet.FACE_SMILING}
        onClick={uiStore.setMethodFaces}
        checked={uiStore.isFaces}
        text="Faces"
      />
      <NavigationButton
        icon={IconSet.WORLD}
        onClick={uiStore.setMethodMap}
        checked={uiStore.isMap}
        text="Map"
      />
      <NavigationButton
        icon={IconSet.FILTER_DATE}
        onClick={uiStore.setMethodCalendar}
        checked={uiStore.isCalendar}
        text="Calendar"
      />
    </div>
  );
});

export default TagsPanel;
