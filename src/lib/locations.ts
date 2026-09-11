import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { locations, type LocationRow } from "@/db/schema";
import type { Location } from "@/lib/types";

export function toLocation(row: LocationRow): Location {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    is_24_7: row.is_24_7,
    has_naloxone: row.has_naloxone,
    has_fent_strips: row.has_fent_strips,
    type: row.type,
    image_urls: row.image_urls ?? [],
    status: row.status,
  };
}

export async function listApprovedLocations() {
  const db = getDb();
  const rows = await db
    .select()
    .from(locations)
    .where(eq(locations.status, "approved"));
  return rows.map(toLocation);
}
