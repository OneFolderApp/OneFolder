import { Remote, wrap } from 'comlink';
import { HeicReaderWorker } from '../workers/heicReader.worker';
import { Loader } from './util';

/**
 * Uses the ag-psd dependency to create bitmap images of PSD files.
 * Uses a worker to offload process intensive work off the main thread
 * Based on https://github.com/Agamnentzar/ag-psd#reading-2
 */
class HeicLoader implements Loader {
  worker?: Remote<HeicReaderWorker>;

  async init(): Promise<void> {
    const worker = new Worker(new URL('src/frontend/workers/heicReader.worker', import.meta.url));

    const WorkerFactory = wrap<typeof HeicReaderWorker>(worker);
    this.worker = await new WorkerFactory();
  }

  async decode(buffer: Buffer): Promise<ImageData> {
    const { image } = await this.worker!.readImage(buffer);
    return image;
  }
}

export default HeicLoader;
