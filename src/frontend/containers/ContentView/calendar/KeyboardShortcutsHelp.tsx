import React, { useState, useEffect } from 'react';
import { IconSet, Button } from 'widgets';

export interface KeyboardShortcut {
  keys: string[];
  description: string;
  category: 'navigation' | 'selection' | 'actions';
}

export interface KeyboardShortcutsHelpProps {
  /** Whether the help is visible */
  isVisible: boolean;
  /** Callback to close the help */
  onClose: () => void;
  /** Additional shortcuts specific to the current context */
  additionalShortcuts?: KeyboardShortcut[];
}

/**
 * KeyboardShortcutsHelp component displays available keyboard shortcuts
 * for the calendar view with proper accessibility support.
 */
export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isVisible,
  onClose,
  additionalShortcuts = [],
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Default keyboard shortcuts for calendar view
  const defaultShortcuts: KeyboardShortcut[] = [
    {
      keys: ['↑', '↓', '←', '→'],
      description: 'Navigate between photos',
      category: 'navigation',
    },
    {
      keys: ['Enter', 'Space'],
      description: 'Select focused photo',
      category: 'selection',
    },
    {
      keys: ['Ctrl', 'Click'],
      description: 'Add photo to selection',
      category: 'selection',
    },
    {
      keys: ['Shift', 'Click'],
      description: 'Select range of photos',
      category: 'selection',
    },
    {
      keys: ['Ctrl', 'A'],
      description: 'Select all photos',
      category: 'selection',
    },
    {
      keys: ['Escape'],
      description: 'Clear selection',
      category: 'selection',
    },
    {
      keys: ['Delete'],
      description: 'Delete selected photos',
      category: 'actions',
    },
    {
      keys: ['F2'],
      description: 'Rename selected photo',
      category: 'actions',
    },
    {
      keys: ['?'],
      description: 'Show/hide keyboard shortcuts',
      category: 'actions',
    },
  ];

  const allShortcuts = [...defaultShortcuts, ...additionalShortcuts];

  // Group shortcuts by category
  const groupedShortcuts = allShortcuts.reduce((groups, shortcut) => {
    if (!groups[shortcut.category]) {
      groups[shortcut.category] = [];
    }
    groups[shortcut.category].push(shortcut);
    return groups;
  }, {} as Record<string, KeyboardShortcut[]>);

  // Handle keyboard navigation within the help dialog
  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(0, prev - 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(allShortcuts.length - 1, prev + 1));
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, onClose, allShortcuts.length]);

  // Focus management
  useEffect(() => {
    if (isVisible) {
      setFocusedIndex(0);
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case 'navigation':
        return 'Navigation';
      case 'selection':
        return 'Selection';
      case 'actions':
        return 'Actions';
      default:
        return 'Other';
    }
  };

  const formatKeys = (keys: string[]) => {
    return keys.join(' + ');
  };

  return (
    <div
      className="keyboard-shortcuts-help"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      aria-describedby="shortcuts-description"
    >
      <div className="keyboard-shortcuts-help__backdrop" onClick={onClose} />
      <div className="keyboard-shortcuts-help__content">
        <header className="keyboard-shortcuts-help__header">
          <h2 id="shortcuts-title" className="keyboard-shortcuts-help__title">
            Keyboard Shortcuts
          </h2>
          <Button
            styling="minimal"
            icon={IconSet.CLOSE}
            text=""
            onClick={onClose}
            aria-label="Close keyboard shortcuts help"
          />
        </header>

        <div id="shortcuts-description" className="keyboard-shortcuts-help__description">
          Use these keyboard shortcuts to navigate and interact with photos in calendar view.
          Navigate with arrow keys within this dialog.
        </div>

        <div className="keyboard-shortcuts-help__body">
          {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
            <section
              key={category}
              className="keyboard-shortcuts-help__category"
              aria-labelledby={`category-${category}`}
            >
              <h3 id={`category-${category}`} className="keyboard-shortcuts-help__category-title">
                {getCategoryTitle(category)}
              </h3>
              <ul className="keyboard-shortcuts-help__list" role="list">
                {shortcuts.map((shortcut, index) => {
                  const globalIndex = allShortcuts.indexOf(shortcut);
                  const isFocused = globalIndex === focusedIndex;

                  return (
                    <li
                      key={`${category}-${index}`}
                      className={`keyboard-shortcuts-help__item${
                        isFocused ? ' keyboard-shortcuts-help__item--focused' : ''
                      }`}
                      role="listitem"
                      tabIndex={isFocused ? 0 : -1}
                    >
                      <div
                        className="keyboard-shortcuts-help__keys"
                        role="group"
                        aria-label="Key combination"
                      >
                        {shortcut.keys.map((key, keyIndex) => (
                          <kbd
                            key={keyIndex}
                            className="keyboard-shortcuts-help__key"
                            aria-label={`Key: ${key}`}
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                      <div className="keyboard-shortcuts-help__description">
                        {shortcut.description}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="keyboard-shortcuts-help__footer">
          <p className="keyboard-shortcuts-help__tip">
            Press <kbd>?</kbd> to toggle this help, or <kbd>Escape</kbd> to close.
          </p>
        </footer>
      </div>
    </div>
  );
};
