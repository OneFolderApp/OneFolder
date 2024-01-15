import React from 'react';
import { IconSet } from 'widgets';

import { ClientFile } from '../entities/File';
import { shell } from 'electron';

interface ImageDuplicatesProps {
  file: ClientFile;
}

const ImageDuplicates = ({ file }: ImageDuplicatesProps) => {
  return (
    <div className="inspector-section">
      <div className="tools">
        <button disabled={true}>{IconSet.CART_FLATBED}HEIC to JPEG</button>
        <button disabled={true}>{IconSet.CARROT}Optimize JPEG</button>
        <button disabled={true}>{IconSet.EYE_LOW_VISION}Fix red eyes</button>
        <button disabled={true}>{IconSet.PALETTE}Colorize black and white image</button>
      </div>
      <p className="text-center">
        Ideas on what we should add? <br /> Which one should we do first? <br />
        <button
          style={{ textDecoration: 'underline', padding: '0.3rem' }}
          onClick={() => {
            shell.openExternal('https://onefolder.canny.io/feedback/');
          }}
        >
          Let us know
        </button>
      </p>
      <p className="text-center"></p>
    </div>
  );
};

export default React.memo(ImageDuplicates);
