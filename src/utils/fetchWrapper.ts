export type HttpOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  retries?: number;
  withCredentials?: boolean;
  signal?: AbortSignal;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

function buildUrl(pathOrUrl: string) {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API_BASE.replace(/\/+$/, '')}/${pathOrUrl.replace(/^\/+/, '')}`;
}

async function request<T = unknown>(pathOrUrl: string, opts: HttpOptions = {}): Promise<T> {
  const { method = 'GET', headers = {}, body, retries = 0, withCredentials = true, signal } = opts;

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': body instanceof FormData ? undefined as any : 'application/json',
      ...headers,
    } as any,
    credentials: withCredentials ? 'include' : 'same-origin',
    signal,
  };

  if (body !== undefined) {
    init.body = body instanceof FormData ? body : typeof body === 'string' ? body : JSON.stringify(body);
  }

  const url = buildUrl(pathOrUrl);
  try {
    const res = await fetch(url, init);
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await res.json().catch(() => null) : await res.text();

    if (!res.ok) {
      const err: any = new Error((payload as any)?.message || `HTTP ${res.status} ${res.statusText}`);
      err.status = res.status;
      err.data = payload;
      throw err;
    }
    return payload as T;
  } catch (e) {
    if (retries > 0) return request<T>(pathOrUrl, { ...opts, retries: retries - 1 });
    throw e;
  }
}

export const http = {
  get: <T = unknown>(url: string, opts?: HttpOptions) => request<T>(url, { ...opts, method: 'GET' }),
  post: <T = unknown>(url: string, body?: any, opts?: HttpOptions) => request<T>(url, { ...opts, method: 'POST', body }),
  put: <T = unknown>(url: string, body?: any, opts?: HttpOptions) => request<T>(url, { ...opts, method: 'PUT', body }),
  patch: <T = unknown>(url: string, body?: any, opts?: HttpOptions) => request<T>(url, { ...opts, method: 'PATCH', body }),
  del: <T = unknown>(url: string, opts?: HttpOptions) => request<T>(url, { ...opts, method: 'DELETE' }),
};

export default request;



