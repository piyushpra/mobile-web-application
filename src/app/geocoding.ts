import { APP_CURRENT_VERSION, SUPPORT_EMAIL } from './constants';

// Nominatim rejects the default okhttp User-Agent with 403; its usage policy requires an app identifier.
export const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': `FuElectric/${APP_CURRENT_VERSION} (${SUPPORT_EMAIL})`,
};

const REVERSE_GEOCODE_TIMEOUT_MS = 8000;

export type ReverseGeocodeResult = {
  area: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
};

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REVERSE_GEOCODE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(
        String(lat),
      )}&lon=${encodeURIComponent(String(lng))}`,
      { headers: NOMINATIM_HEADERS, signal: controller.signal },
    );
    if (!res.ok) {
      throw new Error(`Reverse geocoding failed (${res.status})`);
    }
    const json = await res.json();
    const addr = json?.address || {};
    return {
      area: String(addr.suburb || addr.neighbourhood || addr.quarter || addr.road || addr.hamlet || '').trim(),
      city: String(addr.city || addr.town || addr.village || addr.county || '').trim(),
      state: String(addr.state || '').trim(),
      country: String(addr.country || 'India').trim(),
      pincode: String(addr.postcode || '').trim(),
    };
  } finally {
    clearTimeout(timer);
  }
}
