import { observer } from 'mobx-react-lite';
import React, {
  ForwardedRef,
  ReactElement,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { GridCell, IconButton, IconSet, Row, Tag } from 'widgets';
import {
  RowProps,
  RowSeparator,
  useVirtualizedGridFocus,
  VirtualizedGrid,
  VirtualizedGridHandle,
  VirtualizedGridRowProps,
} from 'widgets/combobox/Grid';
import { Flyout } from 'widgets/popovers';
import { useStore } from '../contexts/StoreContext';
import { ClientTag } from '../entities/Tag';
import { useComputed } from '../hooks/mobx';
import { debounce } from 'common/timeout';
import { useGalleryInputKeydownHandler } from '../hooks/useHandleInputKeydown';
import { Placement } from '@floating-ui/core';
import { CREATE_OPTION } from './FileTagsEditor';
import { computed } from 'mobx';

export interface TagSelectorProps {
  selection: ClientTag[] | [ClientTag, boolean][];
  onSelect: (item: ClientTag) => void;
  onDeselect: (item: ClientTag) => void;
  onTagClick?: (item: ClientTag) => void;
  onClear: () => void;
  disabled?: boolean;
  extraIconButtons?: ReactElement;
  renderCreateOption?: (
    inputText: string,
    resetTextBox: () => void,
  ) => ReactElement<RowProps> | ReactElement<RowProps>[];
  multiline?: boolean;
  filter?: (tag: ClientTag) => boolean;
  showTagContextMenu?: (e: React.MouseEvent<HTMLElement>, tag: ClientTag) => void;
  suggestionsUpdateDependency?: number;
}

const TagSelector = (props: TagSelectorProps) => {
  const {
    selection,
    onSelect,
    onDeselect,
    onTagClick,
    showTagContextMenu,
    onClear,
    disabled,
    extraIconButtons,
    renderCreateOption,
    multiline,
    filter,
    suggestionsUpdateDependency,
  } = props;
  const gridId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [forceCreateOption, setForceCreateOption] = useState(false);
  const [query, setQuery] = useState('');
  const [dobuncedQuery, setDebQuery] = useState('');

  /**
   * A memoized map of selected tags with their inheritance status for better perfomance.
   * - Key: The tag object
   * - Value: True if the tag is explicitly assigned (not inherited)
   */
  const selectionMap = useMemo(() => {
    if (Array.isArray(selection) && selection.length > 0 && Array.isArray(selection[0])) {
      return new Map(selection as [ClientTag, boolean][]);
    } else {
      return new Map((selection as ClientTag[]).map((tag) => [tag, true]));
    }
  }, [selection]);

  const debounceSetDebQuery = useRef(debounce(setDebQuery)).current;
  useEffect(() => {
    if (query.length == 0 || query.length > 2) {
      setDebQuery(query);
    }
    // allways call the debounced version to avoud old calls with outdated query values to be set
    debounceSetDebQuery(query);
  }, [debounceSetDebQuery, query]);

  const handleChange = useRef((e: React.ChangeEvent<HTMLInputElement>) => {
    setIsOpen(true);
    setQuery(e.target.value);
  }).current;

  const clearSelection = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setQuery('');
      onClear();
    },
    [onClear],
  );

  const isInputEmpty = query.length === 0;

  const gridRef = useRef<VirtualizedGridHandle>(null);
  const [activeDescendant, handleGridFocus] = useVirtualizedGridFocus(gridRef);
  const handleGalleryInput = useGalleryInputKeydownHandler();
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Backspace') {
        e.stopPropagation();

        // Remove last assigned item from selection with backspace
        if (isInputEmpty && selectionMap.size > 0) {
          const lastExplicitTag = Array.from(selectionMap.entries())
            .filter(([, isExplicit]) => isExplicit)
            .at(-1)?.[0];
          if (lastExplicitTag) {
            onDeselect(lastExplicitTag);
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
      } else {
        handleGalleryInput(e);
        handleGridFocus(e);
      }
    },
    [isInputEmpty, selectionMap, onDeselect, handleGalleryInput, handleGridFocus],
  );

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Alt') {
      setForceCreateOption((prev) => !prev);
    }
  }, []);

  const handleBlur = useRef((e: React.FocusEvent<HTMLDivElement>) => {
    // If anything is blurred, and the new focus is not the input nor the flyout, close the flyout
    const isFocusingOption =
      e.relatedTarget instanceof HTMLElement &&
      e.currentTarget.contains(e.relatedTarget) &&
      (e.relatedTarget.matches('div[role="row"]') ||
        e.relatedTarget.matches('div.virtualized-grid'));
    if (isFocusingOption || e.relatedTarget === inputRef.current) {
      return;
    }
    setQuery('');
    setIsOpen(false);
  }).current;

  const handleFocus = useRef(() => setIsOpen(true)).current;

  const handleBackgroundClick = useCallback(() => inputRef.current?.focus(), []);

  const resetTextBox = useRef(() => {
    inputRef.current?.focus();
    setQuery('');
  });

  const toggleSelection = useCallback(
    (isSelected: boolean, tag: ClientTag) => {
      if (!isSelected) {
        onSelect(tag);
      } else {
        onDeselect(tag);
      }
      resetTextBox.current();
    },
    [onDeselect, onSelect],
  );

  const fallbackPlacements = useRef<Placement[]>(['left-end', 'top-start', 'right-end']).current;

  return (
    <div
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="grid"
      aria-owns={gridId}
      className={`tag-selector input multiautocomplete ${multiline ? 'multiline' : ''}`}
      onBlur={handleBlur}
      onClick={handleBackgroundClick}
    >
      <Flyout
        isOpen={isOpen}
        cancel={() => setIsOpen(false)}
        placement="bottom-start"
        fallbackPlacements={fallbackPlacements}
        ignoreCloseForElementOnBlur={inputRef.current || undefined}
        target={(ref) => (
          <div ref={ref} className="multiautocomplete-input">
            <div className="input-wrapper">
              {Array.from(selectionMap.entries()).map(([tag, isExplicit]) => (
                <SelectedTag
                  key={tag.id}
                  tag={tag}
                  onDeselect={isExplicit ? onDeselect : undefined}
                  onTagClick={onTagClick}
                  showContextMenu={showTagContextMenu}
                />
              ))}
              <input
                disabled={disabled}
                type="text"
                value={query}
                aria-autocomplete="list"
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onKeyUp={handleKeyUp}
                aria-controls={gridId}
                aria-activedescendant={activeDescendant}
                ref={inputRef}
                onFocus={handleFocus}
              />
            </div>
            {extraIconButtons}
            <IconButton icon={IconSet.CLOSE} text="Clear" onClick={clearSelection} />
          </div>
        )}
      >
        <SuggestedTagsList
          ref={gridRef}
          id={gridId}
          filter={filter}
          query={dobuncedQuery}
          selectionMap={selectionMap}
          toggleSelection={toggleSelection}
          resetTextBox={resetTextBox.current}
          renderCreateOption={renderCreateOption}
          forceCreateOption={forceCreateOption}
          suggestionsUpdateDependency={suggestionsUpdateDependency}
        />
      </Flyout>
    </div>
  );
};

export { TagSelector };

interface SelectedTagProps {
  tag: ClientTag;
  onDeselect?: (item: ClientTag) => void;
  onTagClick?: (item: ClientTag) => void;
  showContextMenu?: (e: React.MouseEvent<HTMLElement>, item: ClientTag) => void;
}

const SelectedTag = observer((props: SelectedTagProps) => {
  const { tag, onDeselect, onTagClick, showContextMenu } = props;
  return (
    <Tag
      text={tag.name}
      color={tag.viewColor}
      onRemove={onDeselect ? () => onDeselect(tag) : undefined}
      onClick={onTagClick !== undefined ? () => onTagClick(tag) : undefined}
      onContextMenu={showContextMenu !== undefined ? (e) => showContextMenu(e, tag) : undefined}
    />
  );
});

interface SuggestedTagsListProps {
  id: string;
  query: string;
  selectionMap: Map<ClientTag, boolean>;
  filter?: (tag: ClientTag) => boolean;
  toggleSelection: (isSelected: boolean, tag: ClientTag) => void;
  resetTextBox: () => void;
  renderCreateOption?: (
    inputText: string,
    resetTextBox: () => void,
  ) => ReactElement<RowProps> | ReactElement<RowProps>[];
  forceCreateOption?: boolean;
  suggestionsUpdateDependency?: number;
}

