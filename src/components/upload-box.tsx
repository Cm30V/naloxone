"use client";

import { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Location } from "@/lib/types";

const MAX_IMAGES = 1;
const MAX_BYTES = 5 * 1024 * 1024;

type Props = {
  locations: Location[];
  onCreated: (location: Location) => void;
};

function YesNo({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      <RadioGroup
        value={value}
        onValueChange={onChange}
        className="grid grid-cols-2 gap-2"
      >
        <Label
          htmlFor={`${id}-yes`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-base"
        >
          <RadioGroupItem id={`${id}-yes`} value="yes" />
          Yes
        </Label>
        <Label
          htmlFor={`${id}-no`}
          className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-base"
        >
          <RadioGroupItem id={`${id}-no`} value="no" />
          No
        </Label>
      </RadioGroup>
    </fieldset>
  );
}

export function UploadBox({ locations, onCreated }: Props) {
  const types = useMemo(() => {
    const fromData = Array.from(new Set(locations.map((l) => l.type).filter(Boolean)));
    return fromData.length ? fromData : ["V"];
  }, [locations]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [is247, setIs247] = useState("yes");
  const [hasNaloxone, setHasNaloxone] = useState("yes");
  const [hasStrips, setHasStrips] = useState("no");
  const [type, setType] = useState(types[0] ?? "V");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function onFiles(list: FileList | null) {
    const next = Array.from(list ?? []);
    if (next.length > MAX_IMAGES) {
      setStatus("error");
      setMessage("Choose only 1 image.");
      return;
    }
    const oversized = next.find((f) => f.size > MAX_BYTES);
    if (oversized) {
      setStatus("error");
      setMessage("Each image must be under 5MB.");
      return;
    }
    setFiles(next);
    setStatus("idle");
    setMessage(null);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("error");
      setMessage("Geolocation is not available in this browser.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(pos.coords.latitude));
        setLongitude(String(pos.coords.longitude));
        setLocating(false);
      },
      () => {
        setLocating(false);
        setStatus("error");
        setMessage("Could not read your location. Enter coordinates manually.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage(null);
    try {
      const form = new FormData();
      form.set("name", name);
      form.set("description", description);
      form.set("latitude", latitude);
      form.set("longitude", longitude);
      form.set("is_24_7", is247);
      form.set("has_naloxone", hasNaloxone);
      form.set("has_fent_strips", hasStrips);
      form.set("type", type);
      for (const file of files) form.append("images", file);

      const res = await fetch("/api/locations", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");

      onCreated(data.location as Location);
      setStatus("success");
      setMessage("Saved. This box is live in Find a Distribution Box.");
      setName("");
      setDescription("");
      setLatitude("");
      setLongitude("");
      setFiles([]);
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Submit failed");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto flex w-full max-w-xl flex-col gap-5 px-4 py-6 pb-10"
    >
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Add a distribution box
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          Share a naloxone or fentanyl test strip box so others can find it.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-12 text-base"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-28 text-base"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="latitude">Latitude</Label>
          <Input
            id="latitude"
            required
            inputMode="decimal"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="longitude">Longitude</Label>
          <Input
            id="longitude"
            required
            inputMode="decimal"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            className="h-12 text-base"
          />
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="h-12 w-full"
        onClick={useCurrentLocation}
        disabled={locating}
      >
        {locating ? "Getting location…" : "Use my current location"}
      </Button>

      <YesNo id="247" label="Open 24/7?" value={is247} onChange={setIs247} />
      <YesNo
        id="naloxone"
        label="Has naloxone?"
        value={hasNaloxone}
        onChange={setHasNaloxone}
      />
      <YesNo
        id="strips"
        label="Has fentanyl test strips?"
        value={hasStrips}
        onChange={setHasStrips}
      />

      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger id="type" className="h-12 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "V" ? "V — vending / distribution box" : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="images">Photo (1 image, 5MB max)</Label>
        <Input
          id="images"
          type="file"
          accept="image/*"
          className="h-12 py-2 text-base"
          onChange={(e) => onFiles(e.target.files)}
        />
        {files.length ? (
          <p className="text-sm text-muted-foreground">
            {files.length} file{files.length === 1 ? "" : "s"} selected
          </p>
        ) : null}
      </div>

      {message ? (
        <Alert variant={status === "error" ? "destructive" : "default"}>
          <AlertTitle>
            {status === "success" ? "Submitted" : "Could not submit"}
          </AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-14 text-base" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Submit box"}
      </Button>
    </form>
  );
}
