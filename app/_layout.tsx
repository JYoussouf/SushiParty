import { useEffect, useState } from 'react';
import { Stack, useRouter, useRootNavigationState, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { RestaurantProvider } from '../src/contexts/RestaurantContext';
import { SessionProvider, useSession } from '../src/contexts/SessionContext';
import { IntroSplash } from '../src/components';
import { palette } from '../src/theme/pixel';

let didInitialRedirect = false;

function RootLayoutNav() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const segments = useSegments();
  const { hasActiveSession } = useSession();
  const { accountBacked, onboardingDone, loading: authLoading } = useAuth();

  // Account gate runs before onboarding because long-term tracking needs a real login.
  useEffect(() => {
    if (!navState?.key || authLoading) return;
    const currentPath = segments.join('/');
    const inAuth = segments[0] === '(auth)';

    if (!accountBacked) {
      if (!inAuth) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (inAuth) {
      router.replace(onboardingDone ? '/(tabs)/home' : '/onboarding');
      return;
    }

    if (!onboardingDone && currentPath !== 'onboarding') {
      router.replace('/onboarding');
    }
  }, [accountBacked, navState?.key, authLoading, onboardingDone, router, segments]);

  // Initial home/scoreboard redirect for users who have completed onboarding
  useEffect(() => {
    if (!navState?.key || authLoading || !accountBacked || !onboardingDone) return;
    if (didInitialRedirect) return;
    const currentPath = segments.join('/');
    if (currentPath && currentPath !== 'index') {
      didInitialRedirect = true;
      return;
    }
    const t = setTimeout(() => {
      didInitialRedirect = true;
      router.replace(hasActiveSession ? '/(tabs)/scoreboard' : '/(tabs)/home');
    }, 0);
    return () => clearTimeout(t);
  }, [
    router,
    navState?.key,
    hasActiveSession,
    segments,
    accountBacked,
    onboardingDone,
    authLoading,
  ]);

  useEffect(() => {
    if (!navState?.key || !accountBacked || !hasActiveSession) {
      return;
    }

    const currentPath = segments.join('/');
    const allowedPaths = new Set([
      '(tabs)/scoreboard',
      'restaurant/picker',
      'session/mode-select',
      'session/group-join',
      'session/restaurant-confirm',
    ]);

    if (!allowedPaths.has(currentPath)) {
      router.replace('/(tabs)/scoreboard');
    }
  }, [accountBacked, hasActiveSession, navState?.key, router, segments]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        animationDuration: 280,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen
        name="restaurant/picker"
        options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="session/mode-select"
        options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="session/group-join"
        options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="session/restaurant-confirm"
        options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="session/summary" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="friend/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="profile/favorites" options={{ headerShown: false }} />
      <Stack.Screen name="profile/restaurants" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: palette.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SessionProvider>
          <RestaurantProvider>
            <RootLayoutNav />
          </RestaurantProvider>
        </SessionProvider>
      </AuthProvider>
      {!introDone && <IntroSplash onFinish={() => setIntroDone(true)} />}
    </SafeAreaProvider>
  );
}
