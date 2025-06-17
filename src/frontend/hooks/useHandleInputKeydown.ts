import { useCallback } from 'react';

// A custom hook that returns a memoized callback to handle keydown events on
// input elements, preventing interference from gallery navigation keyboard
// shortcuts while allowing navigation when the Alt key is pressed.
export function useGalleryInputKeydownHandler() {
  return useCallback((e: React.KeyboardEvent) => {
    // Allow gallery navigation with Alt + Arrow keys, even when the input is focused.
    if (e.altKey) {
      e.preventDefault();
      return;
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
