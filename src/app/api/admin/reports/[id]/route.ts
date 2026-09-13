import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { supplyReports } from "@/db/schema";
import { requireAdmin, safeErrorResponse } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/security";
import { InputError, validUuid } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/reports/[id]">,
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    assertSameOrigin(request);
    const { id: rawId } = await context.params;
    const id = validUuid(rawId, "report id");
    const body = (await request.json()) as { resolved?: unknown };
    if (typeof body.resolved !== "boolean") {
      throw new InputError("resolved must be a boolean");
    }

    const db = getDb();
    const [updated] = await db
      .update(supplyReports)
      .set({ resolved_at: body.resolved ? new Date() : null })
      .where(
        and(
          eq(supplyReports.id, id),
          eq(supplyReports.report_type, "restock"),
        ),
      )
      .returning({ id: supplyReports.id });

    if (!updated) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return safeErrorResponse(error, "Unable to update report");
  }
}
