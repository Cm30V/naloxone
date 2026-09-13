"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Props = {
  locationId: string;
  locationName: string;
};

const REPORTER_STORAGE_KEY = "naloxone-supply-reporter-id";

function getReporterKey() {
  try {
    const existing = window.localStorage.getItem(REPORTER_STORAGE_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    window.localStorage.setItem(REPORTER_STORAGE_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function SupplyReportDialog({ locationId, locationName }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setStatus("idle");
      setMessage("");
      setIdempotencyKey(crypto.randomUUID());
    }
  }

  async function submit(type: "used" | "restock") {
    if (status === "submitting" || !idempotencyKey) return;
    setStatus("submitting");
    setMessage("");
    try {
      const response = await fetch(`/api/locations/${locationId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          idempotencyKey,
          reporterKey: getReporterKey(),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        duplicate?: boolean;
      };
      if (!response.ok) throw new Error(data.error || "Report failed");
      setStatus("success");
      setMessage(
        data.duplicate
          ? "This location already has your active restock request. Thank you."
          : type === "used"
            ? "Usage recorded. This location was also added to the restock list."
            : "Restock request received. Thank you for helping keep this location accurate.",
      );
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Unable to send the report",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-14 w-full text-base">
          Report Supplies Used / Restock Needed
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby="supply-report-description">
        <DialogHeader>
          <DialogTitle>Report supplies</DialogTitle>
          <DialogDescription id="supply-report-description">
            {locationName}
          </DialogDescription>
        </DialogHeader>

        {status === "success" ? (
          <div
            role="status"
            className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm"
          >
            {message}
          </div>
        ) : (
          <div className="grid gap-3">
            <Button
              type="button"
              className="h-12"
              disabled={status === "submitting"}
              onClick={() => submit("used")}
            >
              I used/took supplies
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="h-12"
              disabled={status === "submitting"}
              onClick={() => submit("restock")}
            >
              Supplies need restocking
            </Button>
            {status === "error" ? (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