const SuggestedTagsList = observer(
  React.forwardRef(function TagsList(
    props: SuggestedTagsListProps,
    ref: ForwardedRef<VirtualizedGridHandle>,
  ) {
    const {
      id,
      query,
      selectionMap,
      filter = () => true,
      toggleSelection,
      resetTextBox,
      renderCreateOption,
      forceCreateOption,
      suggestionsUpdateDependency,
    } = props;
    const { tagStore, uiStore } = useStore();

    const { suggestions, widestItem } = useMemo(
      () =>
        computed(() => {
          if (query.length === 0 && !forceCreateOption) {
            let widest = undefined;
            const matches: (ClientTag | ReactElement<RowProps> | string)[] = [];
            // Add recently used tags.
            if (uiStore.recentlyUsedTags.length > 0) {
              matches.push('Recently used tags');
              for (const tag of uiStore.recentlyUsedTags) {
                matches.push(tag);
                widest = widest ? (tag.pathCharLength > widest.pathCharLength ? tag : widest) : tag;
              }
              if (selectionMap.size > 0) {
                matches.push('Assigned tags');
              }
            }
            for (const tag of selectionMap.keys()) {
              matches.push(tag);
              widest = widest ? (tag.pathCharLength > widest.pathCharLength ? tag : widest) : tag;
            }
            if (selectionMap.size === 0 && uiStore.recentlyUsedTags.length === 0) {
              matches.push(
                <Row key="empty-message" value="Type to search tags...&nbsp;&nbsp;"></Row>,
              );
            }
            return { suggestions: matches, widestItem: widest };
          } else {
            let widest = undefined;
            const textLower = query.toLowerCase();
            const exactMatches: ClientTag[] = [];
            const otherMatches: ClientTag[] = [];
            if (!forceCreateOption) {
              for (const tag of tagStore.tagList) {
                let validFlag = false;
                if (!filter(tag)) {
                  continue;
                }
                const nameLower = tag.name.toLowerCase();
                if (nameLower === textLower) {
                  exactMatches.push(tag);
                  validFlag = true;
                } else if (nameLower.includes(textLower)) {
                  otherMatches.push(tag);
                  validFlag = true;
                }
                if (validFlag) {
                  widest = widest
                    ? tag.pathCharLength > widest.pathCharLength
                      ? tag
                      : widest
                    : tag;
                }
              }
            } else {
              // Access at least one observable to avoid mobx warnings. Derivation 'ComputedValue@' is created/updated without reading any observable value.
              tagStore.count;
            }
            // Add create option
            const createOptionItems = (function () {
              if (exactMatches.length === 0 && otherMatches.length === 0) {
                const createOption = renderCreateOption?.(query, resetTextBox);
                return Array.isArray(createOption)
                  ? createOption
                  : createOption
                  ? [createOption]
                  : [];
              }
              return [];
            })();
            // Bring exact matches to the top of the suggestions. This helps find tags with short names
            // that would otherwise get buried under partial matches if they appeared lower in the list.
            return {
              suggestions: [...exactMatches, ...otherMatches, ...createOptionItems],
              widestItem: widest,
            };
          }
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        query,
        tagStore.tagList,
        uiStore.recentlyUsedTags,
        renderCreateOption,
        filter,
        forceCreateOption,
        suggestionsUpdateDependency,
      ],
    ).get();

    const isSelected = useCallback(
      (tag: ClientTag) => selectionMap.get(tag) ?? false,
      [selectionMap],
    );
    const TagRow = useMemo(
      () => createTagRowRenderer({ isSelected, toggleSelection, id }),
      [isSelected, toggleSelection, id],
    );

    const row = useMemo(() => {
      const row = (
        rowProps: VirtualizedGridRowProps<ClientTag | ReactElement<RowProps> | string>,
      ) => {
        const item = rowProps.data[rowProps.index];
        if (React.isValidElement(item)) {
          const { style, index } = rowProps;
          return React.cloneElement(item, { style, index });
        } else if (typeof item === 'string') {
          const { position, top, height } = rowProps.style ?? {};
          return <RowSeparator label={item} style={{ position, top, height }} />;
        } else {
          return <TagRow {...(rowProps as VirtualizedGridRowProps<ClientTag>)} />;
        }
      };
      return row;
    }, [TagRow]);

    return (
      <>
        <VirtualizedGrid
          ref={ref}
          id={id}
          itemData={suggestions}
          sampleItem={widestItem}
          multiselectable
          itemsInView={10}
          children={row}
        />
      </>
    );
  }),
);

interface VirtualizableTagOption {
  id?: string;
  isSelected: (tag: ClientTag) => boolean;
  toggleSelection: (isSelected: boolean, tag: ClientTag) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, tag: ClientTag) => void;
}

