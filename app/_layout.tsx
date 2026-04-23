import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ presentation: 'modal' }} />
        <Stack.Screen name="restaurant/picker" options={{ headerShown: true, title: 'Choose Restaurant' }} />
        <Stack.Screen name="session/mode-select" options={{ headerShown: true, title: 'Session Mode' }} />
        <Stack.Screen name="session/group-join" options={{ headerShown: true, title: 'Join Group' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
