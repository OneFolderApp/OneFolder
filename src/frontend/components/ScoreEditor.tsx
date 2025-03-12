import React from 'react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '../contexts/StoreContext';

import { Menu, MenuButton, useContextMenu } from 'widgets/menus';
import { ClientScore } from '../entities/Score';
import { FileScoreMenuItems } from '../containers/ContentView/menu-items';
import { useAction, useComputed } from '../hooks/mobx';
import { ScoreSelector } from './ScoreSelector';
import { ClientFile } from '../entities/File';
import { IComputedValue, runInAction } from 'mobx';
import { IconSet } from 'widgets/icons';
import { ScoreRemoval, ScoreUnAssign } from './RemovalAlert';
import { debounce } from 'common/timeout';

const ScoreEditor = ({ file }: { file?: ClientFile }) => {
  const { uiStore } = useStore();
  const [deletableScore, setDeletableScore] = useState<ClientScore>();
  const [removableScore, setRemovableScore] = useState<ClientScore>();

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
    for (const file of uiStore.fileSelection) {
      for (const [clientScore, value] of file.scores) {
        const entry = counter.get(clientScore) ?? [0, undefined];
        const [count] = entry;
        //update count and if count is bigger than one element set undefined value
        counter.set(clientScore, [count + 1, count > 0 ? undefined : value]);
      }
    }
    return counter;
  });

  const onSelect = useAction((score: ClientScore) => {
    uiStore.fileSelection.forEach((f) => f.setScore(score));
  });
  const onUpdate = useAction((score: ClientScore, value: number) => {
    uiStore.fileSelection.forEach((f) => f.setScore(score, value));
  });

  const scoreSelectorButton = useId();
  const scoreSelectorButtonMenuID = useId();
  const handleTagContextMenu = ScoreContextMenu({
    parentPopoverId: scoreSelectorButtonMenuID,
    onDeleteScore: setDeletableScore,
    onRemoveScore: setRemovableScore,
  });

  return (
    <div>
      {deletableScore && (
        <ScoreRemoval object={deletableScore} onClose={() => setDeletableScore(undefined)} />
      )}
      {removableScore && (
        <ScoreUnAssign object={removableScore} onClose={() => setRemovableScore(undefined)} />
      )}
      <MenuButton
        icon={IconSet.PLUS}
        text={'Add score to file.'}
        id={scoreSelectorButton}
        menuID={scoreSelectorButtonMenuID}
        placement="left-start"
        updateDependency={file}
      >
        <ScoreSelector
          counter={counter}
          onSelect={onSelect}
          showScoreContextMenu={handleTagContextMenu}
        />
      </MenuButton>
      <ScoreListEditor counter={counter} onUpdate={onUpdate} />
    </div>
  );
};

export default ScoreEditor;

interface IScoreContextMenuProps {
  parentPopoverId: string;
  onDeleteScore: (score: ClientScore) => void;
  onRemoveScore: (score: ClientScore) => void;
}

const ScoreContextMenu = ({
  parentPopoverId,
  onDeleteScore,
  onRemoveScore,
}: IScoreContextMenuProps) => {
  const getFocusableElement = useCallback(() => {
    return document
      .getElementById(parentPopoverId)
      ?.querySelector('input, textarea, button, a, select, [tabindex]') as HTMLElement | null;
  }, [parentPopoverId]);
  const handleMenuBlur = useRef((e: React.FocusEvent) => {
    if (!e.relatedTarget?.closest('[data-popover="true"]')) {
      const element = getFocusableElement();
      if (element && element instanceof HTMLElement) {
        element.focus();
        element.blur();
      }
    }
  }).current;
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
}

const ScoreListEditor = observer(({ counter, onUpdate }: ScoreListEditorProps) => {
  const { uiStore } = useStore();
  const scores = Array.from(counter.get()).sort(compareByScoreName);
  return (
    <table id="score-list-editor">
      <tbody>
        {scores.map(([score, [count, val]]) => (
          <ScoreListOption
            key={score.id}
            score={score}
            count={`${count}/${uiStore.fileSelection.size}`}
            value={val}
            onUpdate={onUpdate}
          />
        ))}
      </tbody>
    </table>
  );
});

interface IScoreListOptionProps {
  score: ClientScore;
  count: string | number;
  value?: number;
  onUpdate: (score: ClientScore, value: number) => void;
}

const ScoreListOption = observer(({ score, count, value, onUpdate }: IScoreListOptionProps) => {
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const debounceOnUpdate = useMemo(() => debounce(onUpdate, 500), [onUpdate]);

  const handleValueOnChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const eValue = e.target.value;
      //only accept number values and ignore anything else
      if (/^\d*\.?\d*$/.test(eValue)) {
        const newValue = eValue === '' ? 0 : parseFloat(eValue);
        setInputValue(newValue);
        debounceOnUpdate(score, newValue);
      }
    },
    [debounceOnUpdate, score],
  );
  return (
    <tr>
      <th data-tooltip={score.name}>
        <div className="label-container">
          <div className="score-label">{score.name}</div>
          <div className="count-hint">{count}</div>
        </div>
      </th>
      <td>
        <input
          type="number"
          data-tooltip={inputValue}
          value={inputValue}
          onChange={handleValueOnChange}
          className={'input'}
        />
      </td>
    </tr>
  );
});
