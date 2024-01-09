import React, { useEffect, useRef } from 'react';

// Note: this is a brotal copy paste of toolbar.tsx just to change the background color, should be refactored
interface ToolbarProps {
  children: React.ReactNode;
  controls: string;
  id?: string;
  label?: string;
  labelledby?: string;
  isCompact?: boolean;
}

const Toolbar: React.FC<ToolbarProps> = (props: ToolbarProps) => {
  const { children, id, label, labelledby, isCompact = false, controls } = props;
  const toolbar = useRef<HTMLDivElement>(null);

  // Either the first item or last focused toolbar item needs to be part of the
  // tab order.
  // A data attribute is used to find items. A role would mess up other kinds
  // of toolbar items like (radio) buttons and a class seems to always create
  // more of a mess for JS and CSS.
  useEffect(() => {
    if (toolbar.current === null) {
      return;
    }

    const lastFocusedItem = toolbar.current.querySelector('[tabindex="0"]');
    if (lastFocusedItem === null) {
      const firstToolbarItem: HTMLElement | null = toolbar.current.querySelector('[tabindex="-1"]');
      if (firstToolbarItem !== null) {
        firstToolbarItem.tabIndex = 0;
      }
    }
  }, [children]);

  return (
    <div
      ref={toolbar}
      role="toolbar"
      id={id}
      data-compact={isCompact}
      aria-label={label}
      aria-labelledby={labelledby}
      aria-controls={controls}
    >
      {children}
    </div>
  );
};

Toolbar.displayName = 'Toolbar';

interface TagButtonProps {
  id?: string;
  text: React.ReactText;
  icon: JSX.Element;
  onClick?: (event: React.MouseEvent) => void;
  isCollapsible?: boolean;
  tooltip?: string;
  disabled?: boolean;
  tabIndex?: 0 | -1;
  pressed?: boolean;
  checked?: boolean;
  controls?: string;
  type?: 'button' | 'submit' | 'reset';
}

const TagButton = (props: TagButtonProps) => {
  const {
    id,
    onClick,
    icon,
    text,
    pressed,
    checked,
    disabled,
    tooltip,
    isCollapsible = true,
    controls,
    tabIndex,
    type,
  } = props;
  return (
    <button
      data-collapsible={isCollapsible}
      id={id}
      className="tag-editor-button "
      onClick={disabled ? undefined : onClick}
      aria-pressed={pressed}
      aria-checked={checked}
      aria-disabled={disabled}
      aria-controls={controls}
      tabIndex={tabIndex} // FIXME: Implement toolbar keyboard navigation.
      data-tooltip={tooltip ?? text}
      type={type}
    >
      {icon}
      {/* <span className="btn-content-text">{text}</span> */}
      <span className="tag-editor-button__label">Tag (T)</span>
    </button>
  );
};

export { Toolbar, TagButton };
