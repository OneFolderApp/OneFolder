import React, { useReducer } from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../contexts/StoreContext';

import { Menu, MenuButton, useContextMenu } from 'widgets/menus';
import { ClientExtraProperty } from '../entities/ExtraProperty';
import { FileExtraPropertyMenuItems } from '../containers/ContentView/menu-items';
import { useAutorun, useComputed } from '../hooks/mobx';
import { ExtraPropertySelector } from './ExtraPropertySelector';
import { ClientFile } from '../entities/File';
import { IComputedValue, runInAction } from 'mobx';
import { IconSet } from 'widgets/icons';
import {
  ExtraPropertyOverwrite,
  ExtraPropertyRemoval,
  ExtraPropertyUnAssign,
} from './RemovalAlert';
import { debounce } from 'common/timeout';
import { IAction } from '../containers/types';
import { ID } from 'src/api/id';
import { useGalleryInputKeydownHandler } from '../hooks/useHandleInputKeydown';
import { ExtraPropertyValue } from 'src/api/extraProperty';
import { createPortal } from 'react-dom';

export type ExtraPropertiesCounter = IComputedValue<
  Map<ClientExtraProperty, [number, ExtraPropertyValue | undefined]>
>;

interface FileExtraPropertiesEditorProps {
  file?: ClientFile;
  addButtonContainerID?: string;
}

