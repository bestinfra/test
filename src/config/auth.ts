// Authentication configuration for TGPDCL Consumer project
// This ensures unique token storage to avoid conflicts with other projects

export const AUTH_CONFIG = {
  // Unique token key for My-Gate project to avoid conflicts with other projects
  TOKEN_KEY: 'tgpdcl_consumer_auth_token',
  USER_KEY: 'tgpdcl_consumer_auth_user',
  APP_ID: 'TGPDCL_CONSUMER'
} as const;

// Helper function to get the appropriate storage based on rememberMe
const getStorage = (rememberMe: boolean = true): Storage => {
  return rememberMe ? localStorage : sessionStorage;
};

// Helper functions for token management
// Checks both localStorage and sessionStorage (for backward compatibility)
export const getStoredToken = (): string | null => {
  // Check localStorage first, then sessionStorage
  return localStorage.getItem(AUTH_CONFIG.TOKEN_KEY) || sessionStorage.getItem(AUTH_CONFIG.TOKEN_KEY);
};

export const setStoredToken = (token: string, rememberMe: boolean = true): void => {
  const storage = getStorage(rememberMe);
  
  // Clear from both storages first to avoid conflicts
  localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  
  // Store in the appropriate storage
  storage.setItem(AUTH_CONFIG.TOKEN_KEY, token);
  
  // Console log only the token as requested
  console.log('🔐 [setStoredToken] Token:', token);
};

export const removeStoredToken = (): void => {
  localStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.TOKEN_KEY);
};

export const getStoredUser = () => {
  // Check localStorage first, then sessionStorage
  const userStr = localStorage.getItem(AUTH_CONFIG.USER_KEY) || sessionStorage.getItem(AUTH_CONFIG.USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

export const setStoredUser = (user: any, rememberMe: boolean = true): void => {
  const storage = getStorage(rememberMe);
  
  // Clear from both storages first to avoid conflicts
  localStorage.removeItem(AUTH_CONFIG.USER_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.USER_KEY);
  
  // Store in the appropriate storage
  storage.setItem(AUTH_CONFIG.USER_KEY, JSON.stringify(user));
};

export const removeStoredUser = (): void => {
  localStorage.removeItem(AUTH_CONFIG.USER_KEY);
  sessionStorage.removeItem(AUTH_CONFIG.USER_KEY);
};

export const clearAuthData = (): void => {
  removeStoredToken();
  removeStoredUser();
};

export const isAuthenticated = (): boolean => {
  const token = getStoredToken();
  return !!token;
};
