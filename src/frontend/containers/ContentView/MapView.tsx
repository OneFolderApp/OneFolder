import React, { useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';

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
      <div className="sidebar">
        The map is still in development, we will <br />
        notify the mailing list when is ready
      </div>
      <div ref={mapContainer} className="map" />
    </div>
  );
}
