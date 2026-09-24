"use client";

import { useEffect, useMemo } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Location } from "@/lib/types";
import "leaflet/dist/leaflet.css";

const GA_CENTER: [number, number] = [32.65, -83.5];
const GA_BOUNDS = L.latLngBounds(
  L.latLng(30.2, -85.7),
  L.latLng(35.2, -80.7),
);

type Props = {
  locations: Location[];
  userCoords: { lat: number; lng: number } | null;
  selectedId: string | null;
  onSelect: (location: Location) => void;
};

function siteIcon(selected: boolean) {
  const color = selected ? "#2563eb" : "#dc2626";
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `<span style="display:block;width:28px;height:28px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);"></span>`,
  });
}

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
      className="z-0 h-full w-full"
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom'
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
      />
      <FitGeorgia locations={markers} userCoords={userCoords} />

      {userCoords ? (
        <CircleMarker
          center={[userCoords.lat, userCoords.lng]}
          radius={9}
          pathOptions={{
            color: "#fff",
            weight: 2,
            fillColor: "#0ea5e9",
            fillOpacity: 1,
          }}
        >
          <Tooltip direction="top" offset={[0, -8]} permanent={false}>
            Your location
          </Tooltip>
        </CircleMarker>
      ) : null}

      {markers.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.latitude, loc.longitude]}
          icon={siteIcon(loc.id === selectedId)}
          eventHandlers={{
            click: () => onSelect(loc),
          }}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            {loc.name}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}
