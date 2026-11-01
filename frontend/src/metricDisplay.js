export function formatMetric(value, unit = "") {
  return typeof value === "number" && Number.isFinite(value)
    ? `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unit}`
    : "No data";
}

export function formatTime(value) {
  if (!value) return "No measurement";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

export function readingUpdateLabel(status) {
  return { FRESH: "Recent data", STALE: "Outdated data", NO_DATA: "No readings" }[status] || "Update status unknown";
}

export function systemHealthDisplay(system) {
  if (system.metricDataStatus === "NO_DATA" || !system.latestMetric) {
    return { label: "No data", className: "status-no-data" };
  }
  return { label: system.status, className: `status-${system.status.toLowerCase()}` };
}
