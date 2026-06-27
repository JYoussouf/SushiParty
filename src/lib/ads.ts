// AdMob interstitial shown at the natural break after a sushi party — when the
// user leaves the post-party summary ("Let's Go Home!"). Designed to be
// non-clunky:
//   • Preloaded while the party happens, so it appears instantly (no spinner).
//   • Frequency-capped (every Nth party + a cooldown), so it's occasional.
//   • Never blocks the results screen and never hangs the flow (safety timeout).
//
// Gated behind EXPO_PUBLIC_ADS_ENABLED (default OFF). When the flag is off we
// never touch the native module, so the app runs unchanged in Expo Go and in
// builds where ads aren't wanted yet.
//
// The native module is required lazily (inside functions) on purpose — a
// top-level import of react-native-google-mobile-ads would crash environments
// where the native module isn't present (e.g. Expo Go).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Google's official sample/test ad unit IDs. These always serve test ads and
// are safe to ship. Replace with your real interstitial unit IDs (and the app
// IDs in app.json) once your AdMob account is set up — set them via
// EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID / _IOS.
const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS = 'ca-app-pub-3940256099942544/4411468910';

// Show an ad at most once per this many finished parties, and never within the
// cooldown window. Tuned so ads feel occasional, not relentless.
const DEFAULT_EVERY_N_PARTIES = 3;
const COOLDOWN_MS = 2 * 60 * 1000;
const SHOW_TIMEOUT_MS = 8000;

const PARTY_COUNT_KEY = 'ads:partyCount';
const LAST_SHOWN_KEY = 'ads:lastShownAt';

export function adsEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ADS_ENABLED === 'true';
}

function everyNParties(): number {
  const n = Number(process.env.EXPO_PUBLIC_ADS_EVERY_N);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : DEFAULT_EVERY_N_PARTIES;
}

function interstitialUnitId(): string {
  if (Platform.OS === 'ios') {
    return process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS?.trim() || TEST_INTERSTITIAL_IOS;
  }
  return process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID?.trim() || TEST_INTERSTITIAL_ANDROID;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdsModule = any;

let adsModule: AdsModule | null = null;
function loadAdsModule(): AdsModule | null {
  if (adsModule) return adsModule;
  try {
    // Lazy require so flag-off / Expo Go never loads the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    adsModule = require('react-native-google-mobile-ads');
    return adsModule;
  } catch {
    return null;
  }
}

let initPromise: Promise<void> | null = null;
function ensureInitialized(ads: AdsModule): Promise<void> {
  if (!initPromise) {
    initPromise = ads.default().initialize().then(() => undefined);
  }
  return initPromise as Promise<void>;
}

// A single preloaded interstitial kept ready to show instantly.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let preloaded: { ad: any; ready: boolean } | null = null;

/**
 * Preloads an interstitial so it can be shown instantly later. Safe to call
 * eagerly (e.g. when a party starts). No-ops when ads are disabled/unavailable
 * or an ad is already loaded or loading.
 */
export function prepareInterstitial(): void {
  if (!adsEnabled() || preloaded) return;

  const ads = loadAdsModule();
  if (!ads) return;

  void ensureInitialized(ads).then(() => {
    if (preloaded) return;
    const { InterstitialAd, AdEventType } = ads;
    const ad = InterstitialAd.createForAdRequest(interstitialUnitId(), {
      requestNonPersonalizedAdsOnly: true,
    });
    preloaded = { ad, ready: false };

    ad.addAdEventListener(AdEventType.LOADED, () => {
      if (preloaded && preloaded.ad === ad) preloaded.ready = true;
    });
    ad.addAdEventListener(AdEventType.ERROR, () => {
      if (preloaded && preloaded.ad === ad) preloaded = null;
    });

    ad.load();
  });
}

/**
 * Shows the preloaded interstitial if one is ready AND the frequency cap allows
 * it. Always resolves quickly; never blocks the UI. Counts every finished party
 * so the cadence stays consistent whether or not an ad actually shows.
 */
export async function showInterstitialIfDue(): Promise<void> {
  if (!adsEnabled()) return;

  // Count this party and decide if an ad is due, regardless of load state.
  const count = ((await readInt(PARTY_COUNT_KEY)) ?? 0) + 1;
  await AsyncStorage.setItem(PARTY_COUNT_KEY, String(count));

  const due = count % everyNParties() === 0;
  if (!due) {
    prepareInterstitial(); // warm up for a future party
    return;
  }

  const lastShown = (await readInt(LAST_SHOWN_KEY)) ?? 0;
  if (Date.now() - lastShown < COOLDOWN_MS) return;

  const ads = loadAdsModule();
  if (!ads || !preloaded?.ready) {
    prepareInterstitial(); // wasn't ready in time — skip gracefully, warm up next
    return;
  }

  const { AdEventType } = ads;
  const current = preloaded;
  preloaded = null;

  await new Promise<void>((resolve) => {
    const unsubscribers: Array<() => void> = [];
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribers.forEach((off) => off());
      resolve();
    };

    timeout = setTimeout(finish, SHOW_TIMEOUT_MS);
    unsubscribers.push(
      current.ad.addAdEventListener(AdEventType.CLOSED, finish),
      current.ad.addAdEventListener(AdEventType.ERROR, finish),
    );

    try {
      current.ad.show();
    } catch {
      finish();
    }
  });

  await AsyncStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
  prepareInterstitial(); // preload the next one
}

async function readInt(key: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}
