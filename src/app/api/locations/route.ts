import { put } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { locations } from "@/db/schema";
import { listApprovedLocations } from "@/lib/locations";
import { safeErrorResponse } from "@/lib/server/api";
import {
  assertSameOrigin,
  enforceRateLimit,
} from "@/lib/server/security";
import {
  georgiaCoordinate,
  InputError,
  requiredText,
  validEmail,
  validIdempotencyKey,
  validPhone,
  yesNoBoolean,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

const MAX_IMAGES = 1;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

async function hasValidImageSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const header = new TextDecoder().decode(bytes);
  const isGif = header.startsWith("GIF87a") || header.startsWith("GIF89a");
  const isWebp = header.startsWith("RIFF") && header.slice(8, 12) === "WEBP";
  return isJpeg || isPng || isGif || isWebp;
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
    assertSameOrigin(request);
    await enforceRateLimit(request, "location-submission", 3, 24 * 60 * 60);

    const form = await request.formData();
    const name = requiredText(form.get("name"), "Name", 160);
    const description = requiredText(
      form.get("description"),
      "Description",
      1500,
    );
    const latitude = georgiaCoordinate(form.get("latitude"), "latitude");
    const longitude = georgiaCoordinate(form.get("longitude"), "longitude");
    const is_24_7 = yesNoBoolean(form.get("is_24_7"), "Open 24/7");
    const has_naloxone = yesNoBoolean(form.get("has_naloxone"), "Has naloxone");
    const has_fent_strips = yesNoBoolean(
      form.get("has_fent_strips"),
      "Has fentanyl test strips",
    );
    const type = requiredText(form.get("type"), "Type", 40);
    if (type !== "V") throw new InputError("Invalid location type");
    const contact_phone = validPhone(form.get("contact_phone"));
    const contact_email = validEmail(form.get("contact_email"));
    const submission_key = validIdempotencyKey(form.get("submission_key"));

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
      if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
        return NextResponse.json(
          { error: "Use a JPEG, PNG, WebP, or GIF image" },
          { status: 400 },
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: "Each image must be under 5MB" },
          { status: 400 },
        );
      }
      if (!(await hasValidImageSignature(file))) {
        return NextResponse.json(
          { error: "The selected file is not a valid image" },
          { status: 400 },
        );
      }
    }

    const db = getDb();
    const [existing] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.submission_key, submission_key))
      .limit(1);
    if (existing) {
      return NextResponse.json({ success: true, duplicate: true });
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

    await db
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
        status: "pending",
        contact_phone,
        contact_email,
        submission_key,
      })
      .onConflictDoNothing({ target: locations.submission_key });

    return NextResponse.json(
      { success: true },
      { status: 201 },
    );
  } catch (error) {
    return safeErrorResponse(error, "Unable to submit location");
  }
}
