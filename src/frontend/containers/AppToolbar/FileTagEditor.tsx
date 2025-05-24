import { computed, IComputedValue, reaction, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, {
  ForwardedRef,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { debounce } from 'common/timeout';
import { Tag } from 'widgets';
import {
  Row,
  RowSeparator,
  useVirtualizedGridFocus,
  VirtualizedGrid,
  VirtualizedGridHandle,
  VirtualizedGridRowProps,
} from 'widgets/combobox/Grid';
import { IconSet } from 'widgets/icons';
import { ToolbarButton } from 'widgets/toolbar';
import { createRowRenderer } from '../../components/TagSelector';
import { useStore } from '../../contexts/StoreContext';
import { ClientFile } from '../../entities/File';
import { ClientTag } from '../../entities/Tag';
import FocusManager from '../../FocusManager';
import { useAction, useAutorun, useComputed } from '../../hooks/mobx';
import { Menu, useContextMenu } from 'widgets/menus';
import { EditorTagSummaryItems } from '../ContentView/menu-items';
import { useGalleryInputKeydownHandler } from 'src/frontend/hooks/useHandleInputKeydown';

const POPUP_ID = 'tag-editor-popup';

const FileTagEditor = observer(() => {
  const { uiStore } = useStore();
  return (
    <>
      <ToolbarButton
        icon={IconSet.TAG_LINE}
        //disabled={uiStore.fileSelection.size === 0 && !uiStore.isToolbarTagPopoverOpen}
        onClick={uiStore.toggleToolbarTagPopover}
        text="Tag selected files"
        tooltip="Add or remove tags from selected images"
      />
      <FloatingPanel
        title="File Tags Editor"
        dataOpen={uiStore.isToolbarTagPopoverOpen}
        onBlur={uiStore.closeToolbarTagPopover}
      >
        <TagEditor />
      </FloatingPanel>
    </>
  );
});

export default FileTagEditor;

const TagEditor = observer(() => {
  const { uiStore } = useStore();
  const [inputText, setInputText] = useState('');
  const [dobuncedQuery, setDebQuery] = useState('');

  const debounceSetDebQuery = useRef(debounce(setDebQuery)).current;
  useEffect(() => {
    if (inputText.length == 0 || inputText.length > 2) {
      setDebQuery(inputText);
    }
    // allways call the debounced version to avoud old calls with outdated query values to be set
    debounceSetDebQuery(inputText);
  }, [debounceSetDebQuery, inputText]);

  const counter = useComputed(() => {
    // Count how often tags are used // Aded las bool value indicating if is an inherited tag -> should not show delete button;
    const counter = new Map<ClientTag, [number, boolean]>();
    for (const file of uiStore.fileSelection) {
      for (const tag of file.inheritedTags) {
        const counterTag = counter.get(tag);
        const count = counterTag?.[0];
        const counterNotInherited = counterTag?.[1];
        const notInherited = file.tags.has(tag);
        counter.set(tag, [
          count !== undefined ? count + 1 : 1,
          counterNotInherited || notInherited,
        ]);
      }
    }
    return counter;
  });

  const inputRef = useRef<HTMLInputElement>(null);
  // Autofocus
  useAutorun(() => {
    if (uiStore.focusTagEditor) {
      requestAnimationFrame(() => requestAnimationFrame(() => inputRef.current?.focus()));
      uiStore.setFocusTagEditor(false);
    }
  });

  const handleInput = useRef((e: React.ChangeEvent<HTMLInputElement>) =>
    setInputText(e.target.value),
  ).current;

  const gridRef = useRef<VirtualizedGridHandle>(null);
  const [activeDescendant, handleGridFocus] = useVirtualizedGridFocus(gridRef);

  // Remember the height when panel is resized
  const panelRef = useRef<HTMLDivElement>(null);
  const [storedHeight] = useState(localStorage.getItem('tag-editor-height'));
  useEffect(() => {
    if (!panelRef.current) {
      return;
    }
    const storeHeight = debounce((val: string) => localStorage.setItem('tag-editor-height', val));
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

  const resetTextBox = useRef(() => {
    setInputText('');
    inputRef.current?.focus();
  }).current;

  const removeTag = useAction((tag: ClientTag) => {
    for (const f of uiStore.fileSelection) {
      f.removeTag(tag);
    }
    inputRef.current?.focus();
  });

  const baseHandleKeydown = useGalleryInputKeydownHandler();
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      baseHandleKeydown(e);
      handleGridFocus(e);
    },
    [baseHandleKeydown, handleGridFocus],
  );

  const handleTagContextMenu = TagSummaryMenu({ parentPopoverId: 'tag-editor' });

  return (
    <div
      ref={panelRef}
      id="tag-editor"
      style={{ height: storedHeight ?? undefined }}
      role="combobox"
      aria-haspopup="grid"
      aria-expanded="true"
      aria-owns={POPUP_ID}
    >
      <input
        type="text"
        spellCheck={false}
        value={inputText}
        aria-autocomplete="list"
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className="input"
        aria-controls={POPUP_ID}
        aria-activedescendant={activeDescendant}
        ref={inputRef}
      />
      <MatchingTagsList
        ref={gridRef}
        inputText={dobuncedQuery}
        counter={counter}
        resetTextBox={resetTextBox}
        onContextMenu={handleTagContextMenu}
      />
      {uiStore.fileSelection.size === 0 ? (
        <div><i><b>No files selected</b></i></div> // eslint-disable-line prettier/prettier
      ) : (
        <TagSummary counter={counter} removeTag={removeTag} onContextMenu={handleTagContextMenu} />
      )}
    </div>
  );
});

const CREATE_OPTION = Symbol('placeholder');

interface MatchingTagsListProps {
  inputText: string;
  counter: IComputedValue<Map<ClientTag, [number, boolean]>>;
  resetTextBox: () => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, tag: ClientTag) => void;
}

const MatchingTagsList = observer(
  React.forwardRef(function MatchingTagsList(
    { inputText, counter, resetTextBox, onContextMenu }: MatchingTagsListProps,
    ref: ForwardedRef<VirtualizedGridHandle>,
  ) {
    const { tagStore, uiStore } = useStore();

    const { matches, widestItem } = useMemo(
      () =>
        computed(() => {
          if (inputText.length === 0) {
            let widest = undefined;
            const matches: (symbol | ClientTag)[] = [];
            for (const tag of counter.get().keys()) {
              matches.push(tag);
              widest = widest ? (tag.path.length > widest.path.length ? tag : widest) : tag;
            }
            // Always append CREATE_OPTION to render the create option component.
            matches.push(CREATE_OPTION);
            return { matches: matches, widestItem: widest };
          } else {
            let widest = undefined;
            const textLower = inputText.toLowerCase();
            const exactMatches: ClientTag[] = [];
            const otherMatches: ClientTag[] = [];
            for (const tag of tagStore.tagList) {
              let validFlag = false;
              const nameLower = tag.name.toLowerCase();
              if (nameLower === textLower) {
                exactMatches.push(tag);
                validFlag = true;
              } else if (nameLower.includes(textLower)) {
                otherMatches.push(tag);
                validFlag = true;
              }
              if (validFlag) {
                widest = widest ? (tag.path.length > widest.path.length ? tag : widest) : tag;
              }
            }
            // Bring exact matches to the top of the suggestions. This helps find tags with short names
            // that would otherwise get buried under partial matches if they appeared lower in the list.
            // Always append CREATE_OPTION to render the create option component.
            return {
              matches: [...exactMatches, ...otherMatches, CREATE_OPTION],
              widestItem: widest,
            };
          }
        }),
      [counter, inputText, tagStore.tagList],
    ).get();

    const toggleSelection = useRef(
      useAction((isSelected: boolean, tag: ClientTag) => {
        const operation = isSelected
          ? (f: ClientFile) => f.removeTag(tag)
          : (f: ClientFile) => f.addTag(tag);
        uiStore.fileSelection.forEach(operation);
        resetTextBox();
      }),
    ).current;

    const isSelected = useCallback(
      (tag: ClientTag) => counter.get().get(tag)?.[1] ?? false,
      [counter],
    );
    const VirtualizableTagOption = useMemo(
      () =>
        observer(
          createRowRenderer({
            id: POPUP_ID,
            isSelected: isSelected,
            toggleSelection: toggleSelection,
            onContextMenu: onContextMenu,
          }),
        ),
      [isSelected, onContextMenu, toggleSelection],
    );
    const VirtualizableCreateOption = useMemo(() => {
      const VirtualizableCreateOption = ({ index, style }: VirtualizedGridRowProps<symbol>) => {
        return (
          <CreateOption
            key={index}
            index={index}
            style={style}
            inputText={inputText}
            //matches always have at least the CREATE_OPTION item, so check if it's bigger than 1.
            hasMatches={matches.length > 1}
            resetTextBox={resetTextBox}
          />
        );
      };
      return VirtualizableCreateOption;
    }, [inputText, matches.length, resetTextBox]);

    const row = useMemo(() => {
      const row = (rowProps: VirtualizedGridRowProps<ClientTag | symbol>) =>
        rowProps.data[rowProps.index] !== CREATE_OPTION ? (
          <VirtualizableTagOption {...(rowProps as VirtualizedGridRowProps<ClientTag>)} />
        ) : (
          <VirtualizableCreateOption {...(rowProps as VirtualizedGridRowProps<symbol>)} />
        );
      return row;
    }, [VirtualizableCreateOption, VirtualizableTagOption]);

    return (
      <VirtualizedGrid
        ref={ref}
        id={POPUP_ID}
        itemData={matches}
        sampleItem={widestItem}
        height={'100%'}
        children={row}
        multiselectable
      />
    );
  }),
);

interface CreateOptionProps {
  inputText: string;
  hasMatches: boolean;
  resetTextBox: () => void;
  style?: React.CSSProperties | undefined;
  index?: number;
}

const CreateOption = ({ inputText, hasMatches, resetTextBox, style, index }: CreateOptionProps) => {
  const { tagStore, uiStore } = useStore();

  const createTag = useCallback(async () => {
    const newTag = await tagStore.create(tagStore.root, inputText);
    runInAction(() => {
      for (const f of uiStore.fileSelection) {
        f.addTag(newTag);
      }
    });
    resetTextBox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputText, resetTextBox]);

  const separatorTop = style
    ? typeof style.top === 'number'
      ? `calc(${style.top}px + 1rem)`
      : `calc(${style.top} + 1rem)`
    : undefined;

  return (
    <>
      {inputText.length > 0 ? (
        <>
          {hasMatches && <RowSeparator style={{ position: style?.position, top: style?.top }} />}
          <Row
            id="tag-editor-create-option"
            index={index}
            style={{ ...style, top: hasMatches ? separatorTop : style?.top }}
            selected={false}
            value={`Create Tag "${inputText}"`}
            onClick={createTag}
            icon={IconSet.TAG_ADD}
          />
        </>
      ) : (
        !hasMatches && (
          <Row style={style} key="empty-message" value="Type to select tags&nbsp;&nbsp;" />
        )
      )}
    </>
  );
};

interface TagSummaryProps {
  counter: IComputedValue<Map<ClientTag, [number, boolean]>>;
  removeTag: (tag: ClientTag) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, tag: ClientTag) => void;
}

