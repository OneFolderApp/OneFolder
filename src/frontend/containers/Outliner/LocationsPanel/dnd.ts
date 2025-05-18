import fse from 'fs-extra';
import { action } from 'mobx';
import path from 'path';

import { retainArray } from 'common/core';
import { timeoutPromise } from 'common/timeout';
import { IMG_EXTENSIONS } from '../../../../api/file';
import { StoreFileMessage } from '../../../../ipc/messages';
import { RendererMessenger } from '../../../../ipc/renderer';
import { ALLOWED_DROP_TYPES } from '../../../contexts/DropContext';
import { DnDAttribute } from '../../../contexts/TagDnDContext';
import { ClientFile } from '../../../entities/File';
import FileStore from '../../../stores/FileStore';

const ALLOWED_FILE_DROP_TYPES = IMG_EXTENSIONS.map((ext) => `image/${ext}`);

export const isAcceptableType = (e: React.DragEvent) =>
  e.dataTransfer.types.some((type) => ALLOWED_DROP_TYPES.includes(type));

/** Returns the IDs of the files that match those in Allusion given dropData. Returns false if one or files has no matches */
export const findDroppedFileMatches = action(
  (dropData: (File | string)[], fs: FileStore): ClientFile[] | false => {
    const matches = dropData.map(
      (file) =>
        typeof file !== 'string' &&
        file.path &&
        fs.fileList.find((f) => f && f.absolutePath === file.path),
    );
    return matches.every((m): m is ClientFile => m instanceof ClientFile) ? matches : false;
  },
);

/**
 * Executed callback function while dragging over a target.
 *
 * Do not pass an expansive function into the sideEffect parameter. The dragOver
 * event is fired constantly unlike dragEnter which is only fired once.
 */
export function onDragOver(event: React.DragEvent<HTMLDivElement>): boolean {
  const dropTarget = event.currentTarget;

  const isFile = isAcceptableType(event);
  if (isFile) {
    event.dataTransfer.dropEffect = 'copy';
    event.preventDefault();
    event.stopPropagation();
    dropTarget.dataset[DnDAttribute.Target] = 'true';
    return true;
  }
  return false;
}

export function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
  const isFile = isAcceptableType(event);
  if (isFile) {
    event.dataTransfer.dropEffect = 'none';
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.dataset[DnDAttribute.Target] = 'false';
  }
}

export async function storeDroppedImage(dropData: (string | File)[], directory: string) {
  for (const dataItem of dropData) {
    let fileData: StoreFileMessage | undefined;

    // Store file -> detected by watching the directory -> automatically imported
    if (dataItem instanceof File) {
      const buffer = dataItem.path ? await fse.readFile(dataItem.path) : dataItem;
      fileData = {
        directory,
        filenameWithExt: path.basename(dataItem.path),
        imgBase64: buffer.toString('base64'),
      };
    } else if (typeof dataItem === 'string') {
      // It's probably a URL, so we can download it to get the image data
      const { imgBase64, blob } = await imageAsBase64(dataItem);
      const extension = blob.type.split('/')[1];
      const filename = getFilenameFromUrl(dataItem, 'image');
      const filenameWithExt = IMG_EXTENSIONS.some((ext) => filename.endsWith(ext))
        ? filename
        : `${filename}.${extension}`;
      fileData = { directory, imgBase64, filenameWithExt };
    }
    if (fileData) {
      const { imgBase64, filenameWithExt } = fileData;

      // Send base64 file to main process, get back filename where it is stored
      // So it can be tagged immediately
      // Filename will be incremented if file already exists, e.g. `image.jpg -> image 1.jpg`
      try {
        const reply = await RendererMessenger.storeFile({ directory, filenameWithExt, imgBase64 });
        console.log('Imported dropped file', reply.downloadPath);
      } catch (e) {
        console.error('Could not import file', e);
      }
    }
  }
}

/** Tests whether a URL points to an image */
async function testImage(url: string, timeout: number = 2000): Promise<boolean> {
  try {
    const blob = await timeoutPromise(timeout, fetch(url));
    return IMG_EXTENSIONS.some((ext) => blob.type.endsWith(ext));
  } catch (e) {
    return false;
  }
}

function imageAsBase64(url: string): Promise<{ imgBase64: string; blob: Blob }> {
  return new Promise(async (resolve, reject) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const reader = new FileReader();

    reader.onerror = reject;
    reader.onload = () =>
      reader.result
        ? resolve({ imgBase64: reader.result.toString(), blob })
        : reject('Could not convert to base64 image');
    reader.readAsDataURL(blob);
  });
}

function getFilenameFromUrl(url: string, fallback: string) {
  if (url.startsWith('data:')) {
    return fallback;
  }
  const pathname = new URL(url).pathname;
  const index = pathname.lastIndexOf('/');
  return index !== -1 ? pathname.substring(index + 1) : pathname;
}

export async function getDropData(e: React.DragEvent): Promise<Array<File | string>> {
  // Using a set to filter out duplicates. For some reason, dropping URLs duplicates them 3 times (for me)
  const dropItems = new Set<File | string>();

  // First get all files in the drop event
  if (e.dataTransfer.files.length > 0) {
    // tslint:disable-next-line: prefer-for-of
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      // Check if file is an image
      if (ALLOWED_FILE_DROP_TYPES.includes(file.type)) {
        dropItems.add(file);
      }
    }
  }

  if (e.dataTransfer.types.includes('text/html')) {
    const droppedHtml = e.dataTransfer.getData('text/html');
    const container = document.createElement('html');
    container.innerHTML = droppedHtml;
    const imgs = container.getElementsByTagName('img');
    if (imgs.length === 1) {
      const src = imgs[0].src;
      dropItems.add(src);
    }
  } else if (e.dataTransfer.types.includes('text/plain')) {
    const plainText = e.dataTransfer.getData('text/plain');
    // Check if text is an URL
    if (/^https?:\/\//i.test(plainText)) {
      dropItems.add(plainText);
    }
  }

  const imageItems = Array.from(dropItems);
  // Filter out URLs that are not an image
  const imageChecks = await Promise.all(
    imageItems.map(async (item) => {
      if (item instanceof File) {
        return true;
        // Check if the URL has an image extension, or perform a network request
      } else if (IMG_EXTENSIONS.some((ext) => item.toLowerCase().includes(`.${ext}`))) {
        return true;
      } else {
        return await testImage(item);
      }
    }),
  );
  // Remove all items that are not images from the array.
  retainArray(imageItems, (_, i) => imageChecks[i]);
  return imageItems;
}
