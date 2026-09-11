import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { locations } from "@/db/schema";
import { listApprovedLocations, toLocation } from "@/lib/locations";

export const dynamic = "force-dynamic";

const MAX_IMAGES = 3;
const MAX_BYTES = 5 * 1024 * 1024;

function parseYesNo(value: FormDataEntryValue | null, field: string) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "yes" || raw === "true") return true;
  if (raw === "no" || raw === "false") return false;
  throw new Error(`${field} must be Yes or No`);
}

function parseRequiredString(value: FormDataEntryValue | null, field: string) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error(`${field} is required`);
  return raw;
}

function parseCoord(value: FormDataEntryValue | null, field: string) {
  const n = Number(String(value ?? "").trim());
  if (!Number.isFinite(n)) throw new Error(`${field} must be a number`);
  return n;
}

export async function GET() {
  try {
    const data = await listApprovedLocations();
    return NextResponse.json({ locations: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load locations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const name = parseRequiredString(form.get("name"), "name");
    const description = parseRequiredString(
      form.get("description"),
      "description",
    );
    const latitude = parseCoord(form.get("latitude"), "latitude");
    const longitude = parseCoord(form.get("longitude"), "longitude");
    const is_24_7 = parseYesNo(form.get("is_24_7"), "is_24_7");
    const has_naloxone = parseYesNo(form.get("has_naloxone"), "has_naloxone");
    const has_fent_strips = parseYesNo(
      form.get("has_fent_strips"),
      "has_fent_strips",
    );
    const type = parseRequiredString(form.get("type"), "type");

    const files = form
      .getAll("images")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (files.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Upload at most ${MAX_IMAGES} images` },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        return NextResponse.json(
          { error: "Only image files are allowed" },
          { status: 400 },
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: "Each image must be under 5MB" },
          { status: 400 },
        );
      }
    }

    const image_urls: string[] = [];
    for (const [index, file] of files.entries()) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const blob = await put(
        `locations/${Date.now()}-${index}-${safeName}`,
        file,
        { access: "public", addRandomSuffix: true },
      );
      image_urls.push(blob.url);
    }

    const db = getDb();
    const [inserted] = await db
      .insert(locations)
      .values({
        name,
        description,
        latitude,
        longitude,
        is_24_7,
        has_naloxone,
        has_fent_strips,
        type,
        image_urls,
        status: "approved",
      })
      .returning();

    return NextResponse.json(
      { location: toLocation(inserted) },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save location";
    const status =
      message.includes("required") || message.includes("must") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
