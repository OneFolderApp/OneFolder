import { action } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { useEffect } from 'react';

import { IconSet, Tag } from 'widgets';
import { Alert, DialogButton } from 'widgets/popovers';
import { RendererMessenger } from '../../ipc/renderer';
import { useStore } from '../contexts/StoreContext';
import { ClientLocation, ClientSubLocation } from '../entities/Location';
import { ClientFileSearchItem } from '../entities/SearchItem';
import { ClientTag } from '../entities/Tag';
import { AppToaster } from './Toaster';
import { ClientExtraProperty } from '../entities/ExtraProperty';
import { ClientFile } from '../entities/File';
import { ExtraPropertyValue } from 'src/api/extraProperty';
import { VirtualizedGrid, VirtualizedGridRowProps } from 'widgets/combobox/Grid';

interface IRemovalProps<T> {
  object: T;
  onClose: () => void;
}

export const LocationRemoval = (props: IRemovalProps<ClientLocation>) => (
  <RemovalAlert
    open
    title={`Are you sure you want to delete the location "${props.object.name}"?`}
    information="This will permanently remove the location and all data linked to its images in Allusion."
    onCancel={props.onClose}
    onConfirm={() => {
      props.onClose();
      props.object.delete();
    }}
  />
);

export const SubLocationExclusion = (props: IRemovalProps<ClientSubLocation>) => {
  return (
    <Alert
      open
      title={`Are you sure you want to exclude the directory "${props.object.name}"?`}
      icon={IconSet.WARNING}
      type="warning"
      primaryButtonText="Exclude"
      defaultButton={DialogButton.PrimaryButton}
      onClick={(button) => {
        if (button !== DialogButton.CloseButton) {
          props.object.toggleExcluded();
        }
        props.onClose();
      }}
    >
      <p>Any tags saved on images in that directory will be lost.</p>
    </Alert>
  );
};

export const TagRemoval = observer((props: IRemovalProps<ClientTag>) => {
  const { uiStore } = useStore();
  const { object } = props;
  const tagsToRemove = Array.from(
    new Map(
      (object.isSelected
        ? [...uiStore.tagSelection].flatMap((obj) => [...obj.getSubTree()])
        : [...object.getSubTree()]
      ).map((t) => [t.id, t]),
    ).values(),
  ).map((t) => <Tag key={t.id} text={t.name} color={t.viewColor} />);

  const text = 'Are you sure you want to delete this tag(s)?';

  return (
    <RemovalAlert
      open
      title={text}
      information="Deleting tags or collections will permanently remove them from Allusion."
      body={
        tagsToRemove.length > 0 && (
          <div id="tag-remove-overview">
            <p>Selected Tags</p>
            {tagsToRemove}
          </div>
        )
      }
      onCancel={props.onClose}
      onConfirm={() => {
        props.onClose();
        object.isSelected ? uiStore.removeSelectedTags() : props.object.delete();
      }}
    />
  );
});

export const ExtraPropertyRemoval = observer((props: IRemovalProps<ClientExtraProperty>) => (
  <RemovalAlert
    open
    title={`Are you sure you want to delete the "${props.object.name}" extra property?`}
    information="This will permanently remove the extra property and all of its values from all files in Allusion."
    onCancel={props.onClose}
    onConfirm={() => {
      props.onClose();
      props.object.delete();
    }}
  />
));

export const ExtraPropertyUnAssign = observer(
  (
    props: IRemovalProps<{
      files: ClientFile[];
      extraProperty: ClientExtraProperty;
    }>,
  ) => {
    const { extraPropertyStore } = useStore();
    const fileCount = props.object.files.length;
    //If the file selection has less than 2 files auto confirm
    useEffect(() => {
      if (fileCount < 2) {
        props.onClose();
        extraPropertyStore.removeFromFiles(props.object.files, props.object.extraProperty);
      }
    }, [props, extraPropertyStore, fileCount]);

    const extraPropertyName = props.object.extraProperty.name;
    if (fileCount < 2) {
      return <></>;
    }
    return (
      <RemovalAlert
        open
        title={`Are you sure you want to remove the "${extraPropertyName}" extra property from ${fileCount} files?`}
        information="This will permanently remove all of its values from those files in Allusion."
        primaryButtonText="Remove"
        onCancel={props.onClose}
        onConfirm={() => {
          props.onClose();
          extraPropertyStore.removeFromFiles(props.object.files, props.object.extraProperty);
        }}
      />
    );
  },
);

