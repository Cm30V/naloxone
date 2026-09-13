"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type DashboardData = {
  pending: PendingLocation[];
  locationStats: LocationStat[];
  restockReports: RestockReport[];
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

  async function setReportResolved(id: string, resolved: boolean) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolved }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Update failed");
      await loadDashboard();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

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
    data?.restockReports.filter((report) => !report.resolved_at) ?? [];
  const resolved =
    data?.restockReports.filter((report) => report.resolved_at) ?? [];

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

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xl font-semibold">Restock needed</h3>
          <Badge variant={unresolved.length ? "destructive" : "secondary"}>
            {unresolved.length} unresolved
          </Badge>
        </div>
        {!unresolved.length ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No unresolved restock reports.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {unresolved.map((report) => (
              <Card key={report.id} className="border-destructive/50">
                <CardContent className="space-y-3 pt-5">
                  <div>
                    <Badge variant="destructive">Unresolved</Badge>
                    <p className="mt-2 font-medium">{report.location_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Reported {new Date(report.created_at).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    disabled={busyId === report.id}
                    onClick={() => setReportResolved(report.id, true)}
                  >
                    Mark resolved
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-xl font-semibold">Supply usage by location</h3>
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
              {data?.locationStats.map((location) => (
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
                <Button
                  variant="outline"
                  disabled={busyId === report.id}
                  onClick={() => setReportResolved(report.id, false)}
                >
                  Reopen
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
