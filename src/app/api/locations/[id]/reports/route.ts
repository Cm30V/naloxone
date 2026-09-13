import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { locations, supplyReports } from "@/db/schema";
import { safeErrorResponse } from "@/lib/server/api";
import {
  assertSameOrigin,
  enforceRateLimit,
  requestIdentity,
} from "@/lib/server/security";
import {
  InputError,
  validIdempotencyKey,
  validUuid,
} from "@/lib/validation";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

export async function POST(
  request: Request,
  context: RouteContext<"/api/locations/[id]/reports">,
) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "supply-report", 8, 60 * 60);

    const { id: rawId } = await context.params;
    const locationId = validUuid(rawId, "location id");
    const body = (await request.json()) as {
      type?: unknown;
      idempotencyKey?: unknown;
    };
    if (body.type !== "used" && body.type !== "restock") {
      throw new InputError("Choose a valid report type");
    }
    const idempotencyKey = validIdempotencyKey(body.idempotencyKey);

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

    let duplicate = false;
    try {
      await db.insert(supplyReports).values({
        location_id: locationId,
        report_type: body.type,
        reporter_key: requestIdentity(
          request,
          `supply-daily:${locationId}:${body.type}`,
        ),
        idempotency_key: idempotencyKey,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      duplicate = true;
    }

    return NextResponse.json({ success: true, duplicate });
  } catch (error) {
    return safeErrorResponse(error, "Unable to submit supply report");
  }
}
