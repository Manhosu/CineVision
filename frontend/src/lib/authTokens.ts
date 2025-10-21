/**
 * Utility functions for managing authentication tokens
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Get the current access token from localStorage
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || localStorage.getItem('auth_token');
}

/**
 * Get the refresh token from localStorage
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

/**
 * Set tokens in localStorage
 */
export function setTokens(accessToken: string, refreshToken: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

/**
 * Clear all auth tokens from localStorage
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

/**
 * Refresh the access token using the refresh token
 * Returns the new access token or null if refresh failed
 */
export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    console.error('No refresh token available');
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      console.error('Failed to refresh token:', response.status);
      return null;
    }

    const data = await response.json();
    const { access_token, refresh_token: newRefreshToken } = data;

    // Update tokens in localStorage
    setTokens(access_token, newRefreshToken);

    return access_token;
  } catch (error) {
    console.error('Error refreshing token:', error);
    return null;
  }
}

/**
 * Get valid access token, refreshing if necessary
 * Returns null if token cannot be obtained or refreshed
 */
export async function getValidAccessToken(): Promise<string | null> {
  let token = getAccessToken();

  if (!token) {
    console.error('No access token available');
    return null;
  }

  // Try to refresh token preemptively if we have a refresh token
  // This helps avoid 401 errors
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return newToken;
    }
  }

  return token;
}

/**
 * Make an authenticated fetch request with automatic token refresh on 401
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getValidAccessToken();

  if (!token) {
    throw new Error('No authentication token available');
  }

  // Add Authorization header
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  // Make the request
  let response = await fetch(url, { ...options, headers });

  // If we get a 401, try refreshing the token once
  if (response.status === 401) {
    console.log('Got 401, attempting to refresh token...');
    const newToken = await refreshAccessToken();

    if (newToken) {
      console.log('Token refreshed successfully, retrying request...');
      headers['Authorization'] = `Bearer ${newToken}`;
      response = await fetch(url, { ...options, headers });
    } else {
      console.error('Token refresh failed');
      // Clear tokens and redirect to login
      clearTokens();
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
        window.location.href = '/admin/login';
      }
    }
  }

  return response;
}
