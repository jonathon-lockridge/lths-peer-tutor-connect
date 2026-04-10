import { ApiResponse } from "@lths/shared";

const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api";

// Set by App.tsx once Clerk is loaded
type TokenGetter = () => Promise<string | null>;
let getAuthToken: TokenGetter = async () => null;

export function setAuthTokenGetter(fn: TokenGetter) {
  getAuthToken = fn;
}

/** Call this anywhere you need a raw Bearer token (e.g. multipart uploads) */
export { getAuthToken };

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const token = await getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
    ...options,
  });
  const json: ApiResponse<T> = await res.json();
  if (!res.ok) {
    throw new Error(json.error ?? "Something went wrong");
  }
  return json;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
