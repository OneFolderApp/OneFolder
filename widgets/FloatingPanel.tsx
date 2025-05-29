import React, { ReactNode, useCallback, useEffect, useRef } from 'react';
import FocusManager from 'src/frontend/FocusManager';
import { IconSet } from 'widgets/icons';

interface IFloatingPanelProps {
  id?: string;
  type?: string;
  title?: string;
  className?: string;
  onBlur: () => void;
  ignoreOnBlur?: (e: React.FocusEvent) => boolean;
  onToggleDock: () => void;
  children: ReactNode;
  dataOpen: boolean;
  isDocked: boolean;
}

export const FloatingPanel = (props: IFloatingPanelProps) => {
  const {
    id,
    type,
    title,
    className,
    onBlur,
    ignoreOnBlur,
    onToggleDock,
    dataOpen,
    isDocked,
    children,
  } = props;
  const panelRef = useRef<HTMLDivElement>(null);
  const dockingRef = useRef<HTMLDivElement>(null);
  const hasMounted = useRef(false);

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      if (
        !isDocked &&
        !(ignoreOnBlur ? ignoreOnBlur(e) : false) &&
        !e.currentTarget.contains(e.relatedTarget as Node) &&
        !e.relatedTarget?.closest('[data-contextmenu="true"]')
      ) {
        onBlur();
        FocusManager.focusGallery();
      }
    },
    [ignoreOnBlur, isDocked, onBlur],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape' && !isDocked) {
        e.stopPropagation();
        onBlur();
        FocusManager.focusGallery();
      }
    },
    [isDocked, onBlur],
  );

  const handleSwitchToSide = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggleDock();
    },
    [onToggleDock],
  );

  useEffect(() => {
    const panel = panelRef.current;
    if (panel) {
      panel.setAttribute('data-animate-flash', 'false');
      requestAnimationFrame(() => {
        panel.setAttribute('data-animate-flash', 'true');
      });
    }
  }, [type]);

  useEffect(() => {
    const panel = panelRef.current;
    const dockDiv = dockingRef.current;
    if (!dataOpen || !panel || !dockDiv || !hasMounted.current) {
      return;
    }
    if (isDocked) {
      animateFloatingToDocking(panel, dockDiv);
    } else {
      animateDockingToFloating(panel, dockDiv);
    }
  }, [isDocked]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const panel = panelRef.current;
    if (panel) {
      panel.setAttribute('data-docked', isDocked ? 'true' : 'false');
    }
    hasMounted.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={dockingRef} id={id} className={className}>
      <div
        ref={panelRef}
        data-popover
        data-open={dataOpen}
        data-animate-flash={dataOpen}
        className={'floating-panel'}
        tabIndex={-1} //necessary for handling the onblur correctly
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        {dataOpen ? (
          <>
            <header onClick={onBlur}>
              <h2>{title}</h2>
              <button
                className="floating-switch-side-button"
                data-tooltip="Switch to/from the side"
                onClick={handleSwitchToSide}
                aria-haspopup="menu"
                style={isDocked ? undefined : { transform: 'scaleX(-1)' }}
              >
                {IconSet.ARROW_RIGHT}
              </button>
            </header>
            {children}
          </>
        ) : null}
      </div>
    </div>
  );
};

function animateDockingToFloating(panel: HTMLElement, DockContainer: HTMLElement) {
  const rect = DockContainer.getBoundingClientRect();
  panel.setAttribute('data-animate-flash', 'false');
  panel.setAttribute(
    'style',
    `
    position: fixed;
    top: ${0}px;
    left: ${0}px;
    width: ${rect.width}px;
    transform: translate(${rect.left}px, ${rect.top}px);
  `,
  );
  requestAnimationFrame(() => {
    panel.setAttribute('data-docked', 'false');
    panel.removeAttribute('style');
  });
}

function animateFloatingToDocking(panel: HTMLElement, DockContainer: HTMLElement) {
  const rect = DockContainer.getBoundingClientRect();
  panel.setAttribute('data-animate-flash', 'false');
  requestAnimationFrame(() => {
    panel.setAttribute(
      'style',
      `
      position: fixed;
      top: ${0}px;
      left: ${0}px;
      width: ${rect.width}px;
      transform: translate(${rect.left}px, ${rect.top}px);
    `,
    );
    panel.removeAttribute('data-docked');
    const onTransitionEnd = () => {
      panel.setAttribute('data-docked', 'true');
      panel.removeAttribute('style');
    };
    panel.addEventListener('transitionend', onTransitionEnd, { once: true });
  });
}
