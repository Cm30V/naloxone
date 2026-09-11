import { isAllowedImageHost } from "@/lib/image";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const upstream = await fetch(target, {
    headers: { Accept: "image/*", "User-Agent": "naloxone-locator/0.1" },
    redirect: "follow",
  });

  if (!upstream.ok) {
    return new Response("Image unavailable", { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return new Response("Not an image", { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
