import { API_BASE_URL } from '../config';

// Backend origin without the trailing /api — where /uploads is served from.
export const MEDIA_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, '');

/**
 * Make an image URL loadable on a real device.
 *  - relative paths ("/uploads/x.jpg")  -> prefixed with the backend origin
 *  - localhost / 127.0.0.1 absolute URLs -> host swapped to the reachable dev host
 *    (the web app saves these in dev, and "localhost" on a phone is the phone itself)
 *  - data: URIs and good https URLs      -> returned unchanged
 */
export function img(url) {
  if (!url || typeof url !== 'string') return undefined;
  const u = url.trim();
  if (!u) return undefined;
  if (u.startsWith('data:')) return u;
  if (u.startsWith('/')) return MEDIA_BASE_URL + u;
  if (u.includes('localhost') || u.includes('127.0.0.1')) {
    return u.replace(/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i, MEDIA_BASE_URL);
  }
  return u;
}
