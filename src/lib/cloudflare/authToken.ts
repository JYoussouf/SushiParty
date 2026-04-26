import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const API_TOKEN_KEY = 'sushi-party_cloudflare-api-token';

async function secureStoreAvailable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function getApiToken(): Promise<string | null> {
  if (await secureStoreAvailable()) {
    return SecureStore.getItemAsync(API_TOKEN_KEY);
  }
  return AsyncStorage.getItem(API_TOKEN_KEY);
}

export async function setApiToken(token: string): Promise<void> {
  if (await secureStoreAvailable()) {
    await SecureStore.setItemAsync(API_TOKEN_KEY, token);
    return;
  }
  await AsyncStorage.setItem(API_TOKEN_KEY, token);
}

export async function clearApiToken(): Promise<void> {
  if (await secureStoreAvailable()) {
    await SecureStore.deleteItemAsync(API_TOKEN_KEY);
    return;
  }
  await AsyncStorage.removeItem(API_TOKEN_KEY);
}
