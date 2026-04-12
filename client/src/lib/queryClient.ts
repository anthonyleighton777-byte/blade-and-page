import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
// When deployed on Render/Railway, API_BASE is empty and relative URLs work because
// Express serves both the API and the static frontend on the same port.

// Auth token — persisted in a cookie so it survives page refresh and Render restarts
const TOKEN_COOKIE = "bap_token";
function readCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${TOKEN_COOKIE}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null;
}
function writeCookie(token: string | null) {
  if (token) {
    // 10 years
    const expires = new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)};expires=${expires};path=/;SameSite=Lax`;
  } else {
    document.cookie = `${TOKEN_COOKIE}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }
}

let _authToken: string | null = readCookie();
export function setAuthToken(token: string | null) { _authToken = token; writeCookie(token); }
export function getAuthToken() { return _authToken; }

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const h: Record<string, string> = { ...extra };
  if (_authToken) h["Authorization"] = `Bearer ${_authToken}`;
  return h;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers = data
    ? authHeaders({ "Content-Type": "application/json" })
    : authHeaders();
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey[0]}`, {
      headers: authHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
