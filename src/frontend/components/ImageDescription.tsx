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

const stopPropagation = (e: React.KeyboardEvent<HTMLInputElement>) => e.stopPropagation();

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
      console.log('exifStats', exifStats);
      console.log('form', form.elements);

      // const value = (form.elements.namedItem(descriptionKey) as HTMLInputElement).value;
      // if (value) {
      //   // Set value to store in exif data
      //   data[descriptionKey] = value;

      //   // Update data for in view, lil bit hacky
      //   newExifStats[descriptionKey] = value;
      // }

      console.log('newExifStats', newExifStats);

      setIsEditing(false);
      setExifStats(newExifStats);

      // TODO: also update filename here?

      // TODO: this doesn't update the modified time of the file. Maybe it should? See ExifIO internals
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
        <table id="file-info">
          <tbody>
            {Object.entries(exifFields).map(([key, field]) => {
              const value = exifStats[key];
              const isEditingMode = isEditing && field.modifiable;
              if (!value && !isEditingMode) {
                return null;
              }
              return (
                <tr key={key}>
                  <th scope="row">{field.label}</th>

                  <td>
                    {!isEditingMode ? (
                      field.format?.(value || '') || value
                    ) : (
                      <input defaultValue={value || ''} name={key} onKeyDown={stopPropagation} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Toolbar controls="file-info" isCompact>
          {isEditing ? (
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
