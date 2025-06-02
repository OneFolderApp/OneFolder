import React, {
  ForwardedRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ClientExtraProperty } from '../entities/ExtraProperty';
import { Grid, GridCell, Row, RowSeparator, useGridFocus } from 'widgets/combobox/Grid';
import { observer } from 'mobx-react-lite';
import { useStore } from '../contexts/StoreContext';
import { computed, runInAction } from 'mobx';
import { IconSet } from 'widgets/icons';
import { debounce } from 'common/timeout';
import { useGalleryInputKeydownHandler } from '../hooks/useHandleInputKeydown';
import { ExtraPropertiesCounter } from './FileExtraPropertiesEditor';
import { ExtraPropertyType } from 'src/api/extraProperty';

interface IExtraPropertySelectorProps {
  counter?: ExtraPropertiesCounter;
  onSelect: (item: ClientExtraProperty) => void;
  disabled?: boolean;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, extraProperty: ClientExtraProperty) => void;
}

export const ExtraPropertySelector = (props: IExtraPropertySelectorProps) => {
  const gridId = useId();
  const tagSelectorID = useId();
  const { counter, onSelect, onContextMenu } = props;
  const [inputText, setInputText] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const handleInput = useRef((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
  }).current;

  const gridRef = useRef<HTMLDivElement>(null);
  const [activeDescendant, handleGridFocus] = useGridFocus(gridRef);

  const resetTextBox = useRef(() => {
    setInputText('');
    inputRef.current?.focus();
  }).current;

  const baseHandleKeyDown = useGalleryInputKeydownHandler();
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setInputText('');
      } else {
        baseHandleKeyDown(e);
      }
      handleGridFocus(e);
    },
    [baseHandleKeyDown, handleGridFocus],
  );

  const handleBlur = useRef((e: React.FocusEvent<HTMLDivElement>) => {
    // If anything is blurred, and the new focus is not the input nor the flyout, close the flyout
    const isFocusingOption =
      e.relatedTarget instanceof HTMLElement && e.relatedTarget.matches('div[role="row"]');
    if (isFocusingOption || e.relatedTarget === inputRef.current) {
      return;
    }
    setInputText('');
  }).current;

  const handleBackgroundClick = useCallback(() => inputRef.current?.focus(), []);

  // Remember the height when panel is resized
  const panelRef = useRef<HTMLDivElement>(null);
  const [storedHeight] = useState(localStorage.getItem('extra-property-selector-height'));
  useEffect(() => {
    if (!panelRef.current) {
      return;
    }
    const storeHeight = debounce((val: string) =>
      localStorage.setItem('extra-property-selector-height', val),
    );
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type == 'attributes' &&
          mutation.attributeName === 'style' &&
          panelRef.current
        ) {
          storeHeight(panelRef.current.style.height);
        }
      });
    });
    observer.observe(panelRef.current, { attributes: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={panelRef}
      id={tagSelectorID}
      role="combobox"
      className="extra-property-selector-pane"
      aria-expanded="true"
      aria-haspopup="grid"
      aria-owns={gridId}
      style={{ height: storedHeight ?? undefined }}
      onClick={handleBackgroundClick}
      onBlur={handleBlur}
    >
      <input
        //disabled={disabled}
        role="menuitem"
        type="text"
        className={'input'}
        spellCheck={false}
        value={inputText}
        aria-autocomplete="list"
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        aria-controls={gridId}
        aria-activedescendant={activeDescendant}
        ref={inputRef}
      />
      <ExtraPropertyList
        counter={counter}
        ref={gridRef}
        id={gridId}
        inputText={inputText}
        resetTextBox={resetTextBox}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
      />
    </div>
  );
};

interface ExtraPropertyListProps {
  id: string;
  counter?: ExtraPropertiesCounter;
  inputText: string;
  resetTextBox: () => void;
  onSelect: (extraProperty: ClientExtraProperty) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, ExtraProperty: ClientExtraProperty) => void;
}

