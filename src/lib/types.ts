export type Location = {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  is_24_7: boolean;
  has_naloxone: boolean;
  has_fent_strips: boolean;
  type: string;
  image_urls: string[];
  status: string;
};

export type RankedLocation = Location & {
  distanceKm: number;
};
