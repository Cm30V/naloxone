import { NextResponse } from "next/server";
import { deleteAdminSession } from "@/lib/server/admin-auth";
import { safeErrorResponse } from "@/lib/server/api";
import { assertSameOrigin } from "@/lib/server/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await deleteAdminSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return safeErrorResponse(error, "Unable to sign out");
  }
}
