import { apiJson } from "./api";

export function nameIncludes(name, keyword) {
  return String(name ?? "").normalize("NFKC").toLowerCase().includes(keyword.trim().normalize("NFKC").toLowerCase());
}

// Use bounded requests, then filter/sort the full collection rather than one visible page.
export async function readCollection(path, { signal, parameters = {}, idKey = "id" } = {}) {
  const records = new Map();
  for (let page = 0; ; page += 1) {
    const query = new URLSearchParams({ page: String(page), size: "100", ...parameters });
    const result = await apiJson(`${path}?${query}`, { signal });
    if (signal?.aborted) throw new DOMException("Request cancelled", "AbortError");
    const items = Array.isArray(result) ? result : result?.items;
    if (!Array.isArray(items)) throw new Error("Invalid collection response.");
    items.forEach(item => records.set(item[idKey], item));
    if (Array.isArray(result) || result.last || page + 1 >= result.totalPages) break;
    if (!Number.isInteger(result.totalPages) || result.page !== page) throw new Error("Invalid pagination response.");
  }
  return [...records.values()];
}

export function collectionPage(items, requestedPage, size) {
  const totalPages = Math.ceil(items.length / size);
  const page = Math.min(Math.max(0, requestedPage), Math.max(0, totalPages - 1));
  return { items: items.slice(page * size, (page + 1) * size), page, size, totalPages, totalElements: items.length, first: page === 0, last: page >= totalPages - 1 };
}

const names = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
export function orderAlerts(items, field, direction) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const compared = field === "systemName" ? names.compare(a.systemName ?? "", b.systemName ?? "") : (Date.parse(a.createdTime) || 0) - (Date.parse(b.createdTime) || 0);
    return multiplier * (compared || Number(a.alertId) - Number(b.alertId));
  });
}
