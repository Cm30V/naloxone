"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupplyReportDialog } from "@/components/supply-report-dialog";
import { displayImageSrc } from "@/lib/image";
import { formatDistance, haversineKm, mapsDirectionsUrl } from "@/lib/geo";
import type { Location } from "@/lib/types";
import { MapPin } from "lucide-react";

const GeorgiaMap = dynamic(
  () =>
    import("@/components/georgia-map").then((mod) => ({
      default: mod.GeorgiaMap,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-muted text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

type Props = {
  locations: Location[];
};

export function FindBox({ locations }: Props) {
  const [needNaloxone, setNeedNaloxone] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "unavailable"
  >("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [selected, setSelected] = useState<Location | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!navigator.geolocation) {
        setGeoStatus("unavailable");
        setGeoError(
          "This browser does not support location. Enter a ZIP instead.",
        );
        return;
      }
      setGeoStatus("requesting");
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatus("granted");
        },
        (err) => {
          setGeoStatus(
            err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
          );
          setGeoError(
            err.code === err.PERMISSION_DENIED
              ? "Location permission was denied. Enter a Georgia ZIP or address below."
              : "Could not read your location. Enter a Georgia ZIP or address below.",
          );
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
      );
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const visibleLocations = useMemo(() => {
    if (!needNaloxone) return locations;
    return locations.filter((loc) => loc.has_naloxone);
  }, [locations, needNaloxone]);

  const selectedWithDistance = useMemo(() => {
    if (!selected) return null;
    if (!coords) return { ...selected, distanceKm: null as number | null };
    return {
      ...selected,
      distanceKm: haversineKm(
        coords.lat,
        coords.lng,
        selected.latitude,
        selected.longitude,
      ),
    };
  }, [selected, coords]);

  function requestLocation() {
    if (!navigator.geolocation) {
      setGeoStatus("unavailable");
      setGeoError("This browser does not support location. Enter a ZIP instead.");
      return;
    }
    setGeoStatus("requesting");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("granted");
      },
      (err) => {
        setGeoStatus(
          err.code === err.PERMISSION_DENIED ? "denied" : "unavailable",
        );
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Enter a Georgia ZIP or address below."
            : "Could not read your location. Enter a Georgia ZIP or address below.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  async function geocodeManual(e: React.FormEvent) {
    e.preventDefault();
    setGeocoding(true);
    setGeoError(null);
    try {
      const res = await fetch(
        `/api/geocode?q=${encodeURIComponent(manualQuery)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setCoords({ lat: data.latitude, lng: data.longitude });
      setGeoStatus("granted");
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setGeocoding(false);
    }
  }

  if (selectedWithDistance) {
    const mapsHref = mapsDirectionsUrl(
      selectedWithDistance.latitude,
      selectedWithDistance.longitude,
      navigator.userAgent,
    );

    return (
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 flex-1 flex-col lg:w-1/2">
          <div className="px-4 pt-3">
            <button
              type="button"
              className="min-h-11 text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => setSelected(null)}
            >
              Back to map
            </button>
          </div>

          <article className="flex min-h-0 flex-1 flex-col px-4 py-3">
            <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
              <div className="relative aspect-[16/10] min-h-40 w-full shrink-0 bg-muted">
                {selectedWithDistance.image_urls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={displayImageSrc(selectedWithDistance.image_urls[0])}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
                    <MapPin className="size-12" aria-hidden />
                    <span className="text-sm">No photo yet</span>
                  </div>
                )}
              </div>
              <CardContent className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold leading-tight">
                    {selectedWithDistance.name}
                  </h2>
                  {selectedWithDistance.is_24_7 ? (
                    <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                      24/7
                    </Badge>
                  ) : null}
                </div>
                <p className="text-lg font-medium">
                  {selectedWithDistance.distanceKm == null
                    ? "Distance unavailable — share your location to see how far"
                    : `${formatDistance(selectedWithDistance.distanceKm)} away`}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {selectedWithDistance.description}
                </p>
              </CardContent>
            </Card>
          </article>
        </div>

        <div className="flex shrink-0 flex-col justify-center gap-3 border-t bg-card px-4 py-5 lg:w-1/2 lg:border-t-0 lg:border-l lg:px-8">
          <p className="text-center text-sm text-muted-foreground lg:text-left">
            Opens your phone’s map app with this box as the destination.
          </p>
          <Button asChild className="h-16 w-full text-lg font-semibold">
            <a href={mapsHref} target="_blank" rel="noopener noreferrer">
              Open in Maps
            </a>
          </Button>
          <SupplyReportDialog
            locationId={selectedWithDistance.id}
            locationName={selectedWithDistance.name}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b px-4 py-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Find a distribution box
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap a site on the Georgia map to see details. Your location is used
            only for distance — nothing is stored.
          </p>
        </div>

        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Checkbox
            checked={needNaloxone}
            onCheckedChange={(v) => setNeedNaloxone(v === true)}
          />
          Naloxone only
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-11"
            onClick={requestLocation}
            disabled={geoStatus === "requesting"}
          >
            {geoStatus === "requesting"
              ? "Waiting for permission…"
              : geoStatus === "granted"
                ? "Refresh my location"
                : "Use my location"}
          </Button>
        </div>

        {geoStatus !== "granted" ? (
          <form onSubmit={geocodeManual} className="space-y-2">
            <Label htmlFor="manual-location" className="text-sm">
              Or enter a Georgia ZIP or address
            </Label>
            <div className="flex gap-2">
              <Input
                id="manual-location"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="30303 or Atlanta"
                className="h-11 text-base"
                required
              />
              <Button
                type="submit"
                variant="secondary"
                className="h-11 px-4"
                disabled={geocoding}
              >
                {geocoding ? "Looking up…" : "Go"}
              </Button>
            </div>
          </form>
        ) : null}

        {geoError ? (
          <p className="text-sm text-destructive" role="alert">
            {geoError}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          {visibleLocations.length} site
          {visibleLocations.length === 1 ? "" : "s"} on the map
          {coords ? " · your location shown in blue" : ""}
        </p>
      </div>

      <div className="relative min-h-[55dvh] flex-1">
        <div className="absolute inset-0">
          <GeorgiaMap
            locations={visibleLocations}
            userCoords={coords}
            selectedId={null}
            onSelect={setSelected}
          />
        </div>
      </div>
    </div>
  );
}
