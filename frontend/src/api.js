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
