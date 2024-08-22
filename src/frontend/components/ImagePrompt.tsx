import React, { useCallback, useEffect, useState } from 'react';

import { RendererMessenger } from '../../ipc/renderer';
import { useStore } from '../contexts/StoreContext';
import { ClientFile } from '../entities/File';
import { AppToaster } from './Toaster';
import ReactJson from 'react-json-view';

// type ExifField = { label: string; modifiable?: boolean; format?: (val: string) => ReactNode };

// Details: https://www.vcode.no/web/resource.nsf/ii2lnug/642.htm
// const exifFields: Record<string, ExifField> = {
//   'MWG:Description': { label: 'Description', modifiable: true },
// };

// const exifTags = Object.keys(exifFields);

interface ImageInfoProps {
  file: ClientFile;
}

const ImageInfo = ({ file }: ImageInfoProps) => {
  const { exifTool } = useStore();

  const [descriptionValue, setDescriptionValue] = useState('');

  useEffect(() => {
    exifTool
      .readPrompt(file.absolutePath)
      .then((description) => {
        setDescriptionValue(description || '');
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

  let descriptionObj;
  try {
    descriptionObj = JSON.parse(descriptionValue);
  } catch (error) {
    descriptionObj = {};
  }

  return (
    <div className="inspector-section">
      <div className="prompt-box">
        <ReactJson
          src={descriptionObj}
          enableClipboard={false}
          displayDataTypes={false}
          displayObjectSize={false}
          indentWidth={2}
          theme="twilight"
          name={false}
        />
      </div>
    </div>
  );
};

export default React.memo(ImageInfo);
