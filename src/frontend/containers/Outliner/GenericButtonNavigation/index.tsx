import React from 'react';

interface GenericNavigationButtonProps {
  text: string;
  onClick: () => void;
  disabled?: boolean;
}

const SavedSearchesPanel = (props: GenericNavigationButtonProps) => {
  return (
    <button
      disabled={props.disabled}
      onClick={() => {
        props.onClick();
      }}
    >
      {props.text}
    </button>
  );
};

export default SavedSearchesPanel;
