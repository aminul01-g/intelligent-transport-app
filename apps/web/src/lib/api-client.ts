import { ApiResponse } from '@transport/shared-types';
import { useAuthStore } from '../store/auth.store';
import { User } from '../types/user';

// Custom AppError class matching the backend shape
export class AppError extends Error {
  statusCode: number;

  code: string;

  isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// Module-level refresh promise mutex to prevent concurrent refresh requests
let refreshPromise: Promise<string> | null = null;

async function performTokenRefresh(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Refresh failed');
  }

  const rawJson: unknown = await response.json();
  const result = rawJson as ApiResponse<{ user: User; accessToken: string }>;
  if (!result.success) {
    throw new Error(result.message || 'Refresh response success false');
  }

  const { user, accessToken } = result.data;
  // Update the auth store with the new token
  useAuthStore.getState().setAuth(user, accessToken);
  return accessToken;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}/api/v1${path}`;
  const store = useAuthStore.getState();
  const token = store.accessToken;

  const headers = new Headers(options.headers);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const finalOptions: RequestInit = {
    ...options,
    headers,
  };

  const response = await fetch(url, finalOptions);

  // If 401 and we haven't retried yet, trigger token refresh
  if (response.status === 401 && !retried) {
    try {
      if (!refreshPromise) {
        refreshPromise = performTokenRefresh().finally(() => {
          refreshPromise = null;
        });
      }

      const newToken = await refreshPromise;

      // Retry original request ONCE with new token
      const retryHeaders = new Headers(options.headers);
      retryHeaders.set('Authorization', `Bearer ${newToken}`);
      if (!retryHeaders.has('Content-Type') && !(options.body instanceof FormData)) {
        retryHeaders.set('Content-Type', 'application/json');
      }

      return await request<T>(
        path,
        { ...options, headers: retryHeaders },
        true,
      );
    } catch (refreshErr) {
      // If refresh also fails (401 / error), clear auth and redirect to /login
      store.clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      throw new AppError(
        'Session expired. Please log in again.',
        401,
        'AUTH_SESSION_EXPIRED',
      );
    }
  }

  // Parse and check API response
  const rawBody: unknown = await response.json().catch(() => ({
    success: false,
    message: 'Invalid JSON response from server',
    code: 'INVALID_JSON',
  }));

  const json = rawBody as ApiResponse<T>;

  if (!response.ok || !json.success) {
    const errorMsg = !json.success ? json.message : 'An error occurred';
    const errorCode = !json.success ? json.code : 'UNKNOWN_ERROR';
    throw new AppError(errorMsg, response.status, errorCode);
  }

  return json.data;
}

export const apiClient = {
  get<T>(path: string, options?: Omit<RequestInit, 'method'>): Promise<T> {
    return request<T>(path, { ...options, method: 'GET' });
  },

  post<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestInit, 'method' | 'body'>,
  ): Promise<T> {
    const reqOptions: RequestInit = { ...options, method: 'POST' };
    if (body !== undefined) {
      reqOptions.body = JSON.stringify(body);
    }
    return request<T>(path, reqOptions);
  },

  patch<T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestInit, 'method' | 'body'>,
  ): Promise<T> {
    const reqOptions: RequestInit = { ...options, method: 'PATCH' };
    if (body !== undefined) {
      reqOptions.body = JSON.stringify(body);
    }
    return request<T>(path, reqOptions);
  },

  delete<T>(path: string, options?: Omit<RequestInit, 'method'>): Promise<T> {
    return request<T>(path, { ...options, method: 'DELETE' });
  },
};
