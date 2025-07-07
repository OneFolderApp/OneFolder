import { useCallback, useRef } from 'react';
import { comboMatches, getKeyCombo, parseKeyCombo } from '../hotkeyParser';
import { useStore } from '../contexts/StoreContext';
import { action } from 'mobx';

// A custom hook that returns a memoized callback to handle keydown events on
// input elements, preventing interference from gallery navigation keyboard
// shortcuts while allowing navigation when the Alt key is pressed.
export function useGalleryInputKeydownHandler() {
  const { uiStore } = useStore();

  const procesGalleryInputShortcuts = useRef(
    action((e: React.KeyboardEvent): boolean => {
      const combo = getKeyCombo(e.nativeEvent);
      const matches = (c: string): boolean => {
        return comboMatches(combo, parseKeyCombo(c));
      };
      const { hotkeyMap } = uiStore;

      if (matches(hotkeyMap.advancedSearch)) {
        uiStore.toggleAdvancedSearch();
      } else {
        // If no shortcut matches, return false.
        return false;
      }
      return true;
    }),
  ).current;

  return useCallback((e: React.KeyboardEvent) => {
    // Allow gallery navigation with Alt + Arrow keys, even when the input is focused.
    if (procesGalleryInputShortcuts(e)) {
      e.preventDefault();
      return;
    }
    if (e.altKey) {
      e.preventDefault();
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (e.target instanceof HTMLInputElement) {
        e.target.blur();
      }
    }
    // if Alt is not pressed, stop propagation to keep focus on the selected item.
    e.stopPropagation(); //Prevent event to propagate to the gallery
    // execute default behavior
    switch (e.key) {
      // Add extra behavior if needed
      default:
        break;
    }
  }, []);
}
