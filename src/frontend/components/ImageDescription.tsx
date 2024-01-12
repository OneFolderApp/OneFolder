import React, { useCallback, useEffect, useState } from 'react';

import { IconSet } from 'widgets/icons';
import { Toolbar, ToolbarButton } from 'widgets/toolbar';
import { RendererMessenger } from '../../ipc/renderer';
import { useStore } from '../contexts/StoreContext';
import { ClientFile } from '../entities/File';
import { AppToaster } from './Toaster';

// type ExifField = { label: string; modifiable?: boolean; format?: (val: string) => ReactNode };

// Details: https://www.vcode.no/web/resource.nsf/ii2lnug/642.htm
// const exifFields: Record<string, ExifField> = {
//   'MWG:Description': { label: 'Description', modifiable: true },
// };

// const exifTags = Object.keys(exifFields);

const stopPropagation = (e: React.KeyboardEvent<HTMLTextAreaElement>) => e.stopPropagation();

interface ImageInfoProps {
  file: ClientFile;
}

const ImageInfo = ({ file }: ImageInfoProps) => {
  const descriptionKey = 'Description';
  const { exifTool } = useStore();

  const [descriptionValue, setDescriptionValue] = useState('');
  const [descriptionOriginalValue, setDescriptionOriginalValue] = useState('');

  useEffect(() => {
    exifTool
      .readDescription(file.absolutePath)
      .then((description) => {
        setDescriptionValue(description || '');
        setDescriptionOriginalValue(description || '');
      })
      .catch((err) => {
        AppToaster.show({
          message: 'Error reading EXIF data',
          clickAction: { label: 'View', onClick: RendererMessenger.toggleDevTools },
          timeout: 6000,
        });
        setDescriptionValue('');
        console.error(err);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.absolutePath]);

  const handleEditSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const data: Record<string, string> = {};
      data[descriptionKey] = descriptionValue;

      exifTool
        .writeData(file.absolutePath, data)
        .then(() => {
          AppToaster.show({ message: 'Image description updated', timeout: 3000 });
          setDescriptionOriginalValue(descriptionValue);
        })
        .catch((err) => {
          AppToaster.show({
            message: 'Could not updated image description',
            clickAction: { label: 'View', onClick: RendererMessenger.toggleDevTools },
            timeout: 6000,
          });
          console.error('Could not update image description', err);
        });
    },
    [descriptionValue, exifTool, file.absolutePath],
  );

  return (
    <div className="inspector-section">
      <textarea
        name={descriptionKey}
        onKeyDown={stopPropagation}
        className="description-box"
        rows={10}
        value={descriptionValue}
        onChange={(e) => setDescriptionValue(e.target.value)}
      ></textarea>
      <div
        className={`inspector-section__action-buttons ${
          descriptionOriginalValue === descriptionValue ? 'low-opacity' : ''
        }`}
      >
        <button
          onClick={() => setDescriptionValue(descriptionOriginalValue)}
          disabled={descriptionOriginalValue === descriptionValue}
        >
          cancel
        </button>
        <button
          className={`${descriptionOriginalValue !== descriptionValue ? 'highlight-save' : ''}`}
          onClick={handleEditSubmit}
          disabled={descriptionOriginalValue === descriptionValue}
        >
          save
        </button>
      </div>
      {/* <Toolbar controls="file-info" isCompact>
        <ToolbarButton
          key="cancel"
          icon={IconSet.CLOSE}
          text="Cancel"
          tooltip="Cancel changes"
          type="reset"
        />
        <ToolbarButton
          key="submit"
          icon={IconSet.SELECT_CHECKED}
          text="Save"
          tooltip="Save changes"
          type="submit"
        />
      </Toolbar> */}
    </div>
  );
};

export default React.memo(ImageInfo);
