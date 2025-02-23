import fse from 'fs-extra';
import { action, when } from 'mobx';
import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ellipsize, humanFileSize } from 'common/fmt';
import { encodeFilePath } from 'common/fs';
import { IconButton, IconSet, Tag } from 'widgets';
import { useStore } from '../../contexts/StoreContext';
import { ClientFile } from '../../entities/File';
import { ClientTag } from '../../entities/Tag';
import { usePromise } from '../../hooks/usePromise';
import { CommandDispatcher, MousePointerEvent } from './Commands';
import { ITransform } from './Masonry/layout-helpers';

interface ItemProps {
  file: ClientFile;
  mounted: boolean;
  // Will use the original image instead of the thumbnail
  forceNoThumbnail?: boolean;
}

interface MasonryItemProps extends ItemProps {
  forceNoThumbnail: boolean;
  transform: ITransform;
}

export const MasonryCell = observer(
  ({
    file,
    mounted,
    forceNoThumbnail,
    transform: [width, height, top, left],
  }: MasonryItemProps) => {
    const { uiStore, fileStore } = useStore();
    const style = { height, width, transform: `translate(${left}px,${top}px)` };
    const eventManager = useMemo(() => new CommandDispatcher(file), [file]);

    return (
      <div data-masonrycell aria-selected={uiStore.fileSelection.has(file)} style={style}>
        <div
          className={`thumbnail${file.isBroken ? ' thumbnail-broken' : ''}`}
          onClick={eventManager.select}
          onDoubleClick={eventManager.preview}
          onContextMenu={eventManager.showContextMenu}
          onDragStart={eventManager.dragStart}
          onDragEnter={eventManager.dragEnter}
          onDragOver={eventManager.dragOver}
          onDragLeave={eventManager.dragLeave}
          onDrop={eventManager.drop}
          onDragEnd={eventManager.dragEnd}
        >
          <Thumbnail mounted={mounted} file={file} forceNoThumbnail={forceNoThumbnail} />
        </div>
        {file.isBroken === true && !fileStore.showsMissingContent && (
          <IconButton
            className="thumbnail-broken-overlay"
            icon={IconSet.WARNING_BROKEN_LINK}
            onClick={async (e) => {
              e.stopPropagation();
              e.preventDefault();
              await fileStore.fetchMissingFiles();
            }}
            text="This image could not be found. Open the recovery view."
          />
        )}

        {(uiStore.isThumbnailFilenameOverlayEnabled ||
          uiStore.isThumbnailResolutionOverlayEnabled) && (
            <ThumbnailOverlay
              file={file}
              showFilename={uiStore.isThumbnailFilenameOverlayEnabled}
              showResolution={uiStore.isThumbnailResolutionOverlayEnabled}
            />
          )}

        {/* Show tags when the option is enabled, or when the file is selected */}
        {(uiStore.isThumbnailTagOverlayEnabled || uiStore.fileSelection.has(file)) &&
          (!mounted ? (
            <span className="thumbnail-tags" />
          ) : (
            <ThumbnailTags file={file} eventManager={eventManager} />
          ))}
      </div>
    );
  },
);

