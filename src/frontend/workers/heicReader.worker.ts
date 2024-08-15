import libheif from 'libheif-js';
import { expose } from 'comlink';

const decoder = new libheif.HeifDecoder();

export class HeicReaderWorker {
  constructor() {
    // No initialization needed for now
  }

  async readImage(data: ArrayBuffer | Uint8Array): Promise<{ image: ImageData }> {
    const decoded = decoder.decode(data);
    const image = decoded[0];
    const width = image.get_width();
    const height = image.get_height();

    // Create a Uint8ClampedArray to hold the pixel data
    const pixelData = new Uint8ClampedArray(width * height * 4);

    // Display the image data into the pixelData array
    await new Promise((resolve, reject) => {
      image.display({ data: pixelData, width, height }, (displayData) => {
        if (!displayData) {
          return reject(new Error('HEIF processing error'));
        }
        resolve(displayData);
      });
    });

    // Create the ImageData object directly from the pixel data
    const newImageData = new ImageData(pixelData, width, height);

    return { image: newImageData };
  }
}

// Expose the worker using comlink
expose(HeicReaderWorker, self);
