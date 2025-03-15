import React from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../contexts/StoreContext';

import { Menu, MenuButton, useContextMenu } from 'widgets/menus';
import { ClientScore } from '../entities/Score';
import { FileScoreMenuItems } from '../containers/ContentView/menu-items';
import { useAutorun, useComputed } from '../hooks/mobx';
import { ScoreSelector } from './ScoreSelector';
import { ClientFile } from '../entities/File';
import { IComputedValue, runInAction } from 'mobx';
import { IconSet } from 'widgets/icons';
import { ScoreOverwrite, ScoreRemoval, ScoreUnAssign } from './RemovalAlert';
import { debounce } from 'common/timeout';
import { FloatingPanel } from '../containers/AppToolbar/FileTagEditor';
import { ToolbarButton } from 'widgets/toolbar';

export const FloatingScoreEditor = observer(() => {
  const { uiStore } = useStore();
  return (
    <>
      <ToolbarButton
        icon={IconSet.FILTER_FILTER_DOWN}
        //disabled={uiStore.fileSelection.size === 0 && !uiStore.isScorePopoverOpen}
        onClick={uiStore.toggleScorePopover}
        text="Score selected files"
        tooltip="Add or remove scores from selected images"
      />
      <FloatingPanel
        title="Score Editor"
        dataOpen={uiStore.isScorePopoverOpen}
        onBlur={uiStore.closeScorePopover}
      >
        <ScoreEditor />
      </FloatingPanel>
    </>
  );
});

const ScoreEditor = observer(({ file }: { file?: ClientFile }) => {
  const { uiStore } = useStore();
  const [deletableScore, setDeletableScore] = useState<ClientScore>();
  const [removableScore, setRemovableScore] = useState<{
    files: ClientFile[];
    score: ClientScore;
  }>();
  const [assignableScoreValue, setAssignableScoreValue] = useState<{
    files: ClientFile[];
    score: ClientScore;
    value: number;
  }>();

  useEffect(() => {
    runInAction(() => {
      if (file && uiStore.fileSelection.size < 1) {
        uiStore.selectFile(file);
      }
    });
  }, [file, uiStore]);

  const counter = useComputed(() => {
    //Map of Clientstores: and a tuple of count, value
    const counter = new Map<ClientScore, [number, number | undefined]>();
    const isMultiple = uiStore.fileSelection.size > 1;
    for (const file of uiStore.fileSelection) {
      for (const [clientScore, value] of file.scores) {
        const entry = counter.get(clientScore) ?? [0, undefined];
        const [count] = entry;
        //update count and if count is bigger than one element set undefined value
        counter.set(clientScore, [count + 1, isMultiple ? undefined : value]);
      }
    }
    return counter;
  });

  const files = Array.from(uiStore.fileSelection);
  const onSelect = useCallback(
    (score: ClientScore) => {
      files.forEach((f) => f.setScore(score));
    },
    [files],
  );
  const onUpdate = useCallback(
    (score: ClientScore, value: number) => {
      setAssignableScoreValue({ files: files, score: score, value: value });
    },
    [files],
  );
  const onRemove = useCallback(
    (score: ClientScore) => {
      setRemovableScore({ files: files, score: score });
    },
    [files],
  );

  // Autofocus
  const buttonParentRef = useRef<HTMLDivElement>(null);
  useAutorun(() => {
    if (uiStore.isScorePopoverOpen) {
      requestAnimationFrame(() => requestAnimationFrame(() => buttonParentRef.current?.focus()));
    }
  });

  const scoreSelectorButton = useId();
  const scoreSelectorButtonMenuID = useId();
  const handleTagContextMenu = ScoreContextMenu({
    parentPopoverId: scoreSelectorButtonMenuID,
    onDeleteScore: setDeletableScore,
    onRemoveScore: onRemove,
  });

  return (
    <div className="score-editor">
      {deletableScore && (
        <ScoreRemoval object={deletableScore} onClose={() => setDeletableScore(undefined)} />
      )}
      {removableScore && (
        <ScoreUnAssign object={removableScore} onClose={() => setRemovableScore(undefined)} />
      )}
      {assignableScoreValue && (
        <ScoreOverwrite
          object={assignableScoreValue}
          onClose={() => setAssignableScoreValue(undefined)}
        />
      )}
      <div tabIndex={-1} ref={buttonParentRef}>
        <MenuButton
          icon={IconSet.PLUS}
          text={'Add score to file'}
          id={scoreSelectorButton}
          menuID={scoreSelectorButtonMenuID}
          placement="left-start"
          updateDependency={file}
        >
          <ScoreSelector
            counter={counter}
            onSelect={onSelect}
            onContextMenu={handleTagContextMenu}
          />
        </MenuButton>
      </div>
      <ScoreListEditor counter={counter} onUpdate={onUpdate} onContextMenu={handleTagContextMenu} />
    </div>
  );
});

