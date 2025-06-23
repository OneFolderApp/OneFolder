import React, { useCallback, useEffect } from 'react';
import { observer } from 'mobx-react-lite';

import { useStore } from './contexts/StoreContext';

import ErrorBoundary from './containers/ErrorBoundary';
import HelpCenter from './containers/HelpCenter';
import { AppToaster, Toaster as CustomToaster } from './components/Toaster';

import AdvancedSearchDialog from './containers/AdvancedSearch';
import Settings from './containers/Settings';

import { useWorkerListener } from './image/ThumbnailGeneration';
import WindowTitlebar from './containers/WindowTitlebar';
import { DropContextProvider } from './contexts/DropContext';
import Main from './containers/Main';
import About from './containers/About';
import { CustomThemeProvider } from './hooks/useCustomTheme';
import { useClipboardImporter } from './hooks/useClipboardImporter';
import { reaction } from 'mobx';

const PLATFORM = process.platform;

const App = observer(() => {
  const { uiStore } = useStore();

  // Listen to responses of Web Workers
  useWorkerListener();
  useClipboardImporter(uiStore);

  const isOutlinerOpen = uiStore.isOutlinerOpen;

  useEffect(() => {
    // Add listener for global keyboard shortcuts
    window.addEventListener('keydown', uiStore.processGlobalShortCuts);

    return () => window.removeEventListener('keydown', uiStore.processGlobalShortCuts);
  }, [uiStore.processGlobalShortCuts]);

  // Automatically expand outliner when detecting a drag event
  const openOutlinerOnDragEnter = useCallback(() => {
    if (!isOutlinerOpen) {
      uiStore.toggleOutliner();
    }
  }, [uiStore, isOutlinerOpen]);

  // Extract rgb values from theme styles to use alpha chanel with them
  useEffect(() => {
    const dispose = reaction(
      () => ({ theme: uiStore.theme, scrollbarsStyle: uiStore.scrollbarsStyle }),
      (props) => {
        if (props.scrollbarsStyle === 'hover') {
          requestAnimationFrame(() => {
            extractAndSetRawColorVars();
          });
        }
      },
      {
        fireImmediately: true,
      },
    );

    return () => dispose();
  }, [uiStore]);

  return (
    <CustomThemeProvider>
      <DropContextProvider onDragEnter={openOutlinerOnDragEnter}>
        <div
          data-os={PLATFORM}
          data-fullscreen={uiStore.isFullScreen}
          id="layout-container"
          className={`${uiStore.theme} scrollbar-${uiStore.scrollbarsStyle}`}
        >
          {!uiStore.isFullScreen && <WindowTitlebar />}

          <ErrorBoundary>
            <Main />

            <Settings />

            <HelpCenter />

            <About />

            <AdvancedSearchDialog />

            <CustomToaster />
          </ErrorBoundary>
        </div>
      </DropContextProvider>
    </CustomThemeProvider>
  );
});

export default App;

function extractAndSetRawColorVars() {
  const container = document.getElementById('layout-container');
  if (container) {
    const style = getComputedStyle(container);
    const vars = [
      '--text-color',
      '--text-color-alt',
      '--text-color-muted',
      '--text-color-strong',
      '--background-color',
      '--background-color-alt',
      '--background-color-selected',
      '--shade1',
      '--shade2',
    ];

    vars.forEach((v) => {
      const value = style.getPropertyValue(v).trim(); // e.g. "rgb(200, 200, 200)" or "#2e5b84"
      const raw =
        value.startsWith('rgb') && value.includes(',')
          ? value.match(/\(([^)]+)\)/)?.[1] //extracts the 3 values
          : null;

      if (raw) {
        container.style.setProperty(`${v}-raw`, raw);
      }
    });
  }
}
