import React from 'react';

import { ClientFile } from '../entities/File';
import { shell } from 'electron';

interface ImageDuplicatesProps {
  file: ClientFile;
}

const ImageDuplicates = ({ file }: ImageDuplicatesProps) => {
  return (
    <div className="inspector-section">
      <div className="duplicates">
        <img src={file.absolutePath} alt="img" className="thumbnail thumbnail-1" />
        <img src={file.absolutePath} alt="img" className="thumbnail thumbnail-2" />
        <img src={file.absolutePath} alt="img" className="thumbnail thumbnail-3" />
      </div>
      <p className="text-center">
        This feature is not ready yet <br /> Learn more
        <button
          style={{ textDecoration: 'underline', padding: '0.3rem' }}
          onClick={() => {
            shell.openExternal('https://onefolder.canny.io/feedback/p/find-duplicates');
          }}
        >
          here
        </button>
      </p>
      <p className="text-center"></p>
    </div>
  );
};

export default React.memo(ImageDuplicates);
