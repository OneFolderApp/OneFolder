import libheif from 'libheif-js';
import { PNG } from 'pngjs/browser';
import { expose } from 'comlink';

const decoder = new libheif.HeifDecoder();

export class HeicReaderWorker {
  constructor() {
    // initializeCanvas(this.createCanvas, this.createCanvasFromData);
  }

  async readImage(data) {
    const decoded = decoder.decode(data);
    const image = decoded[0];
    const width = image.get_width();
    const height = image.get_height();

    const imageData = await new Promise((resolve, reject) => {
      image.display(
        { data: new Uint8ClampedArray(width * height * 4), width, height },
        (displayData) => {
          if (!displayData) {
            return reject(new Error('HEIF processing error'));
          }

          resolve(displayData);
        },
      );
    });

    const png = new PNG({ width: imageData.width, height: imageData.height });
    png.data = imageData.data;
    const pngBuffer = PNG.sync.write(png);

    // Read the PNG buffer to extract width, height, and data
    const pngImage = PNG.sync.read(pngBuffer);

    // Create a Uint8ClampedArray from the PNG data
    const clampedArray = new Uint8ClampedArray(pngImage.data);

    // Create the ImageData object
    const newImageData = new ImageData(clampedArray, pngImage.width, pngImage.height);

    console.log('newImageData HEIC', newImageData);

    return { image: newImageData };
  }
}

// https://lorefnon.tech/2019/03/24/using-comlink-with-typescript-and-worker-loader/
expose(HeicReaderWorker, self);
