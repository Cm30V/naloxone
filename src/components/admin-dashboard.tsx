"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { displayImageSrc } from "@/lib/image";

type PendingLocation = {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  is_24_7: boolean;
  has_naloxone: boolean;
  has_fent_strips: boolean;
  type: string;
  image_urls: string[];
  contact_phone: string | null;
  contact_email: string | null;
  created_at: string;
};

type LocationStat = {
  id: string;
  name: string;
  used_count: number;
  unresolved_restock_count: number;
  total_restock_count: number;
};

type RestockReport = {
  id: string;
  location_id: string;
  location_name: string;
  created_at: string;
  resolved_at: string | null;
};

type UnresolvedRestock = {
  location_id: string;
  location_name: string;
  request_count: number;
  latest_report_at: string;
};

type DashboardData = {
  pending: PendingLocation[];
  locationStats: LocationStat[];
  restockReports: RestockReport[];
  unresolvedRestocks: UnresolvedRestock[];
};

type Props = {
  onLocationPublished: () => void;
};

export function AdminDashboard({ onLocationPublished }: Props) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usageFilter, setUsageFilter] = useState<"all" | "unresolved">("all");
  const [usageSort, setUsageSort] = useState<
    "name" | "used-desc" | "used-asc" | "restock-desc" | "restock-asc"
  >("name");

  const loadDashboard = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      setData(null);
      return;
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Unable to load dashboard");
    setAuthenticated(true);
    setData(body as DashboardData);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadDashboard().catch((reason) => {
        setAuthenticated(false);
        setError(
          reason instanceof Error ? reason.message : "Unable to load dashboard",
        );
      });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadDashboard]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error || "Unable to sign in");
      return;
    }
    setPassword("");
    await loadDashboard();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setData(null);
  }

  async function reviewLocation(id: string, decision: "approved" | "denied") {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/locations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Review failed");
      setMessage(
        decision === "approved"
          ? "Location approved and published."
          : "Location denied.",
      );
      await loadDashboard();
      if (decision === "approved") onLocationPublished();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  }

  async function resolveLocationRestocks(locationId: string) {
    setBusyId(locationId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/restocks/${locationId}`, {
        method: "PATCH",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Update failed");
      setMessage(
        `${body.resolved} restock request${body.resolved === 1 ? "" : "s"} marked resolved.`,
      );
      await loadDashboard();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  const displayedLocationStats = useMemo(() => {
    const locations =
      data?.locationStats.filter(
        (location) =>
          usageFilter === "all" || location.unresolved_restock_count > 0,
      ) ?? [];
    return [...locations].sort((a, b) => {
      if (usageSort === "used-desc") return b.used_count - a.used_count;
      if (usageSort === "used-asc") return a.used_count - b.used_count;
      if (usageSort === "restock-desc") {
        return b.total_restock_count - a.total_restock_count;
      }
      if (usageSort === "restock-asc") {
        return a.total_restock_count - b.total_restock_count;
      }
      return a.name.localeCompare(b.name);
    });
  }, [data?.locationStats, usageFilter, usageSort]);

  if (authenticated === null) {
    return <p className="px-4 py-6 text-muted-foreground">Checking access…</p>;
  }

  if (!authenticated) {
    return (
      <form
        onSubmit={login}
        className="mx-auto flex w-full max-w-sm flex-col gap-4 px-4 py-8"
      >
        <div>
          <h2 className="text-2xl font-semibold">Administrator access</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the administrator access code. Authentication is verified on
            the server.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password">Access code</Label>
          <Input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={256}
            className="h-12"
          />
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="h-12">
          Sign in
        </Button>
      </form>
    );
  }

  const unresolved =
    data?.unresolvedRestocks ?? [];
  const resolved =
    data?.restockReports.filter((report) => report.resolved_at) ?? [];
  const unresolvedRequestCount = unresolved.reduce(
    (sum, report) => sum + report.request_count,
    0,
  );
  const totalUsedReports =
    data?.locationStats.reduce((sum, location) => sum + location.used_count, 0) ??
    0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">Admin dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Review submissions and supply reports.
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          Sign out
        </Button>
      </div>

      {message ? (
        <Alert>
          <AlertTitle>Updated</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not complete that action</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="pending" className="gap-5">
        <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="pending" className="min-h-12 whitespace-normal">
            Pending locations
          </TabsTrigger>
          <TabsTrigger value="restock" className="min-h-12 whitespace-normal">
            Restock needed
          </TabsTrigger>
          <TabsTrigger value="used" className="min-h-12 whitespace-normal">
            Used/taken reports
          </TabsTrigger>
          <TabsTrigger value="history" className="min-h-12 whitespace-normal">
            Restock history
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-0">
          <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold">Pending locations</h3>
          <Badge variant="secondary">{data?.pending.length ?? 0}</Badge>
        </div>
        {!data?.pending.length ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No submissions are waiting for review.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.pending.map((location) => (
              <Card key={location.id}>
                <CardHeader>
                  <CardTitle>{location.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {location.image_urls[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayImageSrc(location.image_urls[0])}
                      alt={`Submitted photo of ${location.name}`}
                      className="aspect-video w-full rounded-lg border object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                      No photo submitted.
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {location.description}
                  </p>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="font-medium">Coordinates</dt>
                    <dd>
                      {location.latitude}, {location.longitude}
                    </dd>
                    <dt className="font-medium">Phone</dt>
                    <dd>{location.contact_phone}</dd>
                    <dt className="font-medium">Email</dt>
                    <dd className="break-all">{location.contact_email}</dd>
                    <dt className="font-medium">Supplies</dt>
                    <dd>
                      {location.has_naloxone ? "Naloxone" : ""}
                      {location.has_naloxone && location.has_fent_strips
                        ? ", "
                        : ""}
                      {location.has_fent_strips ? "Fentanyl test strips" : ""}
                    </dd>
                  </dl>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      disabled={busyId === location.id}
                      onClick={() => reviewLocation(location.id, "approved")}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={busyId === location.id}
                      onClick={() => reviewLocation(location.id, "denied")}
                    >
                      Deny
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </section>
        </TabsContent>

        <TabsContent value="restock" className="mt-0">
          <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold">Restock needed</h3>
          <Badge variant={unresolved.length ? "destructive" : "secondary"}>
            {unresolvedRequestCount} request
            {unresolvedRequestCount === 1 ? "" : "s"} across {unresolved.length}{" "}
            location{unresolved.length === 1 ? "" : "s"}
          </Badge>
        </div>
        {!unresolved.length ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No unresolved restock reports.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {unresolved.map((report) => (
              <Card
                key={report.location_id}
                className="border-destructive/50"
              >
                <CardContent className="space-y-3 pt-5">
                  <div>
                    <Badge variant="destructive">Unresolved</Badge>
                    <p className="mt-2 font-medium">{report.location_name}</p>
                    <p className="text-base font-semibold">
                      {report.request_count}{" "}
                      {report.request_count === 1 ? "person has" : "people have"}{" "}
                      requested restocking
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Latest request{" "}
                      {new Date(report.latest_report_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    disabled={busyId === report.location_id}
                    onClick={() =>
                      resolveLocationRestocks(report.location_id)
                    }
                  >
                    Mark all resolved
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
          </section>
        </TabsContent>

        <TabsContent value="used" className="mt-0">
          <section className="space-y-3">
        <div>
          <h3 className="text-xl font-semibold">Total Used/taken reports</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            One total counter plus the per-location breakdown.
          </p>
        </div>
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-5xl font-bold tabular-nums">{totalUsedReports}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Total Used/taken reports
            </p>
          </CardContent>
        </Card>
        <h4 className="text-lg font-semibold">Supply usage by location</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="usage-filter">Show locations</Label>
            <Select
              value={usageFilter}
              onValueChange={(value: "all" | "unresolved") =>
                setUsageFilter(value)
              }
            >
              <SelectTrigger id="usage-filter" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                <SelectItem value="unresolved">
                  Unresolved restocks only
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="usage-sort">Sort by</Label>
            <Select
              value={usageSort}
              onValueChange={(
                value:
                  | "name"
                  | "used-desc"
                  | "used-asc"
                  | "restock-desc"
                  | "restock-asc",
              ) => setUsageSort(value)}
            >
              <SelectTrigger id="usage-sort" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Location name</SelectItem>
                <SelectItem value="used-desc">Most used/taken</SelectItem>
                <SelectItem value="used-asc">Least used/taken</SelectItem>
                <SelectItem value="restock-desc">
                  Most total restocks
                </SelectItem>
                <SelectItem value="restock-asc">
                  Least total restocks
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3">Location</th>
                <th className="p-3">Used/taken reports</th>
                <th className="p-3">Unresolved restocks</th>
                <th className="p-3">Total restocks</th>
              </tr>
            </thead>
            <tbody>
              {displayedLocationStats.map((location) => (
                <tr key={location.id} className="border-t">
                  <td className="p-3 font-medium">{location.name}</td>
                  <td className="p-3">{location.used_count}</td>
                  <td className="p-3">{location.unresolved_restock_count}</td>
                  <td className="p-3">{location.total_restock_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </section>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <section className="space-y-3">
        <h3 className="text-xl font-semibold">Resolved restock history</h3>
        {!resolved.length ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No resolved reports yet.
          </p>
        ) : (
          <div className="space-y-2">
            {resolved.map((report) => (
              <div
                key={report.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div>
                  <Badge variant="outline">Resolved</Badge>
                  <p className="mt-1 font-medium">{report.location_name}</p>
                  <p className="text-muted-foreground">
                    Resolved {new Date(report.resolved_at!).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
