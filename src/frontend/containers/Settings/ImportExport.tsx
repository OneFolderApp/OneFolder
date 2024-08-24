import { getFilenameFriendlyFormattedDateTime } from 'common/fmt';
import { shell } from 'electron';
import { observer } from 'mobx-react-lite';
import SysPath from 'path';
import React, { useEffect, useState } from 'react';
import { AppToaster } from 'src/frontend/components/Toaster';
import { RendererMessenger } from 'src/ipc/renderer';
import { Button, ButtonGroup, IconSet } from 'widgets';
import { Callout } from 'widgets/notifications';
import { Alert, DialogButton } from 'widgets/popovers';
import { useStore } from '../../contexts/StoreContext';
import ExternalLink from 'src/frontend/components/ExternalLink';
import FileInput from 'src/frontend/components/FileInput';

export const ImportExport = observer(() => {
  const rootStore = useStore();
  const { fileStore, tagStore, exifTool } = rootStore;
  const [isConfirmingMetadataExport, setConfirmingMetadataExport] = useState(false);
  const [isConfirmingFileImport, setConfirmingFileImport] = useState<{
    path: string;
    info: string;
  }>();
  const [backupDir, setBackupDir] = useState('');
  useEffect(() => {
    RendererMessenger.getDefaultBackupDirectory().then(setBackupDir);
  }, []);

  const handleChooseImportDir = async ([path]: [string, ...string[]]) => {
    try {
      const [numTags, numFiles] = await rootStore.peekDatabaseFile(path);
      setConfirmingFileImport({
        path,
        info: `Backup contains ${numTags} tags (currently ${tagStore.count}) and ${numFiles} images (currently ${fileStore.numTotalFiles}).`,
      });
    } catch (e) {
      console.log(e);
      AppToaster.show({ message: 'Backup file is invalid', timeout: 5000 });
    }
  };

  const handleCreateExport = async () => {
    const formattedDateTime = getFilenameFriendlyFormattedDateTime(new Date());
    const filename = `backup_${formattedDateTime}.json`.replaceAll(':', '-');
    const filepath = SysPath.join(backupDir, filename);
    try {
      await rootStore.backupDatabaseToFile(filepath);
      AppToaster.show({
        message: 'Backup created successfully!',
        clickAction: { label: 'View', onClick: () => shell.showItemInFolder(filepath) },
        timeout: 5000,
      });
    } catch (e) {
      console.error(e);
      AppToaster.show({
        message: 'Could not create backup, open DevTools for more details',
        clickAction: { label: 'View', onClick: RendererMessenger.toggleDevTools },
        timeout: 5000,
      });
    }
  };

  return (
    <>
      <h3>File Metadata</h3>

      <p>
        This option is useful for importing/exporting tags from/to other software. If you use a
        service like Dropbox or Google, you can write your tags to your files on one device and read
        them on other devices.
      </p>
      <Callout icon={IconSet.INFO}>
        The separator is used to format the tags metadata. For example a file with the assigned tags
        Food, Fruit and Apple will be formatted with the currently selected separator as{' '}
        <pre style={{ display: 'inline' }}>
          {['Food', 'Fruit', 'Apple'].join(exifTool.hierarchicalSeparator)}
        </pre>
        .
      </Callout>
      <div className="vstack">
        <label>
          Hierarchical separator
          <select
            value={exifTool.hierarchicalSeparator}
            onChange={(e) => exifTool.setHierarchicalSeparator(e.target.value)}
          >
            <option value="|">|</option>
            <option value="/">/</option>
            <option value="\">\</option>
            <option value=":">:</option>
          </select>
        </label>
        {/* TODO: adobe bridge has option to read with multiple separators */}

        <ButtonGroup>
          <Button
            text="Import tags from file metadata"
            onClick={() => {
              fileStore.readTagsFromFiles();
              // fileStore.readFacesAnnotationsFromFiles();
            }}
            styling="outlined"
          />
          <Button
            text="Export tags to file metadata"
            onClick={() => setConfirmingMetadataExport(true)}
            styling="outlined"
          />
          <Alert
            open={isConfirmingMetadataExport}
            title="Are you sure you want to overwrite your files' tags?"
            primaryButtonText="Export"
            onClick={(button) => {
              if (button === DialogButton.PrimaryButton) {
                fileStore.writeTagsToFiles();
              }
              setConfirmingMetadataExport(false);
            }}
          >
            <p>
              This will overwrite any existing tags (a.k.a. keywords) in those files with
              OneFolder&#39;s tags. It is recommended to import all tags before writing new tags.
            </p>
          </Alert>
        </ButtonGroup>
      </div>

      <div className="vstack">
        <p>
          Import tags from extended file attributes (KDE Dolphin tags).
        </p>

        <ButtonGroup>
          <Button
            text="Import tags from xattr"
            onClick={() => {
              fileStore.readExtendedAttributeTagsFromFiles();
            }}
            styling="outlined"
          />
          <Button
            text="Export tags to xattr"
            onClick={() => setConfirmingMetadataExport(true)}
            styling="outlined"
          />
          <Alert
            open={isConfirmingMetadataExport}
            title="Are you sure you want to overwrite your files' tags?"
            primaryButtonText="Export"
            onClick={(button) => {
              if (button === DialogButton.PrimaryButton) {
                fileStore.writeExtendedAttributeTagsToFiles();
              }
              setConfirmingMetadataExport(false);
            }}
          >
            <p>
              This will overwrite any existing user.xdg.tags in those files with
              OneFolder&#39;s tags. It is recommended to import all tags before writing new tags.
            </p>
          </Alert>
        </ButtonGroup>
      </div>

      <h3>Backup Database as File</h3>

      <Callout icon={IconSet.INFO}>
        Automatic back-ups are created every 10 minutes in the{' '}
        <ExternalLink url={backupDir}>backup directory</ExternalLink>.
      </Callout>
      <ButtonGroup>
        <FileInput
          className="btn-outlined"
          options={{
            properties: ['openFile'],
            filters: [{ extensions: ['json'], name: 'JSON' }],
            defaultPath: backupDir,
          }}
          onChange={handleChooseImportDir}
        >
          {IconSet.IMPORT} Restore database from file
        </FileInput>
        <Button
          text="Backup database to file"
          onClick={handleCreateExport}
          icon={IconSet.OPEN_EXTERNAL}
          styling="outlined"
        />

        <Alert
          open={Boolean(isConfirmingFileImport)}
          title="Are you sure you want to restore the database from a backup?"
          primaryButtonText="Import"
          onClick={async (button) => {
            if (isConfirmingFileImport && button === DialogButton.PrimaryButton) {
              AppToaster.show({
                message: 'Restoring database... OneFolder will restart',
                timeout: 5000,
              });
              try {
                await rootStore.restoreDatabaseFromFile(isConfirmingFileImport.path);
                RendererMessenger.reload();
              } catch (e) {
                console.error('Could not restore backup', e);
                AppToaster.show({
                  message: 'Restoring database failed!',
                  timeout: 5000,
                });
              }
            }
            setConfirmingFileImport(undefined);
          }}
        >
          <p>
            This will replace your current tag hierarchy and any tags assigned to images, so it is
            recommended you create a backup first.
          </p>
          <p>{isConfirmingFileImport?.info}</p>
        </Alert>
      </ButtonGroup>
    </>
  );
});
