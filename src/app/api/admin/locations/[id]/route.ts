import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { locations } from "@/db/schema";
import { requireAdmin, safeErrorResponse } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/security";
import { InputError, validUuid } from "@/lib/validation";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/admin/locations/[id]">,
) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

  try {
    assertSameOrigin(request);
    const { id: rawId } = await context.params;
    const id = validUuid(rawId, "location id");
    const body = (await request.json()) as { decision?: unknown };
    if (body.decision !== "approved" && body.decision !== "denied") {
      throw new InputError("Decision must be approved or denied");
    }

    const db = getDb();
    const [updated] = await db
      .update(locations)
      .set({ status: body.decision })
      .where(and(eq(locations.id, id), eq(locations.status, "pending")))
      .returning({ id: locations.id });

    if (!updated) {
      return NextResponse.json(
        { error: "Pending submission not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return safeErrorResponse(error, "Unable to review submission");
  }
}
