import React from 'react';

import { ClientFile } from '../entities/File';
import { shell } from 'electron';

interface ImageDuplicatesProps {
  file: ClientFile;
}

const ImageDuplicates = ({ file }: ImageDuplicatesProps) => {
  return (
    <div className="inspector-section">
      {/* <p className="text-center">
        This feature is not ready yet <br /> Learn more
        <button
          style={{ textDecoration: 'underline', padding: '0.3rem' }}
          onClick={() => {
            shell.openExternal('https://onefolder.canny.io/feedback/p/find-duplicates');
          }}
        >
          here
        </button>
      </p> */}
      <div className="tools">
        <button>HEIC to JPEG</button>
        <button>Optimize JPEG</button>
        <button>Fix red eyes</button>
        <button>Colorize black and white image</button>
      </div>
      <p className="text-center">
        Ideas on what we should add? <br />
        <button
          style={{ textDecoration: 'underline', padding: '0.3rem' }}
          onClick={() => {
            shell.openExternal('https://onefolder.canny.io/feedback/');
          }}
        >
          Let us know!
        </button>
      </p>
      <p className="text-center"></p>
    </div>
  );
};

export default React.memo(ImageDuplicates);