export const FileExtraPropertiesEditor = observer(
  ({ file, addButtonContainerID }: FileExtraPropertiesEditorProps) => {
    const { uiStore, fileStore } = useStore();
    const [deletableExtraProperty, setDeletableExtraProperty] = useState<ClientExtraProperty>();
    const [removableExtraProperty, setRemovableExtraProperty] = useState<{
      files: ClientFile[];
      extraProperty: ClientExtraProperty;
    }>();
    const [assignableExtPropertyValue, setAssignableExtPropertyValue] = useState<{
      files: ClientFile[];
      extraProperty: ClientExtraProperty;
      value: number;
    }>();
    const [editorState, dispatch] = useReducer(reducer, {
      editableNode: undefined,
    });

    useEffect(() => {
      runInAction(() => {
        if (file && uiStore.fileSelection.size < 1) {
          uiStore.selectFile(file);
        }
      });
    }, [file, uiStore]);

    const counter: ExtraPropertiesCounter = useComputed(() => {
      //Map of Clientstores: and a tuple of count, value
      const counter = new Map<ClientExtraProperty, [number, ExtraPropertyValue | undefined]>();
      const isMultiple = uiStore.fileSelection.size > 1;
      for (const file of uiStore.fileSelection) {
        for (const [clientExtraProperty, value] of file.extraProperties) {
          const entry = counter.get(clientExtraProperty) ?? [0, undefined];
          const [count] = entry;
          //update count and if count is bigger than one element set undefined value
          counter.set(clientExtraProperty, [count + 1, isMultiple ? undefined : value]);
        }
      }
      return counter;
    });

    const files = Array.from(uiStore.fileSelection);
    const onSelect = useCallback(
      (extraProperty: ClientExtraProperty) => {
        files.forEach((f) => f.setExtraProperty(extraProperty));
      },
      [files],
    );
    const onUpdate = useCallback(
      (extraProperty: ClientExtraProperty, value: number) => {
        setAssignableExtPropertyValue({ files: files, extraProperty: extraProperty, value: value });
      },
      [files],
    );
    const onRemove = useCallback(
      (extraProperty: ClientExtraProperty) => {
        setRemovableExtraProperty({ files: files, extraProperty: extraProperty });
      },
      [files],
    );
    const onRename = useCallback(
      (extraProperty: ClientExtraProperty) =>
        runInAction(() => {
          let found = 0;
          if (files.length > 0) {
            for (const file of files) {
              if (file.extraProperties.has(extraProperty)) {
                found = 1;
                break;
              }
            }
          }
          if (found === 0) {
            for (const file of fileStore.fileList) {
              if (file && file.extraProperties.has(extraProperty)) {
                found = 2;
                uiStore.selectFile(file);
                break;
              }
            }
          }
          if (found === 0) {
            const firstfile = uiStore.firstFileInView;
            if (firstfile) {
              uiStore.selectFile(firstfile);
              firstfile.setExtraProperty(extraProperty, -1);
            }
          }
          dispatch(Factory.enableEditing(extraProperty.id));
        }),
      [fileStore.fileList, files, uiStore],
    );

    const extraPropertySelectorButtonID = useId();
    const extraPropertySelectorButtonMenuID = useId();
    const handleContextMenu = ExtraPropertyContextMenu({
      parentPopoverId: extraPropertySelectorButtonMenuID,
      onDeleteExtraProperty: setDeletableExtraProperty,
      onRemoveExtraProperty: onRemove,
      onRenameExtraProperty: onRename,
    });

    // Autofocus
    const buttonParentRef = useRef<HTMLDivElement>(null);
    const focusButton = useRef(() => {
      requestAnimationFrame(() => requestAnimationFrame(() => buttonParentRef.current?.focus()));
    }).current;
    useAutorun(() => {
      if (uiStore.isFileExtraPropertiesEditorOpen) {
        focusButton();
      }
    });

    return (
      <div className="extra-property-editor">
        {deletableExtraProperty && (
          <ExtraPropertyRemoval
            object={deletableExtraProperty}
            onClose={() => setDeletableExtraProperty(undefined)}
          />
        )}
        {removableExtraProperty && (
          <ExtraPropertyUnAssign
            object={removableExtraProperty}
            onClose={() => setRemovableExtraProperty(undefined)}
          />
        )}
        {assignableExtPropertyValue && (
          <ExtraPropertyOverwrite
            object={assignableExtPropertyValue}
            onClose={() => setAssignableExtPropertyValue(undefined)}
          />
        )}
        <PortalButtonWrapper containerId={addButtonContainerID} onPortalCreation={focusButton}>
          <div tabIndex={-1} ref={buttonParentRef}>
            <MenuButton
              icon={IconSet.PLUS}
              text=""
              tooltip="Add extra property to file"
              id={extraPropertySelectorButtonID}
              menuID={extraPropertySelectorButtonMenuID}
              placement="left-start"
              updateDependency={file}
            >
              <ExtraPropertySelector
                counter={counter}
                onSelect={onSelect}
                onContextMenu={handleContextMenu}
              />
            </MenuButton>
          </div>
        </PortalButtonWrapper>
        {uiStore.fileSelection.size === 0 && (
        <div><i><b>No files selected</b></i></div> // eslint-disable-line prettier/prettier
        )}
        <ExtraPropertyListEditor
          editorState={editorState}
          dispatch={dispatch}
          counter={counter}
          onUpdate={onUpdate}
          onContextMenu={handleContextMenu}
        />
      </div>
    );
  },
);

export default FileExtraPropertiesEditor;

interface PortalButtonWrapperProps {
  containerId?: string;
  children: React.ReactNode;
  onPortalCreation?: () => void;
}

