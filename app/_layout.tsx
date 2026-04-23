import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/contexts/AuthContext';

function RootLayoutNav() {
  const { firebaseUser, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!firebaseUser && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (firebaseUser && inAuthGroup) {
      router.replace('/(tabs)/scoreboard');
    }
  }, [firebaseUser, loading, segments, router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen
        name="restaurant/picker"
        options={{ headerShown: true, title: 'Choose Restaurant', presentation: 'modal' }}
      />
      <Stack.Screen
        name="session/mode-select"
        options={{ headerShown: true, title: 'Session Mode', presentation: 'modal' }}
      />
      <Stack.Screen
        name="session/group-join"
        options={{ headerShown: true, title: 'Join Group', presentation: 'modal' }}
      />
      <Stack.Screen
        name="session/summary"
        options={{ headerShown: true, title: 'Session Summary', presentation: 'modal' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
