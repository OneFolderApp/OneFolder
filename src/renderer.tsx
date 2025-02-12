
/**
 * Updated renderer.tsx to remove all Dexie references and use our Yjs backend.
 * We still do the same general initialization and pass the Yjs-based backend
 * to the RootStore. The BackupScheduler is also Yjs-based now.
 *
 * This update also includes logic to update the BackupScheduler's directory
 * to a 'onefolder_tags' folder located at the root of the user's location.
 */
import './style.scss';

import fse from 'fs-extra';
import { autorun, reaction, runInAction } from 'mobx';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { IS_DEV } from 'common/process';
import { IS_PREVIEW_WINDOW, WINDOW_STORAGE_KEY } from 'common/window';
import { RendererMessenger } from 'src/ipc/renderer';

import * as Y from 'yjs';
import BackupScheduler from './backend/backup-scheduler';
import Backend from './backend/backend';
import { DB_NAME, AUTO_BACKUP_TIMEOUT, NUM_AUTO_BACKUPS } from './backend/config';

import App from './frontend/App';
import SplashScreen from './frontend/containers/SplashScreen';
import StoreProvider from './frontend/contexts/StoreContext';
import Overlay from './frontend/Overlay';
import PreviewApp from './frontend/Preview';
import { FILE_STORAGE_KEY } from './frontend/stores/FileStore';
import RootStore from './frontend/stores/RootStore';
import { PREFERENCES_STORAGE_KEY } from './frontend/stores/UiStore';
import path from 'path';

async function main(): Promise<void> {
  console.groupCollapsed('Initializing OneFolder');
  const container = document.getElementById('app');
  if (!container) {
    throw new Error('Unable to create user interface.');
  }

  const root = createRoot(container);
  root.render(<SplashScreen />);

  // We no longer use Dexie or "dbInit" here. Instead we create a single Y.Doc:
  if (!IS_PREVIEW_WINDOW) {
    await runMainApp(root);
  } else {
    await runPreviewApp(root);
  }

  console.groupEnd();
}

async function runMainApp(root: Root): Promise<void> {
  // 1. Ensure backup directory (default)
  const defaultBackupDirectory = await RendererMessenger.getDefaultBackupDirectory();
  await fse.ensureDir(defaultBackupDirectory);

  // 2. Create the Y.Doc that holds our data
  const ydoc = new Y.Doc();

  // 3. Create BackupScheduler for full Yjs backups using the default directory.
  // Retrieve the local session ID and pass it along.
  const sessionId = await RendererMessenger.getSessionId();
  const backup = await BackupScheduler.init(ydoc, defaultBackupDirectory, sessionId);

  // 4. Create the Yjs-based backend
  //    We pass a "notifyChange" callback that schedules an auto-backup
  const backend = await Backend.init(ydoc, () => backup.schedule());

  // 5. Update the backup directory based on the user's location.
  // For our POC, we assume there is only one location.
  const locations = await backend.fetchLocations();
  if (locations.length > 0) {
    const primaryLocation = locations[0];
    const newBackupDirectory = path.join(primaryLocation.path, 'onefolder_tags');
    await backup.updateBackupDirectory(newBackupDirectory);
    console.log('Updated backup directory to', newBackupDirectory);
  }

  // 6. Initialize the main RootStore with our backend & backup
  const rootStore = await RootStore.main(backend, backup);

  // Let main process know we're ready
  RendererMessenger.initialized();

  // Recover global window preferences (fullscreen)
  try {
    const windowPreferences = localStorage.getItem(WINDOW_STORAGE_KEY);
    if (!windowPreferences) {
      localStorage.setItem(WINDOW_STORAGE_KEY, JSON.stringify({ isFullScreen: false }));
    } else {
      const prefs = JSON.parse(windowPreferences);
      if (prefs.isFullScreen === true) {
        RendererMessenger.setFullScreen(true);
        rootStore.uiStore.setFullScreen(true);
      }
    }
  } catch (e) {
    console.error('Cannot load window preferences', e);
  }

  // Debounced / reactive persistence to localStorage
  reaction(
    () => rootStore.fileStore.getPersistentPreferences(),
    (preferences) => {
      localStorage.setItem(FILE_STORAGE_KEY, JSON.stringify(preferences));
    },
    { delay: 200 },
  );

  reaction(
    () => rootStore.uiStore.getPersistentPreferences(),
    (preferences) => {
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    },
    { delay: 200 },
  );

  autorun(() => {
    document.title = rootStore.getWindowTitle();
  });

  // Render main app
  root.render(
    <StoreProvider value={rootStore}>
      <App />
      <Overlay />
    </StoreProvider>,
  );

  // -------------------------------------------
  // Messaging with the main process
  // -------------------------------------------
  RendererMessenger.onGetTags(async () => ({ tags: await backend.fetchTags() }));
  RendererMessenger.onFullScreenChanged((val) => rootStore.uiStore.setFullScreen(val));
  RendererMessenger.onClosedPreviewWindow(() => {
    rootStore.uiStore.closePreviewWindow();
  });

  // Cleanup before closing
  window.addEventListener('beforeunload', () => {
    rootStore.close();
  });
}

async function runPreviewApp(root: Root): Promise<void> {
  const ydoc = new Y.Doc();
  // Retrieve sessionId for consistency (even if backups are not really used in preview)
  const sessionId = await RendererMessenger.getSessionId();
  // We won't do real backups in preview mode. Just pass an empty or in-memory path
  const backup = await BackupScheduler.init(ydoc, '', sessionId);
  const backend = await Backend.init(ydoc, () => {});

  const rootStore = await RootStore.preview(backend, backup);
  RendererMessenger.initialized();

  await new Promise<void>((resolve) => {
    let initRender: (() => void) | undefined = resolve;
    RendererMessenger.onReceivePreviewFiles(
      async ({ ids, thumbnailDirectory, viewMethod, activeImgId }) => {
        rootStore.uiStore.setThumbnailDirectory(thumbnailDirectory);
        rootStore.uiStore.setMethod(viewMethod);
        rootStore.uiStore.enableSlideMode();

        runInAction(() => {
          rootStore.uiStore.isInspectorOpen = false;
        });

        const files = await backend.fetchFilesByID(ids);
        const hasNewLocation = runInAction(() =>
          files.some(
            (f) => !rootStore.locationStore.locationList.find((l) => l.id === f.locationId),
          ),
        );
        if (hasNewLocation) {
          await rootStore.locationStore.init();
        }

        await rootStore.fileStore.updateFromBackend(files);
        rootStore.uiStore.setFirstItem((activeImgId && ids.indexOf(activeImgId)) || 0);

        if (initRender) {
          initRender();
          initRender = undefined;
        }
      },
    );
  });

  autorun(() => {
    document.title = rootStore.getWindowTitle();
  });

  // Render preview
  root.render(
    <StoreProvider value={rootStore}>
      <PreviewApp />
      <Overlay />
    </StoreProvider>,
  );

  // Close preview with space or escape
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Escape') {
      rootStore.uiStore.clearFileSelection();
      rootStore.fileStore.clearFileList();
      rootStore.uiStore.enableSlideMode();

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      window.close();
    }
  });
}

main()
  .then(() => console.info('Successfully initialized OneFolder!'))
  .catch((err) => {
    console.error('Could not initialize OneFolder!', err);
    window.alert('An error has occurred, check the console for more details');

    if (!IS_DEV) {
      RendererMessenger.toggleDevTools();
    }
  });
    