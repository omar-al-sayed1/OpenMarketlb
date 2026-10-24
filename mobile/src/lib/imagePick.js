import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Pick images and shrink them BEFORE upload.
 *
 * The API re-encodes every image down to 1200px / quality 80 (see backend
 * upload_file), so sending a full-resolution phone photo spends seconds on the
 * wire only for the server to throw ~90% of it away. Matching that cap here is
 * the whole upload cost: a 12MP photo goes from ~4MB to ~200KB.
 */
const MAX_DIM = 1200; // keep in sync with backend upload_file

/** Resize + compress one picked asset. Returns an asset-shaped object. */
export async function compressAsset(asset) {
  if (!asset?.uri) return asset;
  // PNGs may carry transparency (logos) — re-encoding those to JPEG would fill it
  // with black, and the backend picks its format from the filename extension.
  const isPng = asset.mimeType === 'image/png' || /\.png(\?|$)/i.test(asset.uri);
  const ext = isPng ? 'png' : 'jpg';
  try {
    const longest = Math.max(asset.width || 0, asset.height || 0);
    const actions = longest > MAX_DIM
      ? [{ resize: (asset.width || 0) >= (asset.height || 0) ? { width: MAX_DIM } : { height: MAX_DIM } }]
      : [];
    const out = await manipulateAsync(asset.uri, actions, {
      compress: 0.8, // ignored for PNG, which is lossless
      format: isPng ? SaveFormat.PNG : SaveFormat.JPEG,
    });
    return {
      ...asset,
      uri: out.uri,
      width: out.width,
      height: out.height,
      mimeType: isPng ? 'image/png' : 'image/jpeg',
      // uploadFile() reads `.name`; the server only cares about the extension.
      name: `upload.${ext}`,
      fileName: asset.fileName || `upload.${ext}`,
    };
  } catch (_) {
    return asset; // never block an upload just because compression failed
  }
}

/**
 * Drop-in replacement for ImagePicker.launchImageLibraryAsync — same result
 * shape ({ canceled, assets }), but every asset is already shrunk.
 */
export async function pickImage(opts = {}) {
  // quality is forced last: compression happens once, in compressAsset, so a
  // caller's old `quality` value can't stack a second lossy pass on top.
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], ...opts, quality: 1 });
  if (res.canceled || !res.assets?.length) return res;
  return { ...res, assets: await Promise.all(res.assets.map(compressAsset)) };
}

/** Same, for the camera. */
export async function captureImage(opts = {}) {
  const res = await ImagePicker.launchCameraAsync({ ...opts, quality: 1 });
  if (res.canceled || !res.assets?.length) return res;
  return { ...res, assets: await Promise.all(res.assets.map(compressAsset)) };
}
