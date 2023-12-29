import React, { ReactNode, useCallback, useEffect, useState } from 'react';

import { IconSet } from 'widgets/icons';
import { Toolbar, ToolbarButton } from 'widgets/toolbar';
import { RendererMessenger } from '../../ipc/renderer';
import { useStore } from '../contexts/StoreContext';
import { ClientFile } from '../entities/File';
import { AppToaster } from './Toaster';

type ExifField = { label: string; modifiable?: boolean; format?: (val: string) => ReactNode };

// Details: https://www.vcode.no/web/resource.nsf/ii2lnug/642.htm
const exifFields: Record<string, ExifField> = {
  ImageDescription: { label: 'Description', modifiable: true },
};

const exifTags = Object.keys(exifFields);

const stopPropagation = (e: React.KeyboardEvent<HTMLTextAreaElement>) => e.stopPropagation();

interface ImageInfoProps {
  file: ClientFile;
}

const ImageInfo = ({ file }: ImageInfoProps) => {
  const { exifTool } = useStore();

  const [isEditing, setIsEditing] = useState(false);
  const [exifStats, setExifStats] = useState<Record<string, string>>({});
  const descriptionKey = 'ImageDescription';

  useEffect(() => {
    // When the file changes, update the exif stats
    setIsEditing(false);
    // Reset previous fields to empty string, so the re-render doesn't flicker as when setting it to {}
    setExifStats(
      Object.entries(exifStats).reduce(
        (acc, [key, val]) => ({ ...acc, [key]: val ? ' ' : '' }),
        {},
      ),
    );

    exifTool.readExifTags(file.absolutePath, exifTags).then((tagValues) => {
      const stats: Record<string, string> = {};
      tagValues.forEach((val, i) => {
        const key = exifTags[i];
        stats[key] = val || '';
      });
      setExifStats(stats);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.absolutePath]);

  const handleEditSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const form = e.currentTarget as HTMLFormElement;

      const data: Record<string, string> = {};
      const newExifStats = { ...exifStats };

      const value = (form.elements.namedItem(descriptionKey) as HTMLTextAreaElement).value;
      if (value) {
        // Set value to store in exif data
        data[descriptionKey] = value;

        // Update data for in view, lil bit hacky
        newExifStats[descriptionKey] = value;
      }

      setIsEditing(false);
      setExifStats(newExifStats);

      exifTool
        .writeData(file.absolutePath, data)
        .then(() => AppToaster.show({ message: 'Image description updated', timeout: 3000 }))
        .catch((err) => {
          AppToaster.show({
            message: 'Could not updated image description',
            clickAction: { label: 'View', onClick: RendererMessenger.toggleDevTools },
            timeout: 6000,
          });
          console.error('Could not update image description', err);
        });
    },
    [exifStats, exifTool, file.absolutePath],
  );

  return (
    <div>
      <form onSubmit={handleEditSubmit} onReset={() => setIsEditing(false)}>
        <header>
          <h2>Description</h2>
        </header>
        {/* <textarea defaultValue={exifStats[descriptionKey] || ''} key={descriptionKey}></textarea> */}
        <textarea
          defaultValue={exifStats[descriptionKey] || ''}
          name={descriptionKey}
          onKeyDown={stopPropagation}
          className="description-box"
        ></textarea>
        <table id="file-info">
          {/* <tbody>
            {Object.entries(exifFields).map(([key, field]) => {
              const value = exifStats[key];
              const isEditingMode = isEditing && field.modifiable;
              if (!value && !isEditingMode) {
                return null;
              }
              return (
                <tr key={key}>
                  <td>
                    {!isEditingMode ? (
                      field.format?.(value || '') || value
                    ) : (
                      <textarea
                        defaultValue={exifStats[descriptionKey] || ''}
                        name={descriptionKey}
                        onKeyDown={stopPropagation}
                      ></textarea>

                      // <input defaultValue={value || ''} name={key} onKeyDown={stopPropagation} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody> */}
        </table>
        <Toolbar controls="file-info" isCompact>
          {!isEditing ? (
            <>
              <ToolbarButton
                key="cancel"
                icon={IconSet.CLOSE}
                text="Cancel"
                tooltip="Cancel changes"
                type="reset"
              />
              <ToolbarButton
                key="submit"
                icon={IconSet.SELECT_CHECKED}
                text="Save"
                tooltip="Save changes"
                type="submit"
              />
            </>
          ) : (
            <ToolbarButton
              key="edit"
              icon={IconSet.EDIT}
              text="Edit"
              onClick={() => setIsEditing(true)}
              tooltip="Edit Exif data"
              type="button"
            />
          )}
        </Toolbar>
      </form>
    </div>
  );
};

export default React.memo(ImageInfo);
