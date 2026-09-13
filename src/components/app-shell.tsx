"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminDashboard } from "@/components/admin-dashboard";
import { FindBox } from "@/components/find-box";
import { UploadBox } from "@/components/upload-box";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Location } from "@/lib/types";

export function AppShell() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLocations = useCallback(async () => {
    setLoadError(null);
    const res = await fetch("/api/locations", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load locations");
    setLocations(data.locations ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await loadLocations();
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLocations]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Georgia prototype
        </p>
        <h1 className="text-xl font-semibold">Naloxone & fentanyl strip locator</h1>
      </header>

      {loadError ? (
        <p className="px-4 py-6 text-destructive" role="alert">
          {loadError}
        </p>
      ) : null}

      <Tabs defaultValue="find" className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="border-b px-4 py-3">
          <TabsList className="grid h-12 min-h-12 w-full grid-cols-3 group-data-horizontal/tabs:h-12">
            <TabsTrigger value="find" className="text-base">
              Find a box
            </TabsTrigger>
            <TabsTrigger value="upload" className="text-base">
              Add a box
            </TabsTrigger>
            <TabsTrigger value="admin" className="text-base">
              Admin
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent
          value="find"
          forceMount
          className="mt-0 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
        >
          {loading ? (
            <p className="px-4 py-6 text-muted-foreground">Loading locations…</p>
          ) : (
            <FindBox locations={locations} />
          )}
        </TabsContent>
        <TabsContent
          value="upload"
          forceMount
          className="mt-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <UploadBox locations={locations} />
        </TabsContent>
        <TabsContent
          value="admin"
          forceMount
          className="mt-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"
        >
          <AdminDashboard
            onLocationPublished={() => {
              loadLocations().catch(() => {
                setLoadError("Unable to refresh public locations");
              });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
