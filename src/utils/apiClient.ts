// API Utilities for Sample (used by login/subAppAuth)
// Use same base URL as apiUtils so production login hits correct backend

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:4313/api');
const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 10000;

/**
 * Make API requests to the backend
 */
export class ApiClient {
  private baseUrl: string;
  private _timeout: number;

  constructor(baseUrl = API_BASE_URL, timeout: number | string = API_TIMEOUT) {
    this.baseUrl = baseUrl;
    this._timeout = typeof timeout === 'string' ? parseInt(timeout, 10) : timeout;
  }

  get timeout(): number {
    return this._timeout;
  }

  /**
   * Make a GET request
   */
  async get<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'GET',
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

  /**
   * Make a POST request
   */
  async post<T = any>(endpoint: string, data: any, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      credentials: 'include', // Include cookies for authentication
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(endpoint: string, data: any, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      credentials: 'include', // Include cookies for authentication
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'DELETE',
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

  /**
   * Check backend health
   */
  async healthCheck() {
    try {
      const health = await this.get('/api/health');
      return { status: 'healthy', data: health };
    } catch (error) {
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
    } catch (error) {
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