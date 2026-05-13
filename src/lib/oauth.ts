import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { apiRequest } from './cloudflare/client';
import { setApiToken } from './cloudflare/authToken';
import type { User } from '../types';

export interface OAuthResponse {
  token: string;
  user: User;
  accountBacked: boolean;
}

/**
 * Sign in with Apple
 */
export async function signInWithApple(): Promise<OAuthResponse> {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('No identity token received from Apple.');
    }

    // Extract email and name from credential
    const email = credential.email || `${credential.user}@privaterelay.appleid.com`;
    const displayName = [credential.fullName?.givenName, credential.fullName?.familyName]
      .filter(Boolean)
      .join(' ') || 'Apple User';

    // Verify with backend
    const response = await apiRequest<OAuthResponse>('/auth/apple', {
      method: 'POST',
      body: JSON.stringify({
        idToken: credential.identityToken,
        email,
        displayName,
      }),
    });

    await setApiToken(response.token);
    return response;
  } catch (error) {
    if (
      error instanceof Error &&
      ('code' in error
        ? (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
        : error.message.toLowerCase().includes('cancel'))
    ) {
      throw new Error('Sign in cancelled');
    }
    throw error;
  }
}

/**
 * Exchange a Google OAuth authorization code for a Sushi Party session.
 * The browser step is handled by Google.useAuthRequest in login.tsx.
 */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<OAuthResponse> {
  const response = await apiRequest<OAuthResponse>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ code, redirectUri }),
  });
  await setApiToken(response.token);
  return response;
}

/**
 * Sign in with Facebook using OAuth flow
 * Opens the browser for OAuth authentication
 */
export async function signInWithFacebook(facebookAppId: string): Promise<OAuthResponse> {
  try {
    const redirectUri = 'sushiparty://oauth/facebook';
    const scope = encodeURIComponent('public_profile,email');

    const authUrl =
      `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${encodeURIComponent(facebookAppId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `response_type=code&` +
      `scope=${scope}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

    if (result.type === 'success') {
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (!code) throw new Error('No authorization code received from Facebook');

      const response = await apiRequest<OAuthResponse>('/auth/facebook', {
        method: 'POST',
        body: JSON.stringify({ code, redirectUri }),
      });

      await setApiToken(response.token);
      return response;
    }

    throw new Error('Facebook sign in was cancelled');
  } catch (error) {
    if (error instanceof Error && error.message.toLowerCase().includes('cancel')) {
      throw new Error('Sign in cancelled');
    }
    throw error;
  }
}

