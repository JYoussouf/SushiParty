import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { apiRequest, setApiToken } from './cloudflare/client';
import type { User } from '../types';

export interface OAuthResponse {
  token: string;
  user: User;
  accountBacked: boolean;
}

// Set up the redirect URL
WebBrowser.maybeCompleteAuthSession();

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
    if (error instanceof Error && error.message.includes('User cancelled')) {
      throw new Error('Sign in cancelled');
    }
    throw error;
  }
}

/**
 * Sign in with Google using OAuth flow
 * Opens the browser for OAuth authentication
 */
export async function signInWithGoogle(googleClientId: string): Promise<OAuthResponse> {
  try {
    // Build the authorization URL
    const redirectUrl = 'com.sushiparty://oauth/google';
    const state = Math.random().toString(36).substring(7);
    const scope = encodeURIComponent('openid profile email');
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(googleClientId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
      `response_type=code&` +
      `scope=${scope}&` +
      `state=${state}`;

    // Open browser for authentication
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    if (result.type === 'success') {
      // Extract authorization code from URL
      const url = new URL(result.url);
      const code = url.searchParams.get('code');

      if (!code) {
        throw new Error('No authorization code received from Google');
      }

      // Exchange code for ID token (in production, do this on backend)
      // For now, we'll send the code to our backend which will exchange it
      const response = await apiRequest<OAuthResponse>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });

      await setApiToken(response.token);
      return response;
    }

    throw new Error('Google sign in was cancelled');
  } catch (error) {
    if (error instanceof Error && error.message.includes('cancelled')) {
      throw new Error('Sign in cancelled');
    }
    throw error;
  }
}

/**
 * Sign in with Facebook using OAuth flow
 * Opens the browser for OAuth authentication
 */
export async function signInWithFacebook(facebookAppId: string): Promise<OAuthResponse> {
  try {
    // Build the authorization URL
    const redirectUrl = 'com.sushiparty://oauth/facebook';
    const scope = encodeURIComponent('public_profile,email');
    
    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${encodeURIComponent(facebookAppId)}&` +
      `redirect_uri=${encodeURIComponent(redirectUrl)}&` +
      `response_type=code&` +
      `scope=${scope}`;

    // Open browser for authentication
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);

    if (result.type === 'success') {
      // Extract authorization code from URL
      const url = new URL(result.url);
      const code = url.searchParams.get('code');

      if (!code) {
        throw new Error('No authorization code received from Facebook');
      }

      // Exchange code for access token (in production, do this on backend)
      // For now, we'll send the code to our backend which will exchange it
      const response = await apiRequest<OAuthResponse>('/auth/facebook', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });

      await setApiToken(response.token);
      return response;
    }

    throw new Error('Facebook sign in was cancelled');
  } catch (error) {
    if (error instanceof Error && error.message.includes('cancelled')) {
      throw new Error('Sign in cancelled');
    }
    throw error;
  }
}

