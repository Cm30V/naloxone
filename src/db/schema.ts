import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    is_24_7: boolean("is_24_7").notNull(),
    has_naloxone: boolean("has_naloxone").notNull(),
    has_fent_strips: boolean("has_fent_strips").notNull(),
    type: text("type").notNull().default("V"),
    image_urls: text("image_urls").array().notNull().default(sql`'{}'`),
    status: text("status").notNull().default("approved"),
    contact_phone: text("contact_phone"),
    contact_email: text("contact_email"),
    submission_key: text("submission_key").unique(),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("locations_active_name_unique")
      .on(sql`lower(trim(${table.name}))`)
      .where(sql`${table.status} in ('approved', 'pending')`),
  ],
);

export const supplyReports = pgTable(
  "supply_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    location_id: uuid("location_id")
      .notNull()
      .references(() => locations.id, { onDelete: "cascade" }),
    report_type: text("report_type").notNull(),
    reporter_key: text("reporter_key").notNull(),
    reporting_day: date("reporting_day").notNull().default(sql`CURRENT_DATE`),
    idempotency_key: text("idempotency_key").notNull().unique(),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolved_at: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("supply_report_open_restock_unique")
      .on(table.location_id, table.reporter_key)
      .where(
        sql`${table.report_type} = 'restock' and ${table.resolved_at} is null`,
      ),
    index("supply_report_location_idx").on(table.location_id),
    index("supply_report_unresolved_idx").on(
      table.report_type,
      table.resolved_at,
    ),
  ],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(1),
  reset_at: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export type LocationRow = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type SupplyReportRow = typeof supplyReports.$inferSelect;
