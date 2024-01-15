import React from 'react';
import { observer } from 'mobx-react-lite';

import { useStore } from '../../contexts/StoreContext';
import FileTags from '../../components/FileTag';
import ImageDescription from '../../components/ImageDescription';
import ImageDates from '../../components/ImageDates';
import ImageMap from '../../components/ImageMap';
import ImageDuplicates from '../../components/ImageDuplicates';
import ImageTools from '../../components/ImageTools';
import ImageInfo from '../../components/ImageInfo';
import { IconSet } from 'widgets';
import { IS_PREVIEW_WINDOW } from 'common/window';

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
  return (
    <aside id="inspector">
      <br />
      <br />
      <br />

      <InspectorToggleSection
        title="Description"
        icon={IconSet.EDIT}
        isOpen={uiStore.inspectorIsDescriptionVisible}
        toggleVisibility={uiStore.toggleInspectorDescriptionVisibility}
        bodyComponent={<ImageDescription file={first} />}
      />

      {/* Modifying state in preview window is not supported (not in sync updated in main window) */}
      {!IS_PREVIEW_WINDOW && (
        <InspectorToggleSection
          title="Tags"
          icon={IconSet.TAG_GROUP}
          isOpen={uiStore.inspectorIsTagVisible}
          toggleVisibility={uiStore.toggleInspectorTagVisibility}
          bodyComponent={<FileTags file={first} />}
        />
      )}

      <InspectorToggleSection
        title="Dates"
        icon={IconSet.FILTER_DATE}
        isOpen={uiStore.inspectorIsDatesVisible}
        toggleVisibility={uiStore.toggleInspectorDatesVisibility}
        bodyComponent={<ImageDates file={first} />}
      />

      <InspectorToggleSection
        title="Map"
        icon={IconSet.WORLD}
        isOpen={uiStore.inspectorIsMapVisible}
        toggleVisibility={uiStore.toggleInspectorMapVisibility}
        bodyComponent={<ImageMap file={first} />}
      />

      <InspectorToggleSection
        title="Find Duplicates"
        icon={IconSet.DUPLICATE}
        isOpen={uiStore.inspectorIsDuplicatesVisible}
        toggleVisibility={uiStore.toggleInspectorDuplicateVisibility}
        bodyComponent={<ImageDuplicates file={first} />}
      />

      <InspectorToggleSection
        title="Tools"
        icon={IconSet.TOOLS}
        isOpen={uiStore.inspectorIsToolsVisible}
        toggleVisibility={uiStore.toggleInspectorToolsVisibility}
        bodyComponent={<ImageTools file={first} />}
      />

      <InspectorToggleSection
        title="Other"
        icon={IconSet.INFO}
        isOpen={uiStore.inspectorIsInformationVisible}
        toggleVisibility={uiStore.toggleInspectorInformationVisibility}
        bodyComponent={<ImageInfo file={first} />}
      />

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
    </aside>
  );
});

export default Inspector;

type InspectorSectionProps = {
  title: string;
  icon: JSX.Element;
  isOpen: boolean;
  toggleVisibility: () => void;
  bodyComponent: React.ReactElement;
};

const InspectorToggleSection = ({
  title,
  icon,
  isOpen,
  toggleVisibility,
  bodyComponent,
}: InspectorSectionProps) => {
  return (
    <section>
      <button
        className={`inspector-section-toggle ${isOpen ? 'inspector-section-toggle__open' : ''}`}
        onClick={toggleVisibility}
      >
        <header>
          <span>{icon}</span>

          <h2>{title}</h2>
        </header>
        <div className="chevron">{isOpen ? IconSet.ARROW_DOWN : IconSet.ARROW_UP}</div>
      </button>
      {isOpen && <div className="inspector-section-toggle__body">{bodyComponent}</div>}
    </section>
  );
};

const Placeholder = () => {
  return (
    <section>
      <header>
        <h2>No image selected</h2>
      </header>
    </section>
  );
};
