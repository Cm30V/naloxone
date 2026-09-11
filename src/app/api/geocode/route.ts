import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "Enter an address or ZIP code" }, { status: 400 });
  }

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
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Geocoding failed" }, { status: 502 });
  }

  const results = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  const first = results[0];
  if (!first) {
    return NextResponse.json(
      { error: "No match found. Try a Georgia ZIP or city name." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    label: first.display_name,
  });
}
