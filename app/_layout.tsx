import { useEffect, useState } from 'react';
import { Stack, useRouter, useRootNavigationState, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { View } from 'react-native';
import { AuthProvider } from '../src/contexts/AuthContext';
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

  useEffect(() => {
    if (!navState?.key) return;
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
  }, [router, navState?.key, hasActiveSession, segments]);

  useEffect(() => {
    if (!navState?.key || !hasActiveSession) {
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
  }, [hasActiveSession, navState?.key, router, segments]);

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
      <Stack.Screen
        name="session/summary"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="friend/[id]"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="profile/favorites"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="profile/restaurants"
        options={{ headerShown: false }}
      />
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
