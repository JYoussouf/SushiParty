import { Linking, Platform } from 'react-native';
import type { GeoPoint } from '../types';

// Deep-links into the platform's native maps app for turn-by-turn directions:
// Apple Maps on iOS, Google Maps on Android/web. Kept as a pure URL builder
// plus a thin opener so the builder can be unit-tested without native modules.

export type MapsPlatform = 'ios' | 'android' | 'web';

export function buildDirectionsUrl(
  platform: MapsPlatform,
  destination: GeoPoint,
  label?: string,
): string {
  const lat = destination.latitude;
  const lng = destination.longitude;
  if (platform === 'ios') {
    // Apple Maps: daddr drives directions; q labels the destination pin.
    const q = label ? `&q=${encodeURIComponent(label)}` : '';
    return `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d${q}`;
  }
  // Google Maps universal directions URL — opens the app when installed,
  // otherwise the web map. Works on Android and as a cross-platform fallback.
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function currentPlatform(): MapsPlatform {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/**
 * Open native directions to a destination. Returns false if no handler could
 * be opened (caller can surface a message).
 */
export async function openDirections(destination: GeoPoint, label?: string): Promise<boolean> {
  const url = buildDirectionsUrl(currentPlatform(), destination, label);
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    // Last-ditch cross-platform fallback to the Google web URL.
    try {
      await Linking.openURL(buildDirectionsUrl('web', destination, label));
      return true;
    } catch {
      return false;
    }
  }
}
