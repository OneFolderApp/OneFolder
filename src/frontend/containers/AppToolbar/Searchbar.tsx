import { observer } from 'mobx-react-lite';
import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { useStore } from '../../contexts/StoreContext';
const SEARCHBAR_ID = 'toolbar-searchbar';

const Searchbar = observer(() => {
  const { uiStore } = useStore();
  const searchCriteriaList = uiStore.searchCriteriaList;

  // Only show quick search bar when all criteria are tags,
  // otherwise show a search bar that opens to the advanced search form
  // Exception: Searching for untagged files (tag contains empty value)
  // -> show as custom label in CriteriaList
  const isQuickSearch =
    searchCriteriaList.length === 0 ||
    searchCriteriaList.every(
      (crit) =>
        crit.key === 'tags' &&
        crit.operator === 'containsRecursively' &&
        (crit as ClientTagSearchCriteria).value,
    );

  return (
    <div id={SEARCHBAR_ID} className="searchbar">
      {isQuickSearch ? <QuickSearchList /> : <CriteriaList />}
    </div>
  );
});

export default Searchbar;

import {
  ClientExtraPropertySearchCriteria,
  ClientStringSearchCriteria,
  ClientTagSearchCriteria,
  CustomKeyDict,
} from 'src/frontend/entities/SearchCriteria';
import { ClientTag } from 'src/frontend/entities/Tag';

import { IconButton, IconSet, Row, Tag } from 'widgets';

import { TagSelector } from 'src/frontend/components/TagSelector';
import { useAction, useComputed } from 'src/frontend/hooks/mobx';
import { ExtraPropertySelector } from 'src/frontend/components/ExtraPropertySelector';
import { ClientExtraProperty } from 'src/frontend/entities/ExtraProperty';
import { ExtraPropertyType, getExtraPropertyDefaultValue } from 'src/api/extraProperty';
import { OperatorType } from 'src/api/search-criteria';
import { usePopover } from 'widgets/popovers/usePopover';
import { RowProps } from 'widgets/combobox/Grid';
import ReactDOM from 'react-dom';

const QuickSearchList = observer(() => {
  const { uiStore, tagStore } = useStore();

  const selection = useComputed(() => {
    const selectedItems: ClientTag[] = [];
    uiStore.searchCriteriaList.forEach((c) => {
      if (c instanceof ClientTagSearchCriteria && c.value) {
        const item = tagStore.get(c.value);
        if (item) {
          selectedItems.push(item);
        }
      }
    });
    return selectedItems;
  });

  const handleSelect = useAction((item: Readonly<ClientTag>) =>
    uiStore.addSearchCriteria(new ClientTagSearchCriteria('tags', item.id, 'containsRecursively')),
  );

  const handleDeselect = useAction((item: Readonly<ClientTag>) => {
    const crit = uiStore.searchCriteriaList.find(
      (c) => c instanceof ClientTagSearchCriteria && c.value === item.id,
    );
    if (crit) {
      uiStore.removeSearchCriteria(crit);
    }
  });

  const renderCreateOption = useRef((query: string, resetTextBox: () => void) => {
    return [
      <QuickExtraPropertySearchOption
        key="search-in-extra-property"
        id="search-in-extra-property-option"
        index={0}
        value={`Search for "${query}" in an extra property`}
        query={query}
        resetTextBox={resetTextBox}
      />,
      <Row
        id="search-in-path-option"
        index={1}
        key="search-in-path"
        value={`Search in file paths for "${query}"`}
        onClick={() => {
          resetTextBox();
          uiStore.addSearchCriteria(new ClientStringSearchCriteria('absolutePath', query));
        }}
      />,
      <Row
        id="advanced-search-option"
        index={2}
        key="advanced-search"
        value="Advanced search"
        onClick={uiStore.toggleAdvancedSearch}
        icon={IconSet.SEARCH_EXTENDED}
      />,
    ];
  }).current;

  const ingnoreOnBlur = useRef((e: React.FocusEvent): boolean => {
    const searchbar = document.getElementById(SEARCHBAR_ID);
    if (searchbar) {
      return searchbar.contains(e.relatedTarget as Node);
    }
    return false;
  }).current;

  return (
    <TagSelector
      selection={selection.get()}
      onSelect={handleSelect}
      onDeselect={handleDeselect}
      onTagClick={uiStore.toggleAdvancedSearch}
      onClear={uiStore.clearSearchCriteriaList}
      ignoreOnBlur={ingnoreOnBlur}
      renderCreateOption={renderCreateOption}
      extraIconButtons={<SearchMatchButton disabled={selection.get().length < 2} />}
    />
  );
});

type QuickEPOption = RowProps & {
  query: string;
  resetTextBox: () => void;
  index: number;
};

