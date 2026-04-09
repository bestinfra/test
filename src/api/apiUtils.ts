// API Utilities for TGPDCL Consumer
// This file provides utilities to connect to the backend API with automatic token management

import { AUTH_CONFIG } from '../config/auth';

// Production: use relative /api if env not set (same-origin). Dev: localhost with /api
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:4313/api');

/**
 * Decode JWT payload without verifying (client-side only, to read claims like exp).
 * Returns null if token is invalid or not a JWT.
 */
export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
};

/**
 * Check if the JWT is expired (exp claim in the past).
 * exp is in seconds; we use a 10s buffer so we redirect just before actual expiry.
 */
export const isTokenExpired = (token: string): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return true;
  const nowSec = Math.floor(Date.now() / 1000);
  const bufferSec = 10;
  return payload.exp <= nowSec + bufferSec;
};

/**
 * Clear all auth storage and redirect to login page.
 */
export const clearAuthAndRedirectToLogin = (): void => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  localStorage.removeItem(AUTH_CONFIG.USER_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.USER_KEY);
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
};

/**
 * Get access token - checks project token key first (used by login), then legacy key.
 * This ensures production works when token is stored under tgpdcl_consumer_auth_token.
 */
export const getAccessToken = (): string | null => {
  const projectToken =
    localStorage.getItem(AUTH_CONFIG.TOKEN_KEY) ||
    sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
  if (projectToken) return projectToken;
  return localStorage.getItem('accessToken');
};

/**
 * Headers with Authorization for use in raw fetch() calls (e.g. BACKEND_URL).
 * Use this whenever calling the backend outside apiClient.
 */
export const getAuthHeaders = (): Record<string, string> => {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Get refresh token from localStorage
 */
const getRefreshToken = (): string | null => {
  return localStorage.getItem('refreshToken');
};

/**
 * Refresh access token using refresh token
 */
const refreshAccessToken = async (): Promise<boolean> => {
  try {
    const currentRefreshToken = getRefreshToken();

    if (!currentRefreshToken) {
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/sub-app/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ refreshToken: currentRefreshToken }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();

    if (data.success && data.data) {
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = data.data;

      localStorage.setItem('accessToken', newAccessToken);
      localStorage.setItem(AUTH_CONFIG.TOKEN_KEY, newAccessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      return true;
    }

    return false;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
};

/**
 * Make an authenticated request with automatic token refresh
 */
const makeAuthenticatedRequest = async (
  url: string,
  options: RequestInit,
  retryCount = 0
): Promise<Response> => {
  let accessToken = getAccessToken();

  // Proactive check: if token is expired (exp in the past), try refresh first
  if (accessToken && isTokenExpired(accessToken)) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      clearAuthAndRedirectToLogin();
      return new Response(JSON.stringify({ error: 'Session expired' }), { status: 401 });
    }
    accessToken = getAccessToken();
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 from server - refresh and retry once
  if (response.status === 401 && retryCount === 0) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return makeAuthenticatedRequest(url, options, 1);
    }
    clearAuthAndRedirectToLogin();
    return response;
  }

  return response;
};

/**
 * Make API requests to the backend with automatic token management
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Build URL from base URL and endpoint
   */
  private buildUrl(endpoint: string): string {
    return `${this.baseUrl}${endpoint}`;
  }

  /**
   * Make a GET request with automatic token handling
   */
  async get(endpoint: string, options: RequestInit = {}) {
    const url = this.buildUrl(endpoint);
    const response = await makeAuthenticatedRequest(url, {
      method: 'GET',
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make a POST request with automatic token handling
   */
  async post(endpoint: string, data: any, options: RequestInit = {}) {
    const url = this.buildUrl(endpoint);
    const response = await makeAuthenticatedRequest(url, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make a PUT request with automatic token handling
   */
  async put(endpoint: string, data: any, options: RequestInit = {}) {
    const url = this.buildUrl(endpoint);
    const response = await makeAuthenticatedRequest(url, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make a DELETE request with automatic token handling
   */
  async delete(endpoint: string, options: RequestInit = {}) {
    const url = this.buildUrl(endpoint);
    const response = await makeAuthenticatedRequest(url, {
      method: 'DELETE',
      ...options,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check backend health
   */
  async healthCheck() {
    try {
      const health = await this.get('/api/health');
      return { status: 'healthy', data: health };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { status: 'unhealthy', error: errorMessage };
    }
  }

  /**
   * Get backend environment info
   */
  async getEnvironmentInfo() {
    try {
      const env = await this.get('/api/env');
      return { status: 'success', data: env };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { status: 'error', error: errorMessage };
    }
  }
}

// Create a default API client instance
export const apiClient = new ApiClient();

// Export commonly used API functions
export const api = {
  // Health check
  health: () => apiClient.healthCheck(),

  // Environment info
  env: () => apiClient.getEnvironmentInfo(),

  // Example API endpoints (customize based on your backend)
  users: {
    getAll: () => apiClient.get('/api/users'),
    getById: (id: string) => apiClient.get(`/api/users/${id}`),
    create: (data: any) => apiClient.post('/api/users', data),
    update: (id: string, data: any) => apiClient.put(`/api/users/${id}`, data),
    delete: (id: string) => apiClient.delete(`/api/users/${id}`),
  },

  // Add more API endpoints as needed
  // Example: posts, comments, etc.
};

export default apiClient;
