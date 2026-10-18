const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export function buildApiUrl(path, baseUrl = configuredApiBaseUrl) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
}

export function apiFetch(path, options = {}) {
  return fetch(buildApiUrl(path), {
    credentials: "include",
    ...options,
  });
}

export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function apiJson(path, options = {}) {
  const response = await apiFetch(path, options);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw new ApiError(result?.message || "Unable to complete this request. Please try again.", response.status);
  }
  return result.data;
}

export async function apiMutation(path, method, body) {
  const csrf = await apiJson("/api/auth/csrf");
  return apiJson(path, {
    method,
    headers: { "Content-Type": "application/json", [csrf.headerName || "X-CSRF-TOKEN"]: csrf.token },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