const PortalButtonWrapper = ({
  containerId,
  children,
  onPortalCreation,
}: PortalButtonWrapperProps) => {
  const [container, setContainer] = useState<HTMLElement | null | undefined>(undefined);

  useEffect(() => {
    if (!containerId) {
      return;
    }
    const element = document.getElementById(containerId);
    if (element) {
      setContainer(element);
      return;
    }
    // Fallback: observe DOM if container doesn't exist yet
    const observer = new MutationObserver(() => {
      const found = document.getElementById(containerId);
      if (found) {
        setContainer(found);
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [containerId]);

  useEffect(() => {
    if (container && onPortalCreation) {
      requestAnimationFrame(() => {
        onPortalCreation();
      });
    }
  }, [container]); // eslint-disable-line react-hooks/exhaustive-deps

  return container === undefined && containerId ? null : container ? (
    createPortal(children, container)
  ) : (
    <>{children}</>
  );
};

interface IExtraPropertyContextMenu {
  parentPopoverId: string;
  onDeleteExtraProperty: (extraProperty: ClientExtraProperty) => void;
  onRemoveExtraProperty: (extraProperty: ClientExtraProperty) => void;
  onRenameExtraProperty: (extraProperty: ClientExtraProperty) => void;
}

const ExtraPropertyContextMenu = ({
  parentPopoverId,
  onDeleteExtraProperty,
  onRemoveExtraProperty,
  onRenameExtraProperty,
}: IExtraPropertyContextMenu) => {
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
  const handleOnRemove = useCallback(
    (extraProperty: ClientExtraProperty) => {
      onRemoveExtraProperty(extraProperty);
      const element = getFocusableElement();
      if (element && element instanceof HTMLElement) {
        element.focus();
      }
    },
    [getFocusableElement, onRemoveExtraProperty],
  );
  const handleOnRename = useCallback(
    (extraProperty: ClientExtraProperty) => {
      const element = getFocusableElement();
      if (element && element instanceof HTMLElement) {
        element.focus();
      }
      onRenameExtraProperty(extraProperty);
    },
    [getFocusableElement, onRenameExtraProperty],
  );
  const handleOnDelete = useCallback(
    (extraProperty: ClientExtraProperty) => {
      onDeleteExtraProperty(extraProperty);
      const element = getFocusableElement();
      if (element && element instanceof HTMLElement) {
        element.focus();
      }
    },
    [getFocusableElement, onDeleteExtraProperty],
  );
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const divRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (activeMenuId && divRef.current) {
      divRef.current.focus();
    }
  }, [activeMenuId]);

  const show = useContextMenu();
  const handleTagContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>, extraProperty: ClientExtraProperty) => {
      event.stopPropagation();
      show(
        event.clientX,
        event.clientY,
        <div ref={divRef} onBlur={handleMenuBlur} onKeyDown={handleMenuKeyDown} tabIndex={-1}>
          <Menu>
            <FileExtraPropertyMenuItems
              extraProperty={extraProperty}
              onDelete={handleOnDelete}
              onRemove={handleOnRemove}
              onRename={handleOnRename}
            />
          </Menu>
        </div>,
      );
      setActiveMenuId(extraProperty.id);
    },
    [show, handleMenuBlur, handleMenuKeyDown, handleOnDelete, handleOnRemove, handleOnRename],
  );

  return handleTagContextMenu;
};

const compareByExtraPropertyName = (
  a: [ClientExtraProperty, [number, ExtraPropertyValue | undefined]],
  b: [ClientExtraProperty, [number, ExtraPropertyValue | undefined]],
) => {
  return a[0].name.localeCompare(b[0].name);
};

interface ExtraPropertyListEditorProps {
  editorState: State;
  dispatch: React.Dispatch<Action>;
  counter: ExtraPropertiesCounter;
  onUpdate: (extraProperty: ClientExtraProperty, value: number) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, extraProperty: ClientExtraProperty) => void;
}

const ExtraPropertyListEditor = observer(
  ({ editorState, dispatch, counter, onUpdate, onContextMenu }: ExtraPropertyListEditorProps) => {
    const { uiStore } = useStore();
    const extraProperties = Array.from(counter.get()).sort(compareByExtraPropertyName);
    const SelectionSize = uiStore.fileSelection.size;
    const handleKeyDown = useGalleryInputKeydownHandler();
    const handleRename = useCallback(
      (extraProperty: ClientExtraProperty) => dispatch(Factory.enableEditing(extraProperty.id)),
      [dispatch],
    );
    const onUpdateName = useRef(() => {
      dispatch(Factory.disableEditing());
    }).current;
    return (
      <div className="extra-property-list-editor">
        {extraProperties.map(([extraProperty, [count, val]]) => (
          <ExtraPropertyListOption
            key={extraProperty.id}
            extraProperty={extraProperty}
            count={SelectionSize > 1 ? `${count}/${SelectionSize}` : ''}
            value={typeof val === 'number' ? val : undefined}
            onUpdate={onUpdate}
            isEditingName={editorState.editableNode === extraProperty.id}
            onUpdateName={onUpdateName}
            handleRename={handleRename}
            onContextMenu={onContextMenu}
            handleKeyDown={handleKeyDown}
          />
        ))}
      </div>
    );
  },
);