// TODO: When a filename contains https://x/y/z.abc?323 etc., it can't be found
// e.g. %2F should be %252F on filesystems. Something to do with decodeURI, but seems like only on the filename - not the whole path
export const Thumbnail = observer(({ file, mounted, forceNoThumbnail }: ItemProps) => {
  const { uiStore, imageLoader } = useStore();
  const { thumbnailPath, isBroken } = file;

  // This will check whether a thumbnail exists, generate it if needed
  const imageSource = usePromise(
    file,
    isBroken,
    mounted,
    thumbnailPath,
    uiStore.isList || !forceNoThumbnail,
    async (file, isBroken, mounted, thumbnailPath, useThumbnail) => {
      // If it is broken, only show thumbnail if it exists.
      if (!mounted || isBroken === true) {
        if (await fse.pathExists(thumbnailPath)) {
          return thumbnailPath;
        } else {
          throw new Error('No thumbnail available.');
        }
      }

      if (useThumbnail) {
        const freshlyGenerated = await imageLoader.ensureThumbnail(file);
        // The thumbnailPath of an image is always set, but may not exist yet.
        // When the thumbnail is finished generating, the path will be changed to `${thumbnailPath}?v=1`.
        if (freshlyGenerated) {
          await when(() => file.thumbnailPath.endsWith('?v=1'), { timeout: 10000 });
          if (!getThumbnail(file).endsWith('?v=1')) {
            throw new Error('Thumbnail generation timeout.');
          }
        }
        return getThumbnail(file);
      } else {
        const src = await imageLoader.getImageSrc(file);
        if (src !== undefined) {
          return src;
        } else {
          throw new Error('No thumbnail available.');
        }
      }
    },
  );

  // Even though all thumbnail errors should be caught in the above usePromise,
  // there is a chance that the image cannot be loaded, and we don't want to show broken image icons
  const fileId = file.id;
  const fileIdRef = useRef(fileId);
  const [loadError, setLoadError] = useState(false);
  const handleImageError = useCallback(() => {
    if (fileIdRef.current === fileId) {
      setLoadError(true);
    }
  }, [fileId]);
  useEffect(() => {
    fileIdRef.current = fileId;
    setLoadError(false);
  }, [fileId]);

  if (!mounted) {
    return <span className="image-placeholder" />;
  } else if (loadError) {
    return <span className="image-loading" />;
  } else if (imageSource.tag === 'ready') {
    if ('ok' in imageSource.value) {
      const is_lowres = file.width < 320 || file.height < 320;
      return (
        <img
          src={encodeFilePath(imageSource.value.ok)}
          alt=""
          data-file-id={file.id}
          onError={handleImageError}
          style={
            is_lowres && uiStore.upscaleMode == 'pixelated' ? { imageRendering: 'pixelated' } : {}
          }
        />
      );
    } else {
      return <span className="image-error" />;
    }
  } else {
    return <span className="image-loading" />;
  }
});

const getThumbnail = action((file: ClientFile) => file.thumbnailPath);

export const ThumbnailTags = observer(
  ({ file, eventManager }: { file: ClientFile; eventManager: CommandDispatcher }) => {
    return (
      <span
        className="thumbnail-tags"
        onClick={eventManager.select}
        onDoubleClick={eventManager.preview}
        onContextMenu={eventManager.showContextMenu}
        onDragStart={eventManager.dragStart}
        onDragEnter={eventManager.dragEnter}
        onDragOver={eventManager.dragOver}
        onDragLeave={eventManager.dragLeave}
        onDrop={eventManager.drop}
        onDragEnd={eventManager.dragEnd}
      >
        {Array.from(file.tags, (tag) => (
          <TagWithHint key={tag.id} tag={tag} onContextMenu={eventManager.showTagContextMenu} />
        ))}
      </span>
    );
  },
);

const TagWithHint = observer(
  ({
    tag,
    onContextMenu,
  }: {
    tag: ClientTag;
    onContextMenu: (e: MousePointerEvent, tag: ClientTag) => void;
  }) => {
    return (
      <Tag
        text={tag.name}
        color={tag.viewColor}
        tooltip={tag.path.map((v) => v.startsWith('#') ? '&nbsp;<b>' + v.slice(1) + '</b>&nbsp;' : v).join(' › ')}
        onContextMenu={(e) => onContextMenu(e, tag)}
      />
    );
  },
);

const ThumbnailOverlay = ({
  file,
  showFilename,
  showResolution,
}: {
  file: ClientFile;
  showFilename: boolean;
  showResolution: boolean;
}) => {
  const title = `${ellipsize(file.absolutePath, 80, 'middle')}, ${file.width}x${file.height
    }, ${humanFileSize(file.size)}`;

  return (
    <div className="thumbnail-overlay" data-tooltip={title}>
      {showFilename && (
        <div className="thumbnail-filename" data-tooltip={title}>
          {file.name}
        </div>
      )}

      {showResolution && (
        <div className="thumbnail-resolution" data-tooltip={title}>
          {file.width}⨯{file.height}
        </div>
      )}
    </div>
  );
};
