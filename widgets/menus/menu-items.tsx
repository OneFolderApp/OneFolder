import React, { ForwardedRef, forwardRef, useCallback, useRef } from 'react';

import { IconSet } from '../icons';

export type MenuItemProps = {
  icon?: JSX.Element;
  text: string;
  accelerator?: JSX.Element;
  onClick: (event: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
};

export const MenuItem = ({ text, icon, onClick, accelerator, disabled }: MenuItemProps) => (
  <li
    role="menuitem"
    tabIndex={-1}
    onClick={disabled ? undefined : onClick}
    aria-disabled={disabled}
  >
    <span className="item-icon" aria-hidden>
      {icon}
    </span>
    <span className="item-label">{text}</span>
    <span className="item-accelerator">{accelerator}</span>
  </li>
);

export type MenuRadioItemProps = { checked: boolean } & MenuItemProps;

export const MenuRadioItem = ({
  text,
  icon,
  checked,
  onClick,
  accelerator,
  disabled,
}: MenuRadioItemProps) => (
  <li
    role="menuitemradio"
    aria-checked={checked}
    tabIndex={-1}
    onClick={disabled ? undefined : onClick}
    aria-disabled={disabled}
  >
    <span className="item-icon" aria-hidden>
      {icon}
    </span>
    <span className="item-label">{text}</span>
    <span className="item-accelerator">{accelerator}</span>
  </li>
);

export type MenuCheckboxItemProps = Omit<MenuRadioItemProps, 'icon'>;

export const MenuCheckboxItem = ({
  text,
  checked,
  onClick,
  accelerator,
  disabled,
}: MenuCheckboxItemProps) => (
  <li
    role="menuitemcheckbox"
    aria-checked={checked}
    tabIndex={-1}
    onClick={disabled ? undefined : onClick}
    aria-disabled={disabled}
  >
    <span className="item-icon" aria-hidden></span>
    <span className="item-label">{text}</span>
    <span className="item-accelerator">{accelerator}</span>
  </li>
);

export interface IMenuSliderItem {
  value: number;
  label?: string;
  onChange: (val: number) => void;
  min: number;
  max: number;
  step: number;
  id: string;
  options: { value: number; label?: string }[];
}

export const MenuSliderItem = ({
  value,
  label,
  onChange,
  min,
  max,
  step,
  id,
  options,
}: IMenuSliderItem) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFocus = useCallback(() => inputRef.current?.focus(), []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (['ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.stopPropagation();
    }
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.valueAsNumber),
    [onChange],
  );

  return (
    <li role="menuitemslider" tabIndex={-1} onFocus={handleFocus}>
      {label && <label htmlFor={id}>{label}</label>}

      <div className="slider">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={handleChange}
          list={id}
          step={step}
          tabIndex={-1}
          ref={inputRef}
          onKeyDown={handleKeyDown}
        />

        <datalist id={id}>
          {options.map((o, i) => (
            <option {...o} key={`${o.value}-${i}`} />
          ))}
        </datalist>
      </div>
    </li>
  );
};

export const MenuDivider = () => <li role="separator" className="menu-separator"></li>;

export type MenuItemLinkProps = {
  icon?: JSX.Element;
  text: string;
  disabled?: boolean;
  expanded: boolean;
  accelerator?: JSX.Element;
};

export const MenuItemLink = forwardRef(function MenuItemLink(
  { expanded, disabled, icon, text, accelerator }: MenuItemLinkProps,
  ref: ForwardedRef<HTMLAnchorElement>,
) {
  return (
    <a
      ref={ref}
      tabIndex={-1}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={expanded}
      aria-disabled={disabled}
      href="#"
    >
      <span className="item-icon" aria-hidden>
        {icon}
      </span>
      <span className="item-label">{text}</span>
      <span className="item-accelerator">{accelerator ? accelerator : IconSet.ARROW_RIGHT}</span>
    </a>
  );
});
