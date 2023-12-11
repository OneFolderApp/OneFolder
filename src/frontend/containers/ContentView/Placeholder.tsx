import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import LOGO_FC from 'resources/logo/svg/full-color/onefolder-logomark-fc.svg';
import { IS_PREVIEW_WINDOW } from 'common/window';

import { useStore } from '../../contexts/StoreContext';

const Placeholder = observer(() => {
  const { fileStore, tagStore } = useStore();

  if (IS_PREVIEW_WINDOW) {
    return <PreviewWindowPlaceholder />;
  }
  if (fileStore.showsAllContent && tagStore.isEmpty) {
    // No tags exist, and no images added: Assuming it's a new user -> Show a welcome screen
    return <Welcome />;
  } else if (fileStore.showsAllContent) {
    return <NoContentFound />;
  } else if (fileStore.showsQueryContent) {
    return <NoQueryContent />;
  } else if (fileStore.showsUntaggedContent) {
    return <NoUntaggedContent />;
  } else if (fileStore.showsMissingContent) {
    return <NoMissingContent />;
  } else {
    return <BugReport />;
  }
});

export default Placeholder;

import { IconSet, Button, ButtonGroup, SVG } from 'widgets';
import { RendererMessenger } from 'src/ipc/renderer';
import useMountState from 'src/frontend/hooks/useMountState';

const PreviewWindowPlaceholder = observer(() => {
  const { fileStore } = useStore();
  const [isLoading, setIsLoading] = useState(true);
  const [, isMounted] = useMountState();
  useEffect(() => {
    setIsLoading(true);
    setTimeout(() => {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileStore.fileListLastModified]);

  if (true) {
    return (
      <ContentPlaceholder title="Loading..." icon={<SVG src={LOGO_FC} />}>
        {IconSet.LOADING}
      </ContentPlaceholder>
    );
  }
});

const Welcome = () => {
  const { uiStore } = useStore();
  return (
    <ContentPlaceholder title="" icon={<SVG src={LOGO_FC} />}>
      <br />
      <br />
      <p>note: this app is read only by default, but we recomend having a backup anyways.</p>
      <br />
      <p>note2: Tags can be in a hierarchy (like folders)</p>
      <br />
      <p>note3: to quickly add tags to an image press the `t` key on your keyboard</p>
      <br />
      <p>↖️ Add a Location in the top left cornet to get started</p>

      {/* <Button styling="filled" text="Select a Location" onClick={uiStore.toggleHelpCenter} /> */}
      <br />
      <br />
    </ContentPlaceholder>
  );
};

const NoContentFound = () => {
  const { uiStore } = useStore();
  return (
    <ContentPlaceholder title="No images" icon={IconSet.MEDIA}>
      <p>Images can be added from the outliner</p>
      <Button onClick={uiStore.toggleOutliner} text="Toggle outliner" styling="outlined" />
    </ContentPlaceholder>
  );
};

const NoQueryContent = () => {
  const { fileStore } = useStore();
  return (
    <ContentPlaceholder title="No images found" icon={IconSet.SEARCH}>
      <p>Try searching for something else.</p>
      {/* TODO: when search includes a Hidden tag, remind the user that's what might be causing them to see no results */}
      <ButtonGroup align="center">
        <Button
          text="All images"
          icon={IconSet.MEDIA}
          onClick={fileStore.fetchAllFiles}
          styling="outlined"
        />
        <Button
          text="Untagged"
          icon={IconSet.TAG_BLANCO}
          onClick={fileStore.fetchUntaggedFiles}
          styling="outlined"
        />
      </ButtonGroup>
    </ContentPlaceholder>
  );
};

const NoUntaggedContent = () => {
  const { fileStore } = useStore();
  return (
    <ContentPlaceholder title="No untagged images" icon={IconSet.TAG}>
      <p>All images have been tagged. Nice work!</p>
      <Button
        text="All Images"
        icon={IconSet.MEDIA}
        onClick={fileStore.fetchAllFiles}
        styling="outlined"
      />
    </ContentPlaceholder>
  );
};

const NoMissingContent = () => {
  const { fileStore } = useStore();
  return (
    <ContentPlaceholder title="No missing images" icon={IconSet.WARNING_BROKEN_LINK}>
      <p>Try searching for something else.</p>
      <ButtonGroup align="center">
        <Button
          text="All images"
          icon={IconSet.MEDIA}
          onClick={fileStore.fetchAllFiles}
          styling="outlined"
        />
        <Button
          text="Untagged"
          icon={IconSet.TAG_BLANCO}
          onClick={fileStore.fetchUntaggedFiles}
          styling="outlined"
        />
      </ButtonGroup>
    </ContentPlaceholder>
  );
};

const BugReport = () => {
  return (
    <ContentPlaceholder title="You encountered a bug!" icon={IconSet.WARNING_FILL}>
      <p>Please report this bug to the maintainers!</p>
    </ContentPlaceholder>
  );
};

interface IContentPlaceholder {
  icon: JSX.Element;
  title: string;
  children: React.ReactNode | React.ReactNodeArray;
}

const ContentPlaceholder = (props: IContentPlaceholder) => {
  return (
    <div id="content-placeholder">
      <span className="custom-icon-128">{props.icon}</span>
      <h2 className="dialog-title">{props.title}</h2>
      {props.children}
    </div>
  );
};
