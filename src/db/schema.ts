import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const locations = pgTable("locations", {
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
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type LocationRow = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
