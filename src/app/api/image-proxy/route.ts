import { isAllowedImageHost } from "@/lib/image";
import { safeErrorResponse } from "@/lib/server/api";
import { enforceRateLimit } from "@/lib/server/security";

export const dynamic = "force-dynamic";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

async function fetchAllowedImage(initial: URL) {
  let target = initial;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!isAllowedImageHost(target)) throw new Error("Host not allowed");
    const response = await fetch(target, {
      headers: { Accept: "image/*", "User-Agent": "naloxone-locator/0.1" },
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    target = new URL(location, target);
  }
  throw new Error("Too many redirects");
}

export async function GET(request: Request) {
  try {
    await enforceRateLimit(request, "image-proxy", 120, 60 * 60);
  } catch (error) {
    return safeErrorResponse(error, "Image unavailable");
  }

  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) {
    return new Response("Missing url", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!isAllowedImageHost(target)) {
    return new Response("Host not allowed", { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetchAllowedImage(target);
  } catch {
    return new Response("Image unavailable", { status: 502 });
  }

  if (!upstream.ok) {
    return new Response("Image unavailable", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new Response("Not an image", { status: 502 });
  }

  const declaredSize = Number(upstream.headers.get("content-length") || 0);
  if (declaredSize > MAX_IMAGE_BYTES) {
    return new Response("Image too large", { status: 413 });
  }
  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_IMAGE_BYTES) {
    return new Response("Image too large", { status: 413 });
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
