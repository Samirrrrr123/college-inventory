export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

let accessToken: string | null = null;
let refreshing: Promise<void> | null = null;

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError('NETWORK_ERROR', 0);
  }
  if (response.status === 204) return undefined as T;
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let code = 'REQUEST_FAILED';
    if (typeof result === 'object' && result && 'error' in result) {
      const error = result.error;
      if (typeof error === 'object' && error && 'code' in error && typeof error.code === 'string')
        code = error.code;
    }
    throw new ApiError(code, response.status);
  }
  return result as T;
}

export async function refreshSession() {
  if (!refreshing) {
    refreshing = send<{ data: { accessToken: string } }>('/auth/refresh', 'POST')
      .then((result) => {
        accessToken = result.data.accessToken;
      })
      .catch((error: unknown) => {
        accessToken = null;
        throw error;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (!accessToken) await refreshSession();
  try {
    return await send<T>(path, method, body);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    await refreshSession();
    return send<T>(path, method, body);
  }
}

export async function signIn(email: string, password: string) {
  const result = await send<{ data: { accessToken: string } }>('/auth/login', 'POST', {
    email,
    password,
  });
  accessToken = result.data.accessToken;
}

export async function signOut() {
  await send('/auth/logout', 'POST');
  accessToken = null;
}

export function publicApi<T>(path: string, body: unknown) {
  return send<T>(path, 'POST', body);
}

export function clearSession() {
  accessToken = null;
}
