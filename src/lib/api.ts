/** Client-side API helpers — always same-origin, sends cookie automatically */

const BASE = '/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({ success: false, error: res.statusText }));

  if (!res.ok) {
    const msg = data?.error ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)   => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
};
