"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Location } from "@/lib/types";
import "leaflet/dist/leaflet.css";

const GA_CENTER: [number, number] = [32.65, -83.5];
const GA_BOUNDS = L.latLngBounds(
  L.latLng(30.2, -85.7),
  L.latLng(35.2, -80.7),
);

/** Screen-pixel radius for map taps to count as selecting a site (phones). */
const TAP_HIT_PX = 44;

type Props = {
  locations: Location[];
  userCoords: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (location: Location) => void;
};

function FitGeorgia({
  locations,
  userCoords,
}: {
  locations: Location[];
  userCoords: { lat: number; lng: number } | null;
}) {
  const map = useMap();

  useEffect(() => {
    const invalidate = window.setTimeout(() => {
      map.invalidateSize();
    }, 50);

    map.setMaxBounds(GA_BOUNDS.pad(0.15));

    if (!locations.length && !userCoords) {
      map.setView(GA_CENTER, 7);
      return () => window.clearTimeout(invalidate);
    }

    const points: L.LatLngExpression[] = locations.map((loc) => [
      loc.latitude,
      loc.longitude,
    ]);
    if (userCoords) {
      points.push([userCoords.lat, userCoords.lng]);
    }
    if (points.length) {
      map.fitBounds(L.latLngBounds(points).pad(0.18), { maxZoom: 10 });
    }
    return () => window.clearTimeout(invalidate);
  }, [locations, map, userCoords]);

  return null;
}

function nearestLocation(
  map: L.Map,
  point: L.Point,
  locations: Location[],
  maxPx: number,
): Location | null {
  let best: Location | null = null;
  let bestDist = maxPx;
  for (const loc of locations) {
    const markerPoint = map.latLngToContainerPoint([
      loc.latitude,
      loc.longitude,
    ]);
    const dist = markerPoint.distanceTo(point);
    if (dist < bestDist) {
      bestDist = dist;
      best = loc;
    }
  }
  return best;
}

/** Map-level tap fallback — more reliable on phones than marker-only hits. */
function TapToSelect({
  locations,
  onSelect,
}: {
  locations: Location[];
  onSelect: (location: Location) => void;
}) {
  const map = useMapEvents({
    click(e) {
      const hit = nearestLocation(map, e.containerPoint, locations, TAP_HIT_PX);
      if (hit) onSelect(hit);
    },
  });
  return null;
}

export function GeorgiaMap({
  locations,
  userCoords,
  selectedId,
  onSelect,
}: Props) {
  const markers = useMemo(() => locations, [locations]);

  return (
    <MapContainer
      center={GA_CENTER}
      zoom={7}
      minZoom={6}
      maxZoom={16}
      scrollWheelZoom
      tapTolerance={28}
      className="z-0 h-full w-full touch-manipulation"
      style={{ height: "100%", width: "100%", touchAction: "pan-x pan-y" }}
    >
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
      />
      <FitGeorgia locations={markers} userCoords={userCoords} />
      <TapToSelect locations={markers} onSelect={onSelect} />

      {userCoords ? (
        <CircleMarker
          center={[userCoords.lat, userCoords.lng]}
          radius={10}
          pathOptions={{
            color: "#fff",
            weight: 2,
            fillColor: "#0ea5e9",
            fillOpacity: 1,
          }}
          interactive={false}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent={false}>
            Your location
          </Tooltip>
        </CircleMarker>
      ) : null}

      {markers.map((loc) => {
        const selected = loc.id === selectedId;
        return (
          <CircleMarker
            key={loc.id}
            center={[loc.latitude, loc.longitude]}
            radius={selected ? 14 : 12}
            pathOptions={{
              color: "#fff",
              weight: 3,
              fillColor: selected ? "#2563eb" : "#dc2626",
              fillOpacity: 1,
              // Keep marker taps from also firing map click (cleaner on phones)
              bubblingMouseEvents: false,
            }}
            eventHandlers={{
              click: () => {
                onSelect(loc);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -12]} interactive={false}>
              {loc.name}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
