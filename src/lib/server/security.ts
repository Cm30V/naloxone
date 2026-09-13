import "server-only";

import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";

export class TooManyRequestsError extends Error {}
export class ForbiddenRequestError extends Error {}

function securitySecret() {
  const secret =
    process.env.RATE_LIMIT_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Server security configuration is incomplete");
  }
  return secret;
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new ForbiddenRequestError("Invalid request origin");

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ForbiddenRequestError("Invalid request origin");
  }
  if (originHost !== host) {
    throw new ForbiddenRequestError("Invalid request origin");
  }
}

function clientAddress(request: Request) {
  return (
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

function privateKey(scope: string, value: string) {
  return createHmac("sha256", securitySecret())
    .update(`${scope}:${value}`)
    .digest("hex");
}

export function requestIdentity(request: Request, scope: string) {
  return privateKey(scope, clientAddress(request));
}

export function requestIdentityWithValue(
  request: Request,
  scope: string,
  value: string,
) {
  return privateKey(scope, `${clientAddress(request)}:${value}`);
}

async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
) {
  const db = getDb();
  const resetAt = new Date(Date.now() + windowSeconds * 1000);

  const [result] = await db
    .insert(rateLimits)
    .values({ key, count: 1, reset_at: resetAt })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.reset_at} <= NOW() THEN 1 ELSE ${rateLimits.count} + 1 END`,
        reset_at: sql`CASE WHEN ${rateLimits.reset_at} <= NOW() THEN ${resetAt} ELSE ${rateLimits.reset_at} END`,
      },
    })
    .returning({ count: rateLimits.count });

  if (result.count > limit) {
    throw new TooManyRequestsError("Too many requests. Please try again later.");
  }
}

export async function enforceRateLimit(
  request: Request,
  scope: string,
  limit: number,
  windowSeconds: number,
) {
  return consumeRateLimit(
    `${scope}:${requestIdentity(request, scope)}`,
    limit,
    windowSeconds,
  );
}

export async function enforceValueRateLimit(
  scope: string,
  value: string,
  limit: number,
  windowSeconds: number,
) {
  return consumeRateLimit(
    `${scope}:${privateKey(scope, value.trim().toLowerCase())}`,
    limit,
    windowSeconds,
  );
}