interface IExtraPropertyListOptionProps {
  extraProperty: ClientExtraProperty;
  count: string | number;
  value?: number;
  isEditingName: boolean;
  onUpdate: (extraProperty: ClientExtraProperty, value: number) => void;
  onUpdateName: (target: EventTarget & HTMLInputElement) => void;
  handleRename: (extraProperty: ClientExtraProperty) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, extraProperty: ClientExtraProperty) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const ExtraPropertyListOption = observer(
  ({
    extraProperty,
    count,
    value,
    onUpdate,
    isEditingName,
    onUpdateName,
    handleRename,
    onContextMenu,
    handleKeyDown,
  }: IExtraPropertyListOptionProps) => {
    const [inputValue, setInputValue] = useState(value !== undefined ? value : '');

    useEffect(() => {
      setInputValue(value !== undefined ? value : '');
    }, [value]);

    const debounceOnUpdate = useMemo(() => debounce(onUpdate, 500), [onUpdate]);

    const handleValueOnChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const eValue = e.target.value;
        //only accept number values and ignore anything else
        if (/^\d*\.?\d*$/.test(eValue)) {
          const newValue = eValue === '' ? 0 : parseFloat(eValue);
          if (newValue < 100000000) {
            setInputValue(newValue);
            debounceOnUpdate(extraProperty, newValue);
          }
        }
      },
      [debounceOnUpdate, extraProperty],
    );
    return (
      <div
        className="extra-property-list-option"
        onContextMenu={
          onContextMenu !== undefined ? (e) => onContextMenu(e, extraProperty) : undefined
        }
      >
        <div className="extra-property-name">
          <div className="label-container" onDoubleClick={() => handleRename(extraProperty)}>
            <Label
              text={extraProperty.name}
              setText={extraProperty.rename}
              isEditing={isEditingName}
              onSubmit={onUpdateName}
              tooltip={extraProperty.name}
            />
            <div className="count-hint">{count}</div>
          </div>
        </div>
        <div className="extra-property-value">
          <input
            type="number"
            data-tooltip={inputValue}
            title={inputValue.toString()}
            value={inputValue}
            onChange={handleValueOnChange}
            onKeyDown={handleKeyDown}
            className={'input'}
          />
        </div>
      </div>
    );
  },
);

interface ILabelProps {
  text: string;
  setText: (value: string) => void;
  isEditing: boolean;
  onSubmit: (target: EventTarget & HTMLInputElement) => void;
  tooltip?: string;
}

const Label = (props: ILabelProps) =>
  props.isEditing ? (
    <input
      className="input"
      autoFocus
      type="text"
      defaultValue={props.text}
      onBlur={(e) => {
        const value = e.currentTarget.value.trim();
        if (value.length > 0) {
          props.setText(value);
        }
        props.onSubmit(e.currentTarget);
      }}
      onKeyDown={(e) => {
        e.stopPropagation();
        const value = e.currentTarget.value.trim();
        if (e.key === 'Enter' && value.length > 0) {
          props.setText(value);
          props.onSubmit(e.currentTarget);
        } else if (e.key === 'Escape') {
          props.onSubmit(e.currentTarget); // cancel with escape
        }
      }}
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
    />
  ) : (
    <div className="extra-property-label" data-tooltip={props.tooltip}>
      {props.text}
    </div>
  );

const enum Flag {
  EnableEditing,
  DisableEditing,
}

type Action = IAction<Flag.EnableEditing, ID> | IAction<Flag.DisableEditing, undefined>;

const Factory = {
  enableEditing: (data: ID): Action => ({
    flag: Flag.EnableEditing,
    data,
  }),
  disableEditing: (): Action => ({
    flag: Flag.DisableEditing,
    data: undefined,
  }),
};

type State = {
  editableNode: ID | undefined;
};

export function reducer(state: State, action: Action): State {
  switch (action.flag) {
    case Flag.EnableEditing:
      return {
        ...state,
        editableNode: action.data,
      };

    case Flag.DisableEditing:
      return {
        ...state,
        editableNode: action.data,
      };

    default:
      return state;
  }
}
