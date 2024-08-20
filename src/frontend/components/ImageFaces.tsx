import React, { ReactNode, useCallback, useEffect, useState } from 'react';

import { RendererMessenger } from '../../ipc/renderer';
import { useStore } from '../contexts/StoreContext';
import { ClientFile } from '../entities/File';
import { AppToaster } from './Toaster';

type ImageMetadata = Record<string, string>;

type Region = {
  RegionName: string;
  RegionPersonDisplayName: string;
  RegionRectangle: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  RegionType: string;
  RegionAreaX: number;
  RegionAreaY: number;
  RegionAreaW: number;
  RegionAreaH: number;
};

function getRegions(metadata: ImageMetadata): Region[] {
  // Ensure that each field exists and is not undefined or null
  const regionNames = metadata.RegionName ? metadata.RegionName.split(',') : [];
  const regionPersonDisplayNames = metadata.RegionPersonDisplayName
    ? metadata.RegionPersonDisplayName.split(',')
    : [];
  const regionRectangles = metadata.RegionRectangle
    ? metadata.RegionRectangle.split(',').map((coord) => parseFloat(coord.trim()))
    : [];
  const regionTypes = metadata.RegionType ? metadata.RegionType.split(',') : [];
  const regionAreaX = metadata.RegionAreaX
    ? metadata.RegionAreaX.split(',').map((coord) => parseFloat(coord.trim()))
    : [];
  const regionAreaY = metadata.RegionAreaY
    ? metadata.RegionAreaY.split(',').map((coord) => parseFloat(coord.trim()))
    : [];
  const regionAreaW = metadata.RegionAreaW
    ? metadata.RegionAreaW.split(',').map((coord) => parseFloat(coord.trim()))
    : [];
  const regionAreaH = metadata.RegionAreaH
    ? metadata.RegionAreaH.split(',').map((coord) => parseFloat(coord.trim()))
    : [];

  const numberOfRegions = Math.min(
    regionNames.length,
    regionPersonDisplayNames.length,
    Math.floor(regionRectangles.length / 4), // Ensure rectangle values come in sets of four
    regionTypes.length,
    regionAreaX.length,
    regionAreaY.length,
    regionAreaW.length,
    regionAreaH.length,
  );

  const regions: Region[] = [];

  for (let i = 0; i < numberOfRegions; i++) {
    regions.push({
      RegionName: regionNames[i] || '',
      RegionPersonDisplayName: regionPersonDisplayNames[i] || '',
      RegionRectangle: {
        x: regionRectangles[i * 4] || 0,
        y: regionRectangles[i * 4 + 1] || 0,
        w: regionRectangles[i * 4 + 2] || 0,
        h: regionRectangles[i * 4 + 3] || 0,
      },
      RegionType: regionTypes[i] || '',
      RegionAreaX: regionAreaX[i] || 0,
      RegionAreaY: regionAreaY[i] || 0,
      RegionAreaW: regionAreaW[i] || 0,
      RegionAreaH: regionAreaH[i] || 0,
    });
  }

  return regions;
}

type ExifField = { label: string; modifiable?: boolean; format?: (val: string) => ReactNode };

// Details: https://www.vcode.no/web/resource.nsf/ii2lnug/642.htm
const exifFields: Record<string, ExifField> = {
  RegionPersonDisplayName: { label: 'Person Display Name' },
  RegionRectangle: { label: 'Rectangle' },
  RegionAppliedToDimensionsW: { label: 'Image Width' },
  RegionAppliedToDimensionsH: { label: 'Image Height' },
  RegionAppliedToDimensionsUnit: { label: 'Dimensions Unit' },
  RegionName: { label: 'Region Name' },
  RegionType: { label: 'Region Type' },
  RegionAreaX: { label: 'Area X' },
  RegionAreaY: { label: 'Area Y' },
  RegionAreaW: { label: 'Area Width' },
  RegionAreaH: { label: 'Area Height' },
  RegionAreaUnit: { label: 'Area Unit' },
};

const exifTags = Object.keys(exifFields);

const stopPropagation = (e: React.KeyboardEvent<HTMLInputElement>) => e.stopPropagation();

interface ImageFaceProps {
  file: ClientFile;
}

const ImageFace = ({ file }: ImageFaceProps) => {
  const { exifTool } = useStore();

  const [isEditing, setIsEditing] = useState(false);
  const [viewAllExifTool, setViewAllExifTool] = useState(false);
  const [exifStats, setExifStats] = useState<Record<string, string>>({});
  const [exifAll, setExifAll] = useState<string>('');

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

  return (
    <div className="inspector-section">
      {getRegions(exifStats).map((region, index) => (
        <div key={index}>
          <h3>{region.RegionName}</h3>
          <p>
            <strong>Person Display Name:</strong> {region.RegionPersonDisplayName}
          </p>
          <p>
            <strong>Type:</strong> {region.RegionType}
          </p>
          <p>
            <strong>Rectangle:</strong> (x: {region.RegionRectangle.x}, y:{' '}
            {region.RegionRectangle.y}, w: {region.RegionRectangle.w}, h: {region.RegionRectangle.h}
            )
          </p>
          <p>
            <strong>Area:</strong> (X: {region.RegionAreaX}, Y: {region.RegionAreaY}, W:{' '}
            {region.RegionAreaW}, H: {region.RegionAreaH})
          </p>
        </div>
      ))}
    </div>
  );
};

export default React.memo(ImageFace);
