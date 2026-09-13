import "server-only";

import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/server/admin-auth";
import {
  ForbiddenRequestError,
  TooManyRequestsError,
} from "@/lib/server/security";
import { InputError } from "@/lib/validation";

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function safeErrorResponse(error: unknown, fallback: string) {
  if (error instanceof InputError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof TooManyRequestsError) {
    return NextResponse.json(
      { error: error.message },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }
  if (error instanceof ForbiddenRequestError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  console.error(fallback, error instanceof Error ? error.message : error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
