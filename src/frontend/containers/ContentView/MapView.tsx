import React, { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import { shell } from 'electron';

const in1 = 'pk';
const in2 = 'eyJ1IjoiYW50b2luZS1sYiIsImEiOiJjbHFxdjNoM2UzcG93MmtubXR0eXg1dmhuIn0';
const in3 = 'OH7kkxGoKpR_UK9lJb45sw';

mapboxgl.accessToken = `${in1}.${in2}.${in3}`;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const lng = 2.5;
  const lat = 48.35;
  const zoom = 7.3;

  useEffect(() => {
    if (map.current) {
      return;
    } // initialize map only once

    // @ts-ignore
    map.current = new mapboxgl.Map({
      container: mapContainer.current || '',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [lng, lat],
      zoom: zoom,
    });
  });

  return (
    <div className="mapbox-container">
      <div className="wip-container">
        The map is not ready yet.
        <br />
        <br />
        If you want to speed up the development you <br /> can vote on our roadmap:
        <br />
        <button
          className="wip-link"
          onClick={() => {
            shell.openExternal('https://onefolder.canny.io/feedback/p/map-view');
          }}
        >
          onefolder.canny.io/feedback/p/map-view
        </button>
        <br />
        <br />
        <br />
        Comments and ideas are welcome 🙏
      </div>
      <div ref={mapContainer} className="map" />
    </div>
  );
}
