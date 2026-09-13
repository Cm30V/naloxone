"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SupplyReportDialog } from "@/components/supply-report-dialog";
import { displayImageSrc } from "@/lib/image";
import { formatDistance, haversineKm, mapsDirectionsUrl } from "@/lib/geo";
import type { Location, RankedLocation } from "@/lib/types";
import { MapPin } from "lucide-react";

type Props = {
  locations: Location[];
};

function filterLocations(
  locations: Location[],
  needNaloxone: boolean,
  needStrips: boolean,
) {
  return locations.filter((loc) => {
    if (needNaloxone && !loc.has_naloxone) return false;
    if (needStrips && !loc.has_fent_strips) return false;
    return true;
  });
}

function rankNearest(
  locations: Location[],
  lat: number,
  lng: number,
): RankedLocation[] {
  return [...locations]
    .map((loc) => ({
      ...loc,
      distanceKm: haversineKm(lat, lng, loc.latitude, loc.longitude),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 3);
}

export function FindBox({ locations }: Props) {
  const [needNaloxone, setNeedNaloxone] = useState(false);
  const [needStrips, setNeedStrips] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [geoStatus, setGeoStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "unavailable"
  >("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [manualQuery, setManualQuery] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

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
          setActiveIndex(0);
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

  const matches = useMemo(() => {
    if (!coords) return [];
    return rankNearest(
      filterLocations(locations, needNaloxone, needStrips),
      coords.lat,
      coords.lng,
    );
  }, [locations, needNaloxone, needStrips, coords]);

  const active = matches[activeIndex] ?? matches[0] ?? null;

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
        setActiveIndex(0);
      },
      (err) => {
        setGeoStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
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
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(manualQuery)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setCoords({ lat: data.latitude, lng: data.longitude });
      setGeoStatus("granted");
      setActiveIndex(0);
    } catch (err) {
      setGeoError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setGeocoding(false);
    }
  }

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const width = el.clientWidth;
    if (!width) return;
    setActiveIndex(Math.round(el.scrollLeft / width));
  }

  const mapsHref = active
    ? mapsDirectionsUrl(active.latitude, active.longitude, navigator.userAgent)
    : "#";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!coords ? (
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Find a distribution box
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              We use your location only to calculate the nearest matching box.
              Nothing is stored.
            </p>
          </div>

          <fieldset className="space-y-3 rounded-xl border border-border bg-card p-4">
            <legend className="px-1 text-sm font-medium">I need</legend>
            <label className="flex min-h-12 items-center gap-3 text-base">
              <Checkbox
                checked={needNaloxone}
                onCheckedChange={(v) => setNeedNaloxone(v === true)}
              />
              Naloxone
            </label>
            <label className="flex min-h-12 items-center gap-3 text-base">
              <Checkbox
                checked={needStrips}
                onCheckedChange={(v) => setNeedStrips(v === true)}
              />
              Fentanyl test strips
            </label>
            <p className="text-sm text-muted-foreground">
              Leave both unchecked to show every box. Check both if you need
              both supplies.
            </p>
          </fieldset>

          <Button
            type="button"
            className="h-14 w-full text-base"
            onClick={requestLocation}
            disabled={geoStatus === "requesting"}
          >
            {geoStatus === "requesting"
              ? "Waiting for permission…"
              : "Use my location"}
          </Button>

          {(geoStatus === "denied" ||
            geoStatus === "unavailable" ||
            geoStatus === "idle" ||
            geoStatus === "requesting") && (
            <form onSubmit={geocodeManual} className="space-y-3">
              <Label htmlFor="manual-location" className="text-base">
                Or enter a Georgia ZIP or address
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manual-location"
                  value={manualQuery}
                  onChange={(e) => setManualQuery(e.target.value)}
                  placeholder="30303 or Atlanta"
                  className="h-12 text-base"
                  required
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="h-12 px-4"
                  disabled={geocoding}
                >
                  {geocoding ? "Looking up…" : "Go"}
                </Button>
              </div>
            </form>
          )}

          {geoError ? (
            <p className="text-sm text-destructive" role="alert">
              {geoError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="flex min-h-0 flex-1 flex-col lg:w-1/2">
            <div className="flex flex-col gap-3 px-4 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  className="min-h-11 text-sm font-medium underline-offset-4 hover:underline"
                  onClick={() => {
                    setCoords(null);
                    setGeoStatus("idle");
                    setActiveIndex(0);
                  }}
                >
                  Change location
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox
                    checked={needNaloxone}
                    onCheckedChange={(v) => {
                      setNeedNaloxone(v === true);
                      setActiveIndex(0);
                    }}
                  />
                  Naloxone
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox
                    checked={needStrips}
                    onCheckedChange={(v) => {
                      setNeedStrips(v === true);
                      setActiveIndex(0);
                    }}
                  />
                  Fentanyl test strips
                </label>
              </div>
            </div>

            {matches.length === 0 ? (
              <div className="flex flex-1 items-center px-4">
                <p className="text-base">
                  No matching boxes found. Try clearing a filter.
                </p>
              </div>
            ) : (
              <div
                ref={scrollerRef}
                onScroll={onScroll}
                className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto"
              >
                {matches.map((loc) => (
                  <article
                    key={loc.id}
                    className="flex w-full shrink-0 snap-start flex-col px-4 py-3"
                  >
                    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden py-0">
                      <div className="relative aspect-[16/10] min-h-40 w-full shrink-0 bg-muted">
                        {loc.image_urls[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={displayImageSrc(loc.image_urls[0])}
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
                            {loc.name}
                          </h2>
                          {loc.is_24_7 ? (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                              24/7
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-lg font-medium">
                          {formatDistance(loc.distanceKm)} away
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {loc.description}
                        </p>
                      </CardContent>
                    </Card>
                  </article>
                ))}
              </div>
            )}

            {matches.length > 1 ? (
              <div className="flex justify-center gap-2 pb-2">
                {matches.map((loc, i) => (
                  <button
                    key={loc.id}
                    type="button"
                    aria-label={`Show result ${i + 1}`}
                    className={`h-2.5 w-2.5 rounded-full ${
                      i === activeIndex ? "bg-primary" : "bg-muted-foreground/40"
                    }`}
                    onClick={() => {
                      scrollerRef.current?.scrollTo({
                        left: i * (scrollerRef.current.clientWidth || 0),
                        behavior: "smooth",
                      });
                      setActiveIndex(i);
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-col justify-center gap-3 border-t bg-card px-4 py-5 lg:w-1/2 lg:border-t-0 lg:border-l lg:px-8">
            <p className="text-center text-sm text-muted-foreground lg:text-left">
              Opens your phone’s map app with this box as the destination.
            </p>
            {active ? (
              <>
                <Button
                  asChild
                  className="h-16 w-full text-lg font-semibold"
                >
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                    Open in Maps
                  </a>
                </Button>
                <SupplyReportDialog
                  locationId={active.id}
                  locationName={active.name}
                />
              </>
            ) : (
              <Button className="h-16 w-full text-lg" disabled>
                Open in Maps
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
