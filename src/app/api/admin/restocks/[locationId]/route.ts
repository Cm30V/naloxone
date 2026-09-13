import { and, eq, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { supplyReports } from "@/db/schema";
import { requireAdmin, safeErrorResponse } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/security";
import { validUuid } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/restocks/[locationId]">,
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    assertSameOrigin(request);
    const { locationId: rawLocationId } = await context.params;
    const locationId = validUuid(rawLocationId, "location id");

    const resolved = await getDb()
      .update(supplyReports)
      .set({ resolved_at: new Date() })
      .where(
        and(
          eq(supplyReports.location_id, locationId),
          eq(supplyReports.report_type, "restock"),
          isNull(supplyReports.resolved_at),
        ),
      )
      .returning({ id: supplyReports.id });

    if (!resolved.length) {
      return NextResponse.json(
        { error: "No unresolved restock reports found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, resolved: resolved.length });
  } catch (error) {
    return safeErrorResponse(error, "Unable to resolve restock reports");
  }
}
