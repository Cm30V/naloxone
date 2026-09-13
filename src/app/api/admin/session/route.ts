import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/server/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    authenticated: await isAdminAuthenticated(),
  });
}
