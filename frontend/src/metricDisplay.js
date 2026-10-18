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
