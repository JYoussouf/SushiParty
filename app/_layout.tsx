import { useEffect, useState } from 'react';
import { Stack, useRouter, useRootNavigationState, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import {
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_600SemiBold_Italic,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { View } from 'react-native';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';
import { RestaurantProvider } from '../src/contexts/RestaurantContext';
import { SessionProvider, useSession } from '../src/contexts/SessionContext';
import { TransitionProvider } from '../src/contexts/TransitionContext';
import { ThemeProvider } from '../src/contexts/ThemeContext';
import { IntroSplash } from '../src/components';
import { appTheme } from '../src/theme/themes';

let didInitialRedirect = false;

const logPartyFlow = (...args: unknown[]) => {
  console.log('[party-flow]', Date.now(), ...args);
};

function RootLayoutNav() {
  const router = useRouter();
  const navState = useRootNavigationState();
  const segments = useSegments();
  const { hasActiveSession, groupSessionId } = useSession();
  const { accountBacked, onboardingDone, loading: authLoading } = useAuth();

  useEffect(() => {
    logPartyFlow('root segments changed', {
      segments: segments.join('/'),
      navReady: !!navState?.key,
      authLoading,
      accountBacked,
      onboardingDone,
      hasActiveSession,
      groupSessionId,
    });
  }, [
    accountBacked,
    authLoading,
    groupSessionId,
    hasActiveSession,
    navState?.key,
    onboardingDone,
    segments,
  ]);

  // Account gate runs before onboarding because long-term tracking needs a real login.
  useEffect(() => {
    if (!navState?.key || authLoading) return;
    const currentPath = segments.join('/');
    const inAuth = segments[0] === '(auth)';

    if (!accountBacked) {
      if (!inAuth) {
        logPartyFlow('root auth gate replace login', { currentPath });
        router.replace('/(auth)/login');
      }
      return;
    }

    if (inAuth) {
      logPartyFlow('root auth route exit replace', {
        currentPath,
        target: onboardingDone ? '/(tabs)/home' : '/onboarding',
      });
      router.replace(onboardingDone ? '/(tabs)/home' : '/onboarding');
      return;
    }

    if (!onboardingDone && currentPath !== 'onboarding') {
      logPartyFlow('root onboarding gate replace', { currentPath });
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
      const target = hasActiveSession
        ? (groupSessionId ? '/session/lobby' : '/session/scoreboard')
        : '/(tabs)/home';
      logPartyFlow('root initial redirect replace', { currentPath, target });
      router.replace(
        hasActiveSession
          ? (groupSessionId ? '/session/lobby' : '/session/scoreboard')
          : '/(tabs)/home',
      );
    }, 0);
    return () => clearTimeout(t);
  }, [
    router,
    navState?.key,
    hasActiveSession,
    groupSessionId,
    segments,
    accountBacked,
    onboardingDone,
    authLoading,
  ]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        animationDuration: 280,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ animation: 'none', gestureEnabled: false }} />
      <Stack.Screen name="(auth)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen
        name="restaurant/picker"
        options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen
        name="session/mode-select"
        options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen
        name="session/lobby"
        options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen
        name="session/scoreboard"
        options={{ headerShown: false, animation: 'none', gestureEnabled: false }}
      />
      <Stack.Screen
        name="session/party-intro"
        options={{ headerShown: false, animation: 'none', gestureEnabled: false }}
      />
      <Stack.Screen
        name="session/group-join"
        options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen
        name="session/restaurant-confirm"
        options={{ headerShown: false, animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen name="session/summary" options={{ headerShown: false, animation: 'none', gestureEnabled: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="friend/[id]" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="profile/favorites" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="profile/restaurants" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [introDone, setIntroDone] = useState(false);
  const [fontsLoaded] = useFonts({
    PressStart2P_400Regular,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold_Italic,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: appTheme.color.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <SessionProvider>
            <TransitionProvider>
              <RestaurantProvider>
                <RootLayoutNav />
              </RestaurantProvider>
            </TransitionProvider>
          </SessionProvider>
        </AuthProvider>
        {!introDone && <IntroSplash onFinish={() => setIntroDone(true)} />}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
