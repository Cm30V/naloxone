import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.STORAGE_DATABASE_URL ||
  process.env.STORAGE_POSTGRES_URL;

if (!databaseUrl) throw new Error("DATABASE_URL is not set");

const sql = neon(databaseUrl);

async function main() {
  await sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS contact_phone text`;
  await sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS contact_email text`;
  await sql`ALTER TABLE locations ADD COLUMN IF NOT EXISTS submission_key text`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS locations_submission_key_unique ON locations (submission_key)`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS locations_active_name_unique
    ON locations (lower(trim(name)))
    WHERE status IN ('approved', 'pending')
  `;

  await sql`
  CREATE TABLE IF NOT EXISTS supply_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id uuid NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    report_type text NOT NULL,
    reporter_key text NOT NULL,
    reporting_day date NOT NULL DEFAULT CURRENT_DATE,
    idempotency_key text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz
  )
`;
  await sql`DROP INDEX IF EXISTS supply_report_daily_unique`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS supply_report_open_restock_unique
    ON supply_reports (location_id, reporter_key)
    WHERE report_type = 'restock' AND resolved_at IS NULL
  `;
  await sql`
  CREATE INDEX IF NOT EXISTS supply_report_location_idx
  ON supply_reports (location_id)
`;
  await sql`
  CREATE INDEX IF NOT EXISTS supply_report_unresolved_idx
  ON supply_reports (report_type, resolved_at)
`;

  await sql`
  CREATE TABLE IF NOT EXISTS rate_limits (
    key text PRIMARY KEY,
    count integer NOT NULL DEFAULT 1,
    reset_at timestamptz NOT NULL
  )
`;

  console.log("Admin and supply-report schema is ready.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
