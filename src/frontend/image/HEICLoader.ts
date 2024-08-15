import { Remote, wrap } from 'comlink';
import { HeicReaderWorker } from '../workers/heicReader.worker';
import { Loader } from './util';

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
