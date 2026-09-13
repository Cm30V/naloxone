import { NextResponse } from "next/server";
import {
  createAdminSession,
  verifyAdminPassword,
} from "@/lib/server/admin-auth";
import { safeErrorResponse } from "@/lib/server/api";
import {
  assertSameOrigin,
  enforceRateLimit,
} from "@/lib/server/security";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "admin-login", 5, 15 * 60);

    const body = (await request.json()) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (!verifyAdminPassword(password)) {
      return NextResponse.json(
        { error: "Invalid access code" },
        { status: 401 },
      );
    }

    await createAdminSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    return safeErrorResponse(error, "Unable to sign in");
  }
}
