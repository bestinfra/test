// Sub-App Authentication API Service
import { apiClient } from '../utils/apiClient';
import { AUTH_CONFIG } from '../config/auth';

interface LoginRequest {
  identifier: string; // User can enter username or email
  password: string;
  appId?: string;
  rememberMe?: boolean;
}

interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: number;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      roles?: string[];
      permissions?: string[];
      accessLevel?: string;
      locationId?: number;
      location?: {
        id: number;
        name: string;
        code: string;
        address: string;
      } | null;
    };
    accessToken: string;
    refreshToken: string;
    expiresIn?: number;
    refreshExpiresIn?: number;
    appId: string;
  };
}

interface VerifyTokenResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: number;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    };
    appId: string;
  };
}

interface ProfileResponse {
  success: boolean;
  message: string;
  data?: {
    user: {
      id: number;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      createdAt: string;
    };
    appId: string;
  };
}

// Base API URL - Updated to use application-backend
const API_BASE = `/sub-app/auth`;

// Helper function to make API requests (for verify-token and profile endpoints)
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Include cookies for authentication
    ...options,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Login function - matches backend API structure
// Endpoint: /api/sub-app/auth/login
// Body: { identifier, password, appId, rememberMe }
export const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
  const requestBody = {
    identifier: credentials.identifier,
    password: credentials.password,
    appId: credentials.appId,
    rememberMe: credentials.rememberMe,
  };

  try {
    const data = await apiClient.post<{
      success?: boolean;
      status?: string;
      message?: string;
      data?: {
        user: {
          id: number;
          username: string;
          email: string;
          firstName: string;
          lastName: string;
          role: string;
          roles?: string[];
          permissions?: string[];
          accessLevel?: string;
          locationId?: number;
          location?: {
            id: number;
            name: string;
            code: string;
            address: string;
          } | null;
        };
        accessToken: string;
        refreshToken: string;
        expiresIn?: number;
        refreshExpiresIn?: number;
        appId: string;
      };
    }>('/sub-app/auth/login', requestBody);

    // Log the full response for debugging
    console.log('🔍 [Login API] Full response:', JSON.stringify(data, null, 2));

    const responseData = data.data || (data as any);
    const accesstoken = responseData?.accessToken || (data as any).accessToken;
    const refreshToken = responseData?.refreshToken || (data as any).refreshToken;
    const userData = responseData?.user || (data as any).user;

    // Check for status: "success" or success: true
    const isSuccess = (data as any).status === 'success' || data.success === true;

    if (isSuccess && accesstoken && userData) {
      // Console log only the token as requested
      console.log('🔐 [Login API] Token:', accesstoken);

      return {
        success: true,
        message: data.message || 'Login successful',
        data: {
          user: {
            id: userData.id || 0,
            username: userData.username || '',
            email: userData.email || '',
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            role: userData.role || '',
            roles: userData.roles,
            permissions: userData.permissions,
            accessLevel: userData.accessLevel,
            locationId: userData.locationId,
            location: userData.location,
          },
          accessToken: accesstoken,
          refreshToken: refreshToken || accesstoken,
          expiresIn: responseData?.expiresIn || (data as any).expiresIn,
          refreshExpiresIn: responseData?.refreshExpiresIn || (data as any).refreshExpiresIn,
          appId: responseData?.appId || (data as any).appId || credentials.appId || '',
        },
      };
    }

    // Log what we received when the condition fails
    console.error('❌ [Login API] Response structure issue:', {
      status: (data as any).status,
      success: data.success,
      isSuccess: (data as any).status === 'success' || data.success === true,
      hasData: !!data.data,
      hasToken: !!(data.data?.accessToken || (data as any).accessToken),
      hasUser: !!(data.data?.user || (data as any).user),
      message: data.message,
      fullResponse: data,
    });

    return {
      success: false,
      message: data.message || 'Login failed - unexpected response structure',
    };
  } catch (error) {
    console.error('❌ [Login API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Network error occurred';
    return {
      success: false,
      message: errorMessage,
    };
  }
};

// Verify token function
export const verifyToken = async (token: string): Promise<VerifyTokenResponse> => {
  return apiRequest<VerifyTokenResponse>('/verify-token', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// Get profile function
export const getProfile = async (token: string): Promise<ProfileResponse> => {
  return apiRequest<ProfileResponse>('/profile', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

// Helper function to get stored token
// Checks both localStorage and sessionStorage
export const getStoredToken = (): string | null => {
  return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY) || sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY) ||
         localStorage.getItem('token') || sessionStorage.getItem('token'); // Backward compatibility
};

// Helper function to get stored user
// Checks both localStorage and sessionStorage
export const getStoredUser = () => {
  const userStr = localStorage.getItem(AUTH_CONFIG.USER_KEY) || sessionStorage.getItem(AUTH_CONFIG.USER_KEY) ||
                  localStorage.getItem('user') || sessionStorage.getItem('user'); // Backward compatibility
  return userStr ? JSON.parse(userStr) : null;
};

// Helper function to clear stored auth data
// Clears from both localStorage and sessionStorage
export const clearAuthData = (): void => {
  localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  localStorage.removeItem(AUTH_CONFIG.USER_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.USER_KEY);
  // Backward compatibility
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
};

// Helper function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  const token = getStoredToken();
  return !!token;
};

// Helper function to logout
export const logout = (): void => {
  clearAuthData();
  window.location.href = '/login';
};
