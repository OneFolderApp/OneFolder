import React, { useRef } from 'react';
import { observer } from 'mobx-react-lite';

import { useStore } from '../../contexts/StoreContext';
import FileTags from '../../components/FileTag';
import ImageInfo from '../../components/ImageInfo';
import ImageDescription from '../../components/ImageDescription';
import { IconButton, IconSet, Toggle } from 'widgets';
import { shell } from 'electron';
import { IS_PREVIEW_WINDOW } from 'common/window';

const Inspector = observer(() => {
  const { uiStore, fileStore } = useStore();
  const imageThumbnail = useRef(null);

  if (uiStore.firstItem >= fileStore.fileList.length || !uiStore.isInspectorOpen) {
    return (
      <aside id="inspector">
        <Placeholder />
      </aside>
    );
  }

  const first = fileStore.fileList[uiStore.firstItem];
  const path = first.absolutePath;

  return (
    <aside id="inspector">
      <section>
        <ImageInfo file={first} />
      </section>
      <section>
        <ImageDescription file={first} />
      </section>
      {/* <section>
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
      </section> */}

      {/* <section>
        <header>
          <h2>Faces</h2>
        </header>
        <Toggle checked={uiStore.isFaceModuleEnabled} onChange={uiStore.toggleFaceModule}>
          Show faces
        </Toggle>
        <div className="faces_settings_container">
          <button
            onClick={() => {
              console.log('imageThumbnail', imageThumbnail.current);

              if (imageThumbnail.current) {
                console.log('imageThumbnail', imageThumbnail.current);
                first.detectFaces(imageThumbnail.current);
              } else {
                console.error('imageThumbnail is null');
              }
            }}
          >
            <img
              ref={imageThumbnail}
              src={first.absolutePath}
              alt="img"
              className="small-thumbnail"
            />
            Detect Faces
          </button>
        </div>
      </section> */}

      {/* Modifying state in preview window is not supported (not in sync updated in main window) */}
      {!IS_PREVIEW_WINDOW && (
        <section>
          <header>
            <h2>Tags</h2>
          </header>
          <FileTags file={first} />
        </section>
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
