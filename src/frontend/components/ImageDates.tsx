import fse from 'fs-extra';
import React, { ReactNode, useCallback, useEffect, useState } from 'react';

import { formatDateTime, humanFileSize } from 'common/fmt';
import { IconSet } from 'widgets/icons';
import { Toolbar, ToolbarButton } from 'widgets/toolbar';
import { RendererMessenger } from '../../ipc/renderer';
import { useStore } from '../contexts/StoreContext';
import { ClientFile } from '../entities/File';
import { usePromise } from '../hooks/usePromise';
import ExternalLink from './ExternalLink';
import { AppToaster } from './Toaster';
import { div } from '@tensorflow/tfjs';

type CommonMetadata = {
  imported: string;
  created: string;
  modified: string;
};

const commonMetadataLabels: Record<keyof CommonMetadata, string> = {
  imported: 'Imported',
  // TODO: modified in OneFolder vs modified in system?
  created: 'Created',
  modified: 'Modified',
};

type ExifField = { label: string; modifiable?: boolean; format?: (val: string) => ReactNode };

// Details: https://www.vcode.no/web/resource.nsf/ii2lnug/642.htm
const exifFields: Record<string, ExifField> = {
  DateCreated: { label: 'DateCreated', modifiable: true },
  CreateDate: { label: 'CreateDate', modifiable: true },
  ModifyDate: { label: 'ModifyDate', modifiable: true },
};

const exifTags = Object.keys(exifFields);

const stopPropagation = (e: React.KeyboardEvent<HTMLInputElement>) => e.stopPropagation();

interface ImageInfoProps {
  file: ClientFile;
}

const ImageInfo = ({ file }: ImageInfoProps) => {
  const { exifTool } = useStore();

  const [isEditing, setIsEditing] = useState(false);
  const [viewAllExifTool, setViewAllExifTool] = useState(false);
  const [exifStats, setExifStats] = useState<Record<string, string>>({});
  const [exifAll, setExifAll] = useState<string>('');

  const modified = usePromise(file.absolutePath, async (filePath) => {
    const stats = await fse.stat(filePath);
    return formatDateTime(stats.ctime);
  });

  const fileStats: CommonMetadata = {
    imported: formatDateTime(file.dateAdded),
    created: formatDateTime(file.dateCreated),
    modified: modified.tag === 'ready' && 'ok' in modified.value ? modified.value.ok : '...',
  };

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

    exifTool.readAllExifTags(file.absolutePath).then((values) => {
      setExifAll(JSON.stringify(values, null, 2));
    });

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
      for (const [key, field] of Object.entries(exifFields)) {
        if (field.modifiable) {
          const value = (form.elements.namedItem(key) as HTMLInputElement).value;
          if (value) {
            // Set value to store in exif data
            data[key] = value;

            // Update data for in view, lil bit hacky
            newExifStats[key] = value;
          }
        }
      }

      setIsEditing(false);
      setExifStats(newExifStats);

      // TODO: also update filename here?

      // TODO: this doesn't update the modified time of the file. Maybe it should? See ExifIO internals
      exifTool
        .writeData(file.absolutePath, data)
        .then(() => AppToaster.show({ message: 'Image file saved!', timeout: 3000 }))
        .catch((err) => {
          AppToaster.show({
            message: 'Could not save image file',
            clickAction: { label: 'View', onClick: RendererMessenger.toggleDevTools },
            timeout: 6000,
          });
          console.error('Could not update file', err);
        });
    },
    [exifStats, exifTool, file.absolutePath],
  );

  // Todo: Would be nice to also add tooltips explaining what these mean (e.g. diff between dimensions & resolution)
  // Or add the units: pixels vs DPI
  return (
    <div className="inspector-section">
      <form onSubmit={handleEditSubmit} onReset={() => setIsEditing(false)}>
        <table id="file-info">
          <tbody>
            {Object.entries(commonMetadataLabels).map(([field, label]) => (
              <tr key={field}>
                <th scope="row">{label}</th>
                <td>{fileStats[field as keyof CommonMetadata]}</td>
              </tr>
            ))}
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
        <div className={'inspector-section__action-buttons '}>
          {isEditing ? (
            <>
              <button type="reset">cancel</button>
              <button className="highlight-save" type="submit">
                save
              </button>
            </>
          ) : (
            <button
              className="edit-button"
              onClick={(e) => {
                e.preventDefault();
                setIsEditing(true);
              }}
            >
              edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default React.memo(ImageInfo);
