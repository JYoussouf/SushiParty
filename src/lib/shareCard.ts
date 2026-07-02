import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

// Capture-and-share helpers for the Wrapped card. The card is an on-screen
// React view; we rasterize it to a PNG and hand that to the OS share sheet
// (which surfaces Instagram, Snapchat, Messages, Save, etc.) or the clipboard.

type CaptureTarget = RefObject<View | null>;

async function capturePng(ref: CaptureTarget): Promise<string> {
  return captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile' });
}

export type ShareResult = 'shared' | 'unavailable' | 'error';

/**
 * Rasterize the card and open the system share sheet. On iOS/Android this is
 * the reliable route to "Add to Instagram/Snapchat story" and every other
 * installed target — no per-app SDK or app-id wiring required.
 */
export async function shareCardImage(ref: CaptureTarget): Promise<ShareResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return 'unavailable';
    const uri = await capturePng(ref);
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      UTI: 'public.png',
      dialogTitle: 'Share your Sushi Wrapped',
    });
    return 'shared';
  } catch {
    return 'error';
  }
}

/** Copy the rendered card to the clipboard as an image (falls back to false). */
export async function copyCardImage(ref: CaptureTarget): Promise<boolean> {
  try {
    const base64 = await captureRef(ref, { format: 'png', quality: 1, result: 'base64' });
    await Clipboard.setImageAsync(base64);
    return true;
  } catch {
    return false;
  }
}

/** Copy a plain-text summary — a universal fallback for "just copy it". */
export async function copyCardText(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
