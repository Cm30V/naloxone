import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { locations, supplyReports } from "@/db/schema";
import { safeErrorResponse } from "@/lib/server/api";
import {
  assertSameOrigin,
  enforceRateLimit,
  requestIdentityWithValue,
} from "@/lib/server/security";
import {
  InputError,
  validIdempotencyKey,
  validUuid,
} from "@/lib/validation";

export async function POST(
  request: Request,
  context: RouteContext<"/api/locations/[id]/reports">,
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "supply-report", 100, 60 * 60);

    const { id: rawId } = await context.params;
    const locationId = validUuid(rawId, "location id");
    const body = (await request.json()) as {
      type?: unknown;
      idempotencyKey?: unknown;
      reporterKey?: unknown;
    };
    if (body.type !== "used" && body.type !== "restock") {
      throw new InputError("Choose a valid report type");
    }
    const idempotencyKey = validIdempotencyKey(body.idempotencyKey);
    const clientReporterKey = validIdempotencyKey(body.reporterKey);

    const db = getDb();
    const [location] = await db
      .select({ id: locations.id })
      .from(locations)
      .where(
        and(eq(locations.id, locationId), eq(locations.status, "approved")),
      )
      .limit(1);
    if (!location) {
      return NextResponse.json({ error: "Location not found" }, { status: 404 });
    }

    const reporter = requestIdentityWithValue(
      request,
      "supply-reporter",
      clientReporterKey,
    );
    const insertReport = (type: "used" | "restock", key: string) =>
      db
        .insert(supplyReports)
        .values({
        location_id: locationId,
          report_type: type,
          reporter_key: reporter,
          idempotency_key: key,
        })
        .onConflictDoNothing()
        .returning({ id: supplyReports.id });

    let insertedCount = 0;
    if (body.type === "used") {
      const used = await insertReport("used", idempotencyKey);
      const restock = await insertReport("restock", `${idempotencyKey}-restock`);
      insertedCount = used.length + restock.length;
    } else {
      const restock = await insertReport("restock", idempotencyKey);
      insertedCount = restock.length;
    }

    return NextResponse.json({
      success: true,
      duplicate: insertedCount === 0,
    });
  } catch (error) {
    return safeErrorResponse(error, "Unable to submit supply report");
  }
}