export const ExtraPropertyOverwrite = observer(
  (
    props: IRemovalProps<{
      files: ClientFile[];
      extraProperty: ClientExtraProperty;
      value: ExtraPropertyValue;
    }>,
  ) => {
    const { extraPropertyStore } = useStore();
    const fileCount = props.object.files.length;
    //If the file selection has less than 2 files auto confirm
    useEffect(() => {
      if (fileCount < 2) {
        props.onClose();
        extraPropertyStore.setOnFiles(
          props.object.files,
          props.object.extraProperty,
          props.object.value,
        );
      }
    }, [props, extraPropertyStore, fileCount]);

    const extraPropertyName = props.object.extraProperty.name;
    if (fileCount < 2) {
      return <></>;
    }
    return (
      <RemovalAlert
        open
        title={`Are you sure you want to overwrite the "${extraPropertyName}" extra property from ${fileCount} files?`}
        information="This will permanently overwrite all of its values from those files in Allusion."
        primaryButtonText="Confirm"
        onCancel={props.onClose}
        onConfirm={() => {
          props.onClose();
          extraPropertyStore.setOnFiles(
            props.object.files,
            props.object.extraProperty,
            props.object.value,
          );
        }}
      />
    );
  },
);

export const FileRow = ({ index, style, data }: VirtualizedGridRowProps<ClientFile>) => {
  const item = data[index];
  return (
    <div key={item.id} style={style}>
      {item.absolutePath}
    </div>
  );
};

export const FileRemoval = observer(() => {
  const { fileStore, uiStore } = useStore();
  const selection = uiStore.fileSelection;

  const handleConfirm = action(() => {
    uiStore.closeToolbarFileRemover();
    const files = [];
    for (const file of selection) {
      if (file.isBroken === true) {
        files.push(file);
      }
    }
    fileStore.deleteFiles(files);
  });

  return (
    <RemovalAlert
      open={uiStore.isToolbarFileRemoverOpen}
      title={`Are you sure you want to delete ${selection.size} missing file${
        selection.size > 1 ? 's' : ''
      }?`}
      information="Deleting files will permanently remove them from Allusion, so any tags saved on them will be lost. If you move files back into their location, they will be automatically detected by Allusion."
      body={
        uiStore.isToolbarFileRemoverOpen ? (
          <div className="deletion-confirmation-list">
            <VirtualizedGrid itemData={Array.from(selection)} itemsInView={10} children={FileRow} />
          </div>
        ) : (
          <></>
        )
      }
      onCancel={uiStore.closeToolbarFileRemover}
      onConfirm={handleConfirm}
    />
  );
});

export const MoveFilesToTrashBin = observer(() => {
  const { fileStore, uiStore } = useStore();
  const selection = uiStore.fileSelection;

  const handleConfirm = action(async () => {
    uiStore.closeMoveFilesToTrash();
    const files = [];
    for (const file of selection) {
      // File deletion used to be possible in renderer process, not in new electron version
      // await shell.trashItem(file.absolutePath);
      // https://github.com/electron/electron/issues/29598
      const error = await RendererMessenger.trashFile(file.absolutePath);
      if (!error) {
        files.push(file);
      } else {
        console.warn('Could not move file to trash', file.absolutePath, error);
      }
    }
    fileStore.deleteFiles(files);
    if (files.length !== selection.size) {
      AppToaster.show({
        message: 'Some files could not be deleted.',
        clickAction: {
          onClick: () => RendererMessenger.toggleDevTools(),
          label: 'More info',
        },
        timeout: 8000,
      });
    }
  });

  const isMulti = selection.size > 1;

  return (
    <RemovalAlert
      open={uiStore.isMoveFilesToTrashOpen}
      title={`Are you sure you want to delete ${selection.size} file${isMulti ? 's' : ''}?`}
      information={`You will be able to recover ${
        isMulti ? 'them' : 'it'
      } from your system's trash bin, but all assigned tags to ${
        isMulti ? 'them' : 'it'
      } in Allusion will be lost.`}
      body={
        uiStore.isMoveFilesToTrashOpen ? (
          <div className="deletion-confirmation-list">
            <VirtualizedGrid itemData={Array.from(selection)} itemsInView={10} children={FileRow} />
          </div>
        ) : (
          <></>
        )
      }
      onCancel={uiStore.closeMoveFilesToTrash}
      onConfirm={handleConfirm}
    />
  );
});

export const SavedSearchRemoval = observer((props: IRemovalProps<ClientFileSearchItem>) => {
  const { searchStore } = useStore();
  return (
    <RemovalAlert
      open
      title="Search item removal"
      information={`Are you sure you want to delete the search item "${props.object.name}"?`}
      onCancel={props.onClose}
      onConfirm={() => {
        props.onClose();
        searchStore.remove(props.object);
      }}
    />
  );
});

interface IRemovalAlertProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  information: string;
  primaryButtonText?: string;
  body?: React.ReactNode;
}

const RemovalAlert = (props: IRemovalAlertProps) => (
  <Alert
    open={props.open}
    title={props.title}
    icon={IconSet.WARNING}
    type="danger"
    primaryButtonText={props.primaryButtonText ? props.primaryButtonText : 'Delete'}
    defaultButton={DialogButton.PrimaryButton}
    onClick={(button) =>
      button === DialogButton.CloseButton ? props.onCancel() : props.onConfirm()
    }
  >
    <p>{props.information}</p>
    {props.body}
  </Alert>
);
