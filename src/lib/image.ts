const ALLOWED_HOSTS = new Set([
  "mymaps.usercontent.google.com",
  "maps.googleapis.com",
]);

export function isGoogleHostedImage(url: string) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (ALLOWED_HOSTS.has(parsed.hostname) ||
        parsed.hostname.endsWith(".googleusercontent.com"))
    );
  } catch {
    return false;
  }
}

export function isAllowedImageHost(url: URL) {
  return (
    url.protocol === "https:" &&
    (ALLOWED_HOSTS.has(url.hostname) ||
      url.hostname.endsWith(".googleusercontent.com"))
  );
}

export function displayImageSrc(url: string) {
  if (isGoogleHostedImage(url)) {
    const resized = new URL(url);
    resized.searchParams.set("fife", "s1200");
    return `/api/image-proxy?url=${encodeURIComponent(resized.toString())}`;
  }
  return url;
}
