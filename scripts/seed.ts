import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { getDb } from "../src/db";
import { locations } from "../src/db/schema";

type CsvRow = {
  name: string;
  description: string;
  latitude: string;
  longitude: string;
  "24/7": string;
  naloxone: string;
  fent_strips: string;
  type: string;
  image_url: string;
};

function parseBool(value: string) {
  return value.trim().toUpperCase() === "TRUE";
}

function parseImageUrls(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "none") return [];
  return [trimmed];
}

async function main() {
  const csvPath = resolve(process.cwd(), "georgia_naloxone_access_points.csv");
  const raw = readFileSync(csvPath, "utf8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[];

  const db = getDb();
  const existing = await db.select({ id: locations.id }).from(locations);
  if (existing.length > 0) {
    console.log(
      `Skipping seed: ${existing.length} location(s) already in the database.`,
    );
    return;
  }

  const records = rows.map((row) => ({
    name: row.name,
    description: row.description,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    is_24_7: parseBool(row["24/7"]),
    has_naloxone: parseBool(row.naloxone),
    has_fent_strips: parseBool(row.fent_strips),
    type: row.type || "V",
    image_urls: parseImageUrls(row.image_url),
    status: "approved" as const,
  }));

  const invalid = records.filter(
    (r) => !r.name || Number.isNaN(r.latitude) || Number.isNaN(r.longitude),
  );
  if (invalid.length) {
    throw new Error(`CSV has ${invalid.length} invalid row(s).`);
  }

  await db.insert(locations).values(records);
  console.log(`Seeded ${records.length} approved locations from CSV.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
