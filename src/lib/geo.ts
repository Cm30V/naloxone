const EARTH_RADIUS_KM = 6371;

function toRad(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(km: number) {
  const miles = km * 0.621371;
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

export function isAppleMapsPlatform(userAgent: string) {
  return /iPad|iPhone|iPod/.test(userAgent) ||
    (userAgent.includes("Macintosh") &&
      typeof navigator !== "undefined" &&
      navigator.maxTouchPoints > 1);
}

export function mapsDirectionsUrl(lat: number, lng: number, userAgent: string) {
  if (isAppleMapsPlatform(userAgent)) {
    return `https://maps.apple.com/?daddr=${lat},${lng}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