export default ScoreEditor;

interface IScoreContextMenu {
  parentPopoverId: string;
  onDeleteScore: (score: ClientScore) => void;
  onRemoveScore: (score: ClientScore) => void;
}

const ScoreContextMenu = ({ parentPopoverId, onDeleteScore, onRemoveScore }: IScoreContextMenu) => {
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
    (score: ClientScore) => {
      onRemoveScore(score);
      const element = getFocusableElement();
      if (element && element instanceof HTMLElement) {
        element.focus();
      }
    },
    [getFocusableElement, onRemoveScore],
  );
  const handleOnDelete = useCallback(
    (score: ClientScore) => {
      onDeleteScore(score);
      const element = getFocusableElement();
      if (element && element instanceof HTMLElement) {
        element.focus();
      }
    },
    [getFocusableElement, onDeleteScore],
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
    (event: React.MouseEvent<HTMLElement>, score: ClientScore) => {
      event.stopPropagation();
      show(
        event.clientX,
        event.clientY,
        <div ref={divRef} onBlur={handleMenuBlur} onKeyDown={handleMenuKeyDown} tabIndex={-1}>
          <Menu>
            <FileScoreMenuItems score={score} onDelete={handleOnDelete} onRemove={handleOnRemove} />
          </Menu>
        </div>,
      );
      setActiveMenuId(score.id);
    },
    [show, handleMenuBlur, handleMenuKeyDown, handleOnDelete, handleOnRemove],
  );

  return handleTagContextMenu;
};

const compareByScoreName = (
  a: [ClientScore, [number, number | undefined]],
  b: [ClientScore, [number, number | undefined]],
) => {
  return a[0].name.localeCompare(b[0].name);
};

interface ScoreListEditorProps {
  counter: IComputedValue<Map<ClientScore, [number, number | undefined]>>;
  onUpdate: (score: ClientScore, value: number) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, score: ClientScore) => void;
}

const ScoreListEditor = observer(({ counter, onUpdate, onContextMenu }: ScoreListEditorProps) => {
  const { uiStore } = useStore();
  const scores = Array.from(counter.get()).sort(compareByScoreName);
  const SelectionSize = uiStore.fileSelection.size;
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      // Prevent backspace from navigating back to main view when having an image open
      e.stopPropagation();
    }

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      // If shift key is pressed with arrow keys left/right,
      // stop those key events from propagating to the gallery,
      // so that the cursor in the text input can be moved without selecting the prev/next image
      // Kind of an ugly work-around, but better than not being able to move the cursor at all
      if (!e.ctrlKey) {
        e.stopPropagation(); // move text cursor as expected (and select text because shift is pressed)
      } else {
        e.preventDefault(); // don't do anything here: let the event propagate to the gallery
      }
    }
  }, []);
  return (
    <div className="score-list-editor">
      {scores.map(([score, [count, val]]) => (
        <ScoreListOption
          key={score.id}
          score={score}
          count={SelectionSize > 1 ? `${count}/${SelectionSize}` : ''}
          value={val}
          onUpdate={onUpdate}
          onContextMenu={onContextMenu}
          handleKeyDown={handleKeyDown}
        />
      ))}
    </div>
  );
});

interface IScoreListOptionProps {
  score: ClientScore;
  count: string | number;
  value?: number;
  onUpdate: (score: ClientScore, value: number) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLElement>, score: ClientScore) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const ScoreListOption = observer(
  ({ score, count, value, onUpdate, onContextMenu, handleKeyDown }: IScoreListOptionProps) => {
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
            debounceOnUpdate(score, newValue);
          }
        }
      },
      [debounceOnUpdate, score],
    );
    return (
      <div
        className="score-list-option"
        onContextMenu={onContextMenu !== undefined ? (e) => onContextMenu(e, score) : undefined}
      >
        <div className="score-name">
          <div className="label-container">
            <div className="score-label" data-tooltip={score.name}>
              {score.name}
            </div>
            <div className="count-hint">{count}</div>
          </div>
        </div>
        <div className="score-value">
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
