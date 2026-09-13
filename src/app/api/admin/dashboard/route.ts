import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { locations, supplyReports } from "@/db/schema";
import { requireAdmin, safeErrorResponse } from "@/lib/server/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    const db = getDb();
    const pendingQuery = db
      .select({
        id: locations.id,
        name: locations.name,
        description: locations.description,
        latitude: locations.latitude,
        longitude: locations.longitude,
        is_24_7: locations.is_24_7,
        has_naloxone: locations.has_naloxone,
        has_fent_strips: locations.has_fent_strips,
        type: locations.type,
        image_urls: locations.image_urls,
        contact_phone: locations.contact_phone,
        contact_email: locations.contact_email,
        created_at: locations.created_at,
      })
      .from(locations)
      .where(eq(locations.status, "pending"))
      .orderBy(desc(locations.created_at));

    const locationStatsQuery = db
      .select({
        id: locations.id,
        name: locations.name,
        used_count: sql<number>`count(*) filter (where ${supplyReports.report_type} = 'used')::int`,
        unresolved_restock_count: sql<number>`count(*) filter (where ${supplyReports.report_type} = 'restock' and ${supplyReports.resolved_at} is null)::int`,
        total_restock_count: sql<number>`count(*) filter (where ${supplyReports.report_type} = 'restock')::int`,
      })
      .from(locations)
      .leftJoin(supplyReports, eq(supplyReports.location_id, locations.id))
      .where(eq(locations.status, "approved"))
      .groupBy(locations.id, locations.name)
      .orderBy(desc(sql`count(*) filter (where ${supplyReports.report_type} = 'restock' and ${supplyReports.resolved_at} is null)`), locations.name);

    const restockReportsQuery = db
      .select({
        id: supplyReports.id,
        location_id: supplyReports.location_id,
        location_name: locations.name,
        created_at: supplyReports.created_at,
        resolved_at: supplyReports.resolved_at,
      })
      .from(supplyReports)
      .innerJoin(locations, eq(locations.id, supplyReports.location_id))
      .where(eq(supplyReports.report_type, "restock"))
      .orderBy(
        sql`${supplyReports.resolved_at} is null desc`,
        desc(supplyReports.created_at),
      );

    const [pending, locationStats, restockReports] = await Promise.all([
      pendingQuery,
      locationStatsQuery,
      restockReportsQuery,
    ]);

    return NextResponse.json({
      pending,
      locationStats,
      restockReports,
    });
  } catch (error) {
    return safeErrorResponse(error, "Unable to load admin dashboard");
  }
}
