import { useAuthStore } from '../store/auth';
import type { AuthResponse } from '../types';
export class ApiError extends Error { constructor(message: string, public status: number, public code: string, public details?: unknown) { super(message); this.name = 'ApiError'; } }
export type ApiOptions = { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal };
let refreshPromise: Promise<AuthResponse> | null = null;
export async function refreshSession(): Promise<AuthResponse> {
  if (!refreshPromise) refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' }).then(async (response) => {
    if (!response.ok) { useAuthStore.getState().clear(); throw new ApiError('Войдите в аккаунт', response.status, 'UNAUTHORIZED'); }
    const result: AuthResponse = await response.json(); useAuthStore.getState().setSession(result.user, result.accessToken); return result;
  }).finally(() => { refreshPromise = null; });
  return refreshPromise;
}
export async function api<T>(path: string, options: ApiOptions = {}, retry = true): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const form = options.body instanceof FormData;
  let response: Response;
  try { response = await fetch(`/api${path}`, { method: options.method ?? 'GET', credentials: 'include', signal: options.signal, headers: { ...(options.body && !form ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }, body: options.body === undefined ? undefined : form ? options.body as FormData : JSON.stringify(options.body) }); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') throw error; throw new ApiError('Не удалось связаться с магазином. Проверьте подключение и попробуйте снова.', 0, 'NETWORK_ERROR'); }
  if (response.status === 401 && token && retry && !path.startsWith('/auth/')) { await refreshSession(); return api<T>(path, options, false); }
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(result?.error?.message ?? 'Не удалось выполнить действие. Попробуйте ещё раз.', response.status, result?.error?.code ?? 'REQUEST_FAILED', result?.error?.details);
  return result as T;
}