export function createTagRowRenderer({
  isSelected,
  toggleSelection,
  id,
  onContextMenu,
}: VirtualizableTagOption) {
  const RowRenderer = ({ index, style, data, id: sub_id }: VirtualizedGridRowProps<ClientTag>) => {
    const tag = data[index];
    const selected = isSelected(tag);
    return (
      <TagOption
        id={`${id}-${tag.id}-${sub_id}`}
        index={index}
        style={style}
        key={tag.id}
        tag={tag}
        selected={selected}
        toggleSelection={toggleSelection}
        onContextMenu={onContextMenu}
      />
    );
  };
  return RowRenderer;
}

interface TagOptionProps {
  id?: string;
  index?: number;
  tag: ClientTag;
  selected?: boolean;
  style?: React.CSSProperties;
  toggleSelection: (isSelected: boolean, tag: ClientTag) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, tag: ClientTag) => void;
}

export const TagOption = observer(
  ({ id, index, tag, selected, toggleSelection, onContextMenu, style }: TagOptionProps) => {
    const [path, hint] = useComputed(() => {
      const path = tag.path
        .map((v) => (v.startsWith('#') ? '&nbsp;<b>' + v.slice(1) + '</b>&nbsp;' : v))
        .join(' › ');
      const hint = path.slice(
        0,
        Math.max(0, path.length - tag.name.length - (tag.name.startsWith('#') ? 18 : 3)),
      );
      return [path, hint];
    }).get();

    const isHeader = useMemo(() => tag.name.startsWith('#'), [tag.name]);

    return (
      <Row
        id={id}
        index={index}
        value={isHeader ? '<b>' + tag.name.slice(1) + '</b>' : tag.name}
        selected={selected}
        icon={<span style={{ color: tag.viewColor }}>{IconSet.TAG}</span>}
        onClick={() => toggleSelection(selected ?? false, tag)}
        tooltip={path}
        onContextMenu={onContextMenu !== undefined ? (e) => onContextMenu(e, tag) : undefined}
        valueIsHtml
        style={style}
      >
        {hint.length > 0 ? (
          <GridCell className="tag-option-hint" __html={hint}></GridCell>
        ) : (
          <GridCell />
        )}
      </Row>
    );
  },
);