const QuickExtraPropertySearchOption = (props: QuickEPOption) => {
  const { id, value, index, style, query, resetTextBox } = props;
  const { uiStore } = useStore();
  const [showExtraSelector, setShowExtraSelector] = useState(false);
  const {
    style: popoverStyle,
    reference,
    floating,
    update,
  } = usePopover('bottom-start', ['right', 'left', 'bottom', 'top'], 'fixed');

  useLayoutEffect(() => {
    if (showExtraSelector) {
      update();
    }
  }, [showExtraSelector, update]);

  const handleBlur = useRef((e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setShowExtraSelector(false);
    }
  }).current;

  const handleExtraPropertySelect = useCallback(
    (eventExtraProperty: ClientExtraProperty) => {
      resetTextBox();
      // Convert query to a valid value and set operator
      let value: any;
      let operator: OperatorType;
      switch (eventExtraProperty.type) {
        case ExtraPropertyType.text:
          value = query;
          operator = 'contains';
          break;
        case ExtraPropertyType.number:
          const match = query.match(/[-+]?\d*\.?\d+(e[-+]?\d+)?/i);
          value = match
            ? parseFloat(match[0])
            : getExtraPropertyDefaultValue(ExtraPropertyType.number);
          operator = 'equals';
          break;
        default:
          const _exhaustiveCheck: never = eventExtraProperty.type;
          return _exhaustiveCheck;
      }

      uiStore.addSearchCriteria(
        new ClientExtraPropertySearchCriteria(
          'extraProperties',
          [eventExtraProperty.id, value],
          operator,
        ),
      );
    },
    [query, resetTextBox, uiStore],
  );

  const portalRoot = document.getElementById(SEARCHBAR_ID);

  return (
    <>
      <Row
        style={style}
        id={id}
        index={index}
        value={value}
        onClick={() => {
          setShowExtraSelector(true);
        }}
      />
      {portalRoot &&
        // Need to use portals since popovers don't work inside containers that have the transform property, which is used in virtualized grid.
        ReactDOM.createPortal(
          <div ref={reference}>
            {showExtraSelector && (
              <div
                ref={floating}
                tabIndex={-1}
                onBlur={handleBlur}
                data-popover
                data-open={showExtraSelector}
                style={popoverStyle}
              >
                <ExtraPropertySelector onSelect={handleExtraPropertySelect} />
              </div>
            )}
          </div>,
          portalRoot,
        )}
    </>
  );
};

const SearchMatchButton = observer(({ disabled }: { disabled: boolean }) => {
  const { fileStore, uiStore } = useStore();

  const handleClick = useRef((e: React.MouseEvent) => {
    e.stopPropagation();
    uiStore.toggleSearchMatchAny();
    fileStore.refetch();
  }).current;

  return (
    <IconButton
      icon={uiStore.searchMatchAny ? IconSet.SEARCH_ANY : IconSet.SEARCH_ALL}
      text={`Search using ${uiStore.searchMatchAny ? 'any' : 'all'} queries`}
      onClick={handleClick}
      className="btn-icon-large"
      disabled={disabled}
    />
  );
});

const CriteriaList = observer(() => {
  const rootStore = useStore();
  const { fileStore, uiStore } = rootStore;
  return (
    <div className="input" onClick={uiStore.toggleAdvancedSearch}>
      <div className="multiautocomplete-input">
        <div className="input-wrapper">
          {uiStore.searchCriteriaList.map((c, i) => (
            <Tag
              key={`${i}-${c.getLabel(CustomKeyDict, rootStore)}`}
              text={c.getLabel(CustomKeyDict, rootStore)}
              onRemove={() => uiStore.removeSearchCriteriaByIndex(i)}
              // Italicize system tags (for now only "Untagged images")
              className={
                c instanceof ClientTagSearchCriteria && c.isSystemTag() ? 'italic' : undefined
              }
            />
          ))}
        </div>

        {uiStore.searchCriteriaList.length > 1 ? (
          <IconButton
            icon={uiStore.searchMatchAny ? IconSet.SEARCH_ANY : IconSet.SEARCH_ALL}
            text={`Search using ${uiStore.searchMatchAny ? 'any' : 'all'} queries`}
            onClick={(e) => {
              uiStore.toggleSearchMatchAny();
              fileStore.refetch();
              e.stopPropagation();
              e.preventDefault();
              // TODO: search input element keeps focus after click???
            }}
            className="btn-icon-large"
          />
        ) : (
          <> </>
        )}

        <IconButton
          icon={IconSet.CLOSE}
          text="Clear"
          onClick={(e) => {
            uiStore.clearSearchCriteriaList();
            e.stopPropagation();
            e.preventDefault();
          }}
        />
      </div>
    </div>
  );
});
