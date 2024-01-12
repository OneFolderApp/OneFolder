import React, { ReactNode, useCallback, useEffect, useState } from 'react';

import { humanFileSize } from 'common/fmt';
import { RendererMessenger } from '../../ipc/renderer';
import { useStore } from '../contexts/StoreContext';
import { ClientFile } from '../entities/File';
import ExternalLink from './ExternalLink';
import { AppToaster } from './Toaster';

type CommonMetadata = {
  name: string;
  dimensions: string;
  size: string;
};

const commonMetadataLabels: Record<keyof CommonMetadata, string> = {
  name: 'Filename',
  dimensions: 'Dimensions',
  size: 'Size',
};

type ExifField = { label: string; modifiable?: boolean; format?: (val: string) => ReactNode };

// Details: https://www.vcode.no/web/resource.nsf/ii2lnug/642.htm
const exifFields: Record<string, ExifField> = {
  // PhotometricInterpretation: { label: 'Color Mode' },
  // BitsPerSample: { label: 'Bit Depth' },
  Software: { label: 'Creation Software', modifiable: true },
  Artist: { label: 'Creator', modifiable: true },
  CreatorWorkURL: {
    label: 'Creator URL',
    modifiable: true,
    format: function CreatorURL(url?: string) {
      if (!url) {
        return ' ';
      }
      return <ExternalLink url={url}>{url}</ExternalLink>;
    },
  },
  // ImageDescription: { label: 'Description', modifiable: true },
  Parameters: { label: 'Parameters' },
  Copyright: { label: 'Copyright', modifiable: true },
  Make: { label: 'Camera Manufacturer' },
  Model: { label: 'Camera Model' },
  // Megapixels: { label: 'Megapixels'  },
  // ExposureTime: { label: 'Exposure Time'  },
  // FNumber: { label: 'F-stop'  },
  // FocalLength: { label: 'Focal Length'  },
  GPSLatitude: { label: 'GPS Latitude' },
  GPSLongitude: { label: 'GPS Longitude' },
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

  const fileStats: CommonMetadata = {
    name: file.name,
    dimensions: `${file.width || '?'} x ${file.height || '?'}`,
    size: humanFileSize(file.size),
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
        <button
          className="show-exiftool"
          onClick={(e) => {
            e.preventDefault();
            setViewAllExifTool(!viewAllExifTool);
          }}
        >
          {viewAllExifTool ? 'hide' : 'show'} exiftool values ...
        </button>
        {viewAllExifTool && (
          <>
            <textarea
              name="exifToolAllFile"
              id=""
              cols={30}
              rows={10}
              value={exifAll}
              readOnly
            ></textarea>
            <br />
          </>
        )}
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
