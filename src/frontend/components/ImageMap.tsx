import React, { ReactNode, useRef, useCallback, useEffect, useState } from 'react';

import { RendererMessenger } from '../../ipc/renderer';
import { useStore } from '../contexts/StoreContext';
import { ClientFile } from '../entities/File';
import { AppToaster } from './Toaster';
import { convert } from 'geo-coordinates-parser';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// import { shell } from 'electron';
import { observer } from 'mobx-react-lite';

const in1 = 'pk';
const in2 = 'eyJ1IjoiYW50b2luZS1sYiIsImEiOiJjbHFxdjNoM2UzcG93MmtubXR0eXg1dmhuIn0';
const in3 = 'OH7kkxGoKpR_UK9lJb45sw';

mapboxgl.accessToken = `${in1}.${in2}.${in3}`;

type ExifField = { label: string; modifiable?: boolean; format?: (val: string) => ReactNode };

// Details: https://www.vcode.no/web/resource.nsf/ii2lnug/642.htm
const exifFields: Record<string, ExifField> = {
  GPSLatitude: { label: 'Latitude', modifiable: true },
  GPSLongitude: { label: 'Longitude', modifiable: true },
  GPSAltitude: { label: 'Altitude', modifiable: true },
  GPSDateStamp: { label: 'DateStamp', modifiable: true },
  GPSAltitudeRef: { label: 'AltitudeRef', modifiable: true },
  GPSTimeStamp: { label: 'TimeStamp', modifiable: true },
  GPSTrack: { label: 'Track', modifiable: true },
  GPSSpeed: { label: 'Speed', modifiable: true },
  GPSImgDirection: { label: 'ImgDirection', modifiable: true },
  GPSPitch: { label: 'Pitch', modifiable: true },
  GPSTrackRef: { label: 'TrackRef', modifiable: true },
  GPSSpeedRef: { label: 'SpeedRef', modifiable: true },
  GPSImgDirectionRef: { label: 'ImgDirectionRef', modifiable: true },
  GPSRoll: { label: 'Roll', modifiable: true },
  GPSCoordinates: { label: 'Coordinates', modifiable: true },
  AmbientTemperature: { label: 'AmbientTemperature', modifiable: true },
  CameraElevationAngle: { label: 'CameraElevationAngle', modifiable: true },
};

const exifTags = Object.keys(exifFields);

const stopPropagation = (e: React.KeyboardEvent<HTMLInputElement>) => e.stopPropagation();

interface ImageInfoProps {
  file: ClientFile;
}

const ImageInfo = observer(({ file }: ImageInfoProps) => {
  const defaultLat = 48.35;
  const defaultLon = 2.5;
  const zoom = 4;

  const { exifTool, uiStore } = useStore();

  const map = useRef<mapboxgl.Map | null>(null);
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const markerElement = useRef<HTMLDivElement | null>(null);

  const [currentMarker, setCurrentMarker] = useState<mapboxgl.Marker | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [theme] = useState(uiStore.theme);
  const [exifStats, setExifStats] = useState<Record<string, string>>({});
  const [lat, setLat] = useState<number>(0);
  const [lon, setLon] = useState<number>(0);

  useEffect(() => {
    if (map.current) {
      return;
    } // initialize map only once

    const mapUrl =
      theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/streets-v12';

    map.current = new mapboxgl.Map({
      container: mapContainer.current || '',
      style: mapUrl,
      center: [defaultLon, defaultLat],
      zoom: zoom,
    });
  }, [theme]);

  useEffect(() => {
    // TODO: check if there are other ways to get the coordinates (e.g. GPSPosition) in case other standards are used
    const gpsLatitude = exifStats['GPSLatitude'];
    const gpsLongitude = exifStats['GPSLongitude'];

    if (currentMarker) {
      currentMarker.remove();
    }

    if (!gpsLatitude || gpsLatitude === ' ' || !gpsLongitude || gpsLongitude === ' ') {
      return;
    }

    try {
      const converted = convert(`${gpsLatitude}, ${gpsLongitude}}`);
      if (converted) {
        setLat(converted.decimalLatitude);
        setLon(converted.decimalLongitude);
      }
    } catch (error) {
      console.log(error);
      return;
    }
  }, [exifStats]);

  useEffect(() => {
    if (map.current && lon && lat) {
      //@ts-ignore
      setCurrentMarker(new mapboxgl.Marker(markerElement).setLngLat([lon, lat]).addTo(map.current));

      map.current.flyTo({
        center: [lon, lat],
        duration: 3000,
        curve: 0,
      });
    }
  }, [map, lon, lat, markerElement]);

  useEffect(() => {
    // When the file changes, update the exif stats
    setIsEditing(false);
    setLat(0);
    setLon(0);
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
      <div ref={mapContainer} className="map" />
      <div ref={markerElement} className="" />
      <form onSubmit={handleEditSubmit} onReset={() => setIsEditing(false)}>
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
});

export default React.memo(ImageInfo);
