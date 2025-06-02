import React from 'react';
import { observer } from 'mobx-react-lite';

import { useStore } from '../../contexts/StoreContext';
import FileTags from '../../components/FileTag';
import ImageInfo from '../../components/ImageInfo';
import { IconButton, IconSet } from 'widgets';
import { shell } from 'electron';
import { IS_PREVIEW_WINDOW } from 'common/window';
import FileExtraPropertiesEditor from '../../components/FileExtraPropertiesEditor';

const Inspector = observer(() => {
  const { uiStore, fileStore } = useStore();

  if (uiStore.firstItem >= fileStore.fileList.length || !uiStore.isInspectorOpen) {
    return (
      <aside id="inspector">
        <Placeholder />
      </aside>
    );
  }

  const first = fileStore.fileList[uiStore.firstItem];
  const path = first ? first.absolutePath : '...';

  return (
    <aside id="inspector">
      <section>{first && <ImageInfo file={first} />}</section>
      <section>
        <header>
          <h2>Path to file</h2>
        </header>
        <div className="input-file">
          <input readOnly className="input input-file-value" value={path} />
          <IconButton
            icon={IconSet.FOLDER_CLOSE}
            onClick={() => shell.showItemInFolder(path)}
            text="Open in file explorer"
          />
        </div>
      </section>
      {/* Modifying state in preview window is not supported (not in sync updated in main window) */}
      {!IS_PREVIEW_WINDOW && (
        <>
          <section>
            <header id="inspector-extra-porperties-header">
              <h2>Extra properties</h2>
            </header>
            <FileExtraPropertiesEditor
              file={first}
              addButtonContainerID="inspector-extra-porperties-header"
            />
          </section>
          <section>
            <header>
              <h2>Tags</h2>
            </header>
            <FileTags file={first} />
          </section>
        </>
      )}
    </aside>
  );
});

export default Inspector;

const Placeholder = () => {
  return (
    <section>
      <header>
        <h2>No image selected</h2>
      </header>
    </section>
  );
};