const TagSummary = observer(({ counter, removeTag, onContextMenu }: TagSummaryProps) => {
  const { uiStore } = useStore();

  const sortedTags: ClientTag[] = Array.from(counter.get().entries())
    // Sort based on count
    .sort((a, b) => b[1][0] - a[1][0])
    .map((pair) => pair[0]);

  return (
    <div onMouseDown={(e) => e.preventDefault()}>
      {sortedTags.map((t) => (
        <Tag
          key={t.id}
          text={`${t.name}${
            uiStore.fileSelection.size > 1 ? ` (${counter.get().get(t)?.[0]})` : ''
          }`}
          color={t.viewColor}
          //Only show remove button in those tags that are actually assigned to the file(s) and not only inherited
          onRemove={counter.get().get(t)?.[1] ? () => removeTag(t) : undefined}
          onContextMenu={onContextMenu !== undefined ? (e) => onContextMenu(e, t) : undefined}
        />
      ))}
      {sortedTags.length === 0 && <i><b>No tags added yet</b></i> // eslint-disable-line prettier/prettier
      }
    </div>
  );
});

interface ITagSummaryMenu {
  parentPopoverId: string;
}

const TagSummaryMenu = ({ parentPopoverId }: ITagSummaryMenu) => {
  const getFocusableElement = useCallback(() => {
    return document
      .getElementById(parentPopoverId)
      ?.querySelector('input, textarea, button, a, select, [tabindex]') as HTMLElement | null;
  }, [parentPopoverId]);
  const handleMenuBlur = useCallback(
    (e: React.FocusEvent) => {
      if (!e.relatedTarget?.closest('[data-popover="true"]')) {
        const element = getFocusableElement();
        if (element && element instanceof HTMLElement) {
          element.focus();
          element.blur();
        }
      }
    },
    [getFocusableElement],
  );
  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        const element = getFocusableElement();
        e.stopPropagation();
        if (element && element instanceof HTMLElement) {
          element.focus();
          element.blur();
        }
      }
    },
    [getFocusableElement],
  );
  const beforeSelect = useCallback(() => {
    const element = getFocusableElement();
    if (element && element instanceof HTMLElement) {
      element.focus();
      element.blur();
    }
  }, [getFocusableElement]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeMenuId && divRef.current) {
      divRef.current.focus();
    }
  }, [activeMenuId]);

  const show = useContextMenu();
  const handleTagContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, tag: ClientTag) => {
      event.stopPropagation();
      show(
        event.clientX,
        event.clientY,
        <div ref={divRef} onBlur={handleMenuBlur} onKeyDown={handleMenuKeyDown} tabIndex={-1}>
          <Menu>
            <EditorTagSummaryItems tag={tag} beforeSelect={beforeSelect} />
          </Menu>
        </div>,
      );
      setActiveMenuId(tag.id);
    },
    [show, handleMenuBlur, handleMenuKeyDown, beforeSelect],
  );

  return handleTagContextMenu;
};

interface IFloatingPanelProps {
  title?: string;
  onBlur: () => void;
  children: ReactNode;
  dataOpen: boolean;
}

export const FloatingPanel = observer(
  ({ title, dataOpen, onBlur, children }: IFloatingPanelProps) => {
    const { uiStore } = useStore();
    const [style, setStyle] = useState<React.CSSProperties | undefined>(undefined);
    const [extraClassName, setExtraClassName] = useState('fresh-rendered');

    const handleBlur = useAction((e: React.FocusEvent) => {
      const button = e.currentTarget.previousElementSibling as HTMLElement;
      if (
        e.relatedTarget !== button &&
        !e.currentTarget.contains(e.relatedTarget as Node) &&
        !e.relatedTarget?.closest('[data-contextmenu="true"]') &&
        !uiStore.isFloatingPanelToSide
      ) {
        onBlur();
        FocusManager.focusGallery();
      }
    });

    const handleKeyDown = useRef((e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onBlur();
        FocusManager.focusGallery();
      }
    }).current;

    const handleSwitchToSide = useRef(() => {
      uiStore.toggleFloatingPanelToSide();
    }).current;

    useEffect(() => {
      const disposer = reaction(
        () => ({
          isFloatingPanelToSide: uiStore.isFloatingPanelToSide,
          outlinerWidth: uiStore.outlinerWidth,
          outlinerHeights: uiStore.outlinerHeights.slice(),
          outlinerExpansion: uiStore.outlinerExpansion.slice(),
        }),
        ({ isFloatingPanelToSide, outlinerWidth }) => {
          if (isFloatingPanelToSide) {
            const outlinerLastChild = document
              .getElementById('outliner-content')
              ?.querySelector('.multi-split')?.lastElementChild;
            if (outlinerLastChild) {
              const header = outlinerLastChild.querySelector('header');
              const rect = outlinerLastChild.getBoundingClientRect();
              const headerHeight = header ? header.getBoundingClientRect().height : 0;
              const newStyle: React.CSSProperties = {
                position: 'fixed',
                display: 'block',
                left: rect.left,
                top: rect.top - headerHeight,
                width: outlinerWidth,
                height: rect.height,
                borderTop: 'unset',
                borderBottom: 'unset',
                boxShadow: 'unset',
                transform: 'unset',
              };
              setStyle(newStyle);
              return;
            }
          }
          setStyle({});
        },
        { fireImmediately: true },
      );

      return () => disposer();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
      if (style === undefined) {
        return;
      }
      if (dataOpen) {
        setExtraClassName('opened');
        const timeout = setTimeout(() => {
          setExtraClassName('');
        }, 300);
        return () => clearTimeout(timeout);
      }
    }, [dataOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    //initial enabling animations with delay to avoid ghost panel to move
    useEffect(() => {
      const timeout = setTimeout(() => {
        setExtraClassName('');
      }, 300);
      return () => clearTimeout(timeout);
    }, []);

    const isFloatingPanelToSide = uiStore.isFloatingPanelToSide;

    return (
      // FIXME: data attributes placeholder
      <div
        data-popover
        style={style}
        data-open={dataOpen}
        className={`floating-dialog ${extraClassName}`}
        tabIndex={-1} //necessary for handling the onblur correctly
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        {dataOpen && style !== undefined ? (
          <>
            <header>
              <h2>{title}</h2>
              <button
                className="floating-switch-side-button"
                data-tooltip="Switch to/from the side"
                onClick={handleSwitchToSide}
                aria-haspopup="menu"
                style={isFloatingPanelToSide ? undefined : { transform: 'scaleX(-1)' }}
              >
                {IconSet.ARROW_RIGHT}
              </button>
            </header>
            {children}
          </>
        ) : null}
      </div>
    );
  },
);
