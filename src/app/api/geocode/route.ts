import { NextResponse } from "next/server";
import { safeErrorResponse } from "@/lib/server/api";
import { enforceRateLimit } from "@/lib/server/security";
import { InputError } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "geocode", 30, 60 * 60);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim();
    if (!q) throw new InputError("Enter an address or ZIP code");
    if (q.length > 120) throw new InputError("Address is too long");

    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", `${q}, Georgia, USA`);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");
    url.searchParams.set("countrycodes", "us");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "georgia-naloxone-locator-prototype/0.1 (research)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
    }

    const results = (await response.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    const first = results[0];
    if (!first) {
      return NextResponse.json(
        { error: "No match found. Try a Georgia ZIP or city name." },
        { status: 404 },
      );
    }

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < 30.2 ||
      latitude > 35.2 ||
      longitude < -85.7 ||
      longitude > -80.6
    ) {
      return NextResponse.json(
        { error: "No Georgia match found. Try another address." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      latitude,
      longitude,
      label: first.display_name,
    });
  } catch (error) {
    return safeErrorResponse(error, "Unable to look up that location");
  }
}
