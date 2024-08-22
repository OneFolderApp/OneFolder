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
  const descriptionKey = 'Parameters';
  const { exifTool } = useStore();

  const [descriptionValue, setDescriptionValue] = useState('no parameters');
  const [descriptionOriginalValue, setDescriptionOriginalValue] = useState('');

  useEffect(() => {
    exifTool
      .readParameters(file.absolutePath)
      .then((description) => {
        setDescriptionValue(description || 'no parameters');
        setDescriptionOriginalValue(description || 'no parameters');
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

  return (
    <div className="inspector-section">
      <p className="parameters-box">{descriptionValue}</p>
    </div>
  );
};

export default React.memo(ImageInfo);