const ExtraPropertyList = observer(
  React.forwardRef(function MatchingTagsList(
    { id, counter, inputText, resetTextBox, onSelect, onContextMenu }: ExtraPropertyListProps,
    ref: ForwardedRef<HTMLDivElement>,
  ) {
    const { extraPropertyStore } = useStore();

    const matches = useMemo(
      () =>
        computed(() => {
          if (inputText.length === 0) {
            return extraPropertyStore.extraPropertiesList;
          } else {
            const textLower = inputText.toLowerCase();
            return extraPropertyStore.extraPropertiesList.filter((t) =>
              t.name.toLowerCase().includes(textLower),
            );
          }
        }),
      [inputText, extraPropertyStore],
    ).get();

    return (
      <Grid ref={ref} id={id} multiselectable>
        {matches.map((extraProperty) => {
          const selected =
            counter !== undefined ? (counter.get().get(extraProperty)?.[0] ?? 0) > 0 : false;
          const extraPropCount = counter?.get()?.get(extraProperty)?.[0] ?? 0;
          const hint = extraPropCount > 1 ? extraPropCount.toString() : '';
          return (
            <ExtraPropertyOption
              key={extraProperty.id}
              id={`${id}-${extraProperty.id}`}
              extraProperty={extraProperty}
              hint={hint}
              selected={selected}
              onSelect={onSelect}
              resetTextBox={resetTextBox}
              onContextMenu={onContextMenu}
            />
          );
        })}
        <CreateOption
          inputText={inputText}
          hasMatches={matches.length > 0}
          resetTextBox={resetTextBox}
        />
      </Grid>
    );
  }),
);

interface ExtraPropertyOptionProps {
  id?: string;
  extraProperty: ClientExtraProperty;
  hint?: string;
  selected?: boolean;
  onSelect: (extraProperty: ClientExtraProperty) => void;
  resetTextBox?: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, extraProperty: ClientExtraProperty) => void;
}

export const ExtraPropertyOption = observer(
  ({
    id,
    extraProperty,
    hint,
    selected,
    onSelect,
    resetTextBox,
    onContextMenu,
  }: ExtraPropertyOptionProps) => {
    const onclick = useCallback(() => {
      onSelect(extraProperty);
      resetTextBox?.();
    }, [onSelect, resetTextBox, extraProperty]);
    return (
      <Row
        id={id}
        value={extraProperty.name}
        selected={selected}
        icon={<span>{IconSet.SMALL_ARROW_RIGHT}</span>}
        onClick={onclick}
        tooltip={extraProperty.name}
        onContextMenu={
          onContextMenu !== undefined ? (e) => onContextMenu(e, extraProperty) : undefined
        }
        valueIsHtml
      >
        {hint !== undefined && hint.length > 0 ? (
          <GridCell className="tag-option-hint" __html={hint}></GridCell>
        ) : (
          <GridCell />
        )}
      </Row>
    );
  },
);

interface CreateOptionProps {
  inputText: string;
  hasMatches: boolean;
  resetTextBox: () => void;
  type?: ExtraPropertyType;
}

const CreateOption = ({
  inputText,
  hasMatches,
  resetTextBox,
  type = ExtraPropertyType.number,
}: CreateOptionProps) => {
  const { extraPropertyStore, uiStore } = useStore();

  const createExtraProperty = useCallback(async () => {
    const newExtraProperty = await extraPropertyStore.createExtraProperty(inputText, type);
    runInAction(() => uiStore.fileSelection.forEach((f) => f.setExtraProperty(newExtraProperty)));
    resetTextBox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, resetTextBox, type]);

  if (inputText.length === 0) {
    return null;
  }

  return (
    <>
      {hasMatches && <RowSeparator />}
      <Row
        id="extra-property-create-option"
        selected={false}
        value={`Create Extra Property "${inputText}"`}
        onClick={createExtraProperty}
        icon={IconSet.PLUS}
      />
    </>
  );
};
