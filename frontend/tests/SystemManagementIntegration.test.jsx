import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "../src/App";
import SystemsPage from "../src/SystemsPage";
import AlertsPage from "../src/AlertsPage";
import SystemForm from "../src/SystemForm";

afterEach(() => vi.restoreAllMocks());
const reply = (data, status = 200) => ({ ok: status < 400, status, json: async () => ({ success: status < 400, data }) });
const page = (items, extra = {}) => ({ items, page: 0, size: 10, totalElements: items.length,
  totalPages: items.length ? 1 : 0, first: true, last: true, ...extra });
const system = { id: 1, name: "Review API", type: "SERVICE", host: "review.test", status: "HEALTHY", metricDataStatus: "NO_DATA" };
const summary = { total: 1, healthy: 1, warning: 0, critical: 0, offline: 0, activeAlertCount: 0,
  averageCpuUsage: 0, averageMemoryUsage: null, averageResponseTime: 0, evaluatedAt: "2026-10-19T00:00:00Z" };
const reading = { metricId: 1, cpuUsage: 90, memoryUsage: 10, responseTime: 100, availability: true, timestamp: "2026-10-19T00:00:00Z" };

test("creation trims fields, uses the server CSRF header and blocks overlapping submissions", async () => {
  let finishCsrf;
  const saved = vi.fn();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => url === "/api/auth/csrf"
    ? new Promise(resolve => { finishCsrf = resolve; }) : Promise.resolve(reply(system, 201)));
  render(<SystemForm onSaved={saved} onCancel={vi.fn()} />);
  for (const [label, value] of [["Name", " Review API "], ["Type", " SERVICE "], ["Host", " review.test "]]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
  const form = screen.getByRole("button", { name: "Create system" }).closest("form");
  fireEvent.submit(form); fireEvent.submit(form);
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => finishCsrf(reply({ token: "fresh", headerName: "X-Review-CSRF" })));
  await waitFor(() => expect(saved).toHaveBeenCalledWith(system));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledWith("/api/systems", expect.objectContaining({ method: "POST",
    headers: expect.objectContaining({ "X-Review-CSRF": "fresh" }),
    body: JSON.stringify({ name: "Review API", type: "SERVICE", host: "review.test", description: null }) }));
});

test("editing preserves the existing description and sends PUT for the selected system", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(reply(url === "/api/auth/csrf"
    ? { token: "fresh" } : { ...system, host: "new.test", description: "Existing context" })));
  const saved = vi.fn();
  render(<SystemForm system={{ ...system, description: "Existing context" }} onSaved={saved} onCancel={vi.fn()} />);
  expect(screen.getByLabelText("Description (optional)")).toHaveValue("Existing context");
  fireEvent.change(screen.getByLabelText("Host"), { target: { value: "new.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(fetch).toHaveBeenCalledWith("/api/systems/1", expect.objectContaining({ method: "PUT",
    body: expect.stringContaining('"description":"Existing context"') }));
});

test("a manual reading refreshes system cards and subsequent overview and filtered alert views", async () => {
  let submitted = false;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
    if (url === "/api/auth/me") return Promise.resolve(reply({ username: "review.ops", role: "OPERATIONS" }));
    if (url === "/api/health") return Promise.resolve(reply({ status: "UP" }));
    if (url === "/api/auth/csrf") return Promise.resolve(reply({ token: "fresh" }));
    if (options.method === "POST") { submitted = true; return Promise.resolve(reply(reading, 201)); }
    if (url === "/api/dashboard/summary") return Promise.resolve(reply(submitted ? { ...summary, activeAlertCount: 1, averageCpuUsage: 90 } : summary));
    const current = submitted ? { ...system, status: "CRITICAL", metricDataStatus: "FRESH", latestMetric: reading, lastUpdated: reading.timestamp } : system;
    if (url.startsWith("/api/systems/page")) return Promise.resolve(reply(page([current])));
    if (url.includes("/metrics/history?")) return Promise.resolve(reply({ items: submitted ? [reading] : [], nextCursor: null }));
    if (url === "/api/systems/1") return Promise.resolve(reply({ ...current, statusReasons: [] }));
    if (url.startsWith("/api/alerts?")) return Promise.resolve(reply(page(submitted ? [{ alertId: 1, systemName: "Review API", alertType: "HIGH_CPU",
      severity: "CRITICAL", status: "ACTIVE", message: "CPU warning", createdTime: reading.timestamp }] : [])));
    throw new Error(`Unexpected request: ${url}`);
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("link", { name: "System" }));
  await waitFor(() => expect(window.location.hash).toBe("#system"));
  fireEvent.click(await screen.findByRole("button", { name: /Review API SERVICE/ }));
  await screen.findByText("Health thresholds:");
  fireEvent.click(screen.getByRole("tab", { name: "Submit a metric reading" }));
  for (const [label, value] of [["CPU usage (%)", "90"], ["Memory usage (%)", "10"], ["Response time (ms)", "100"]]) {
    fireEvent.change(await screen.findByLabelText(label), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "Submit reading" }));
  await screen.findByText("Metric reading 1 submitted successfully.");
  fireEvent.click(screen.getByRole("button", { name: "Close system dialog" }));
  expect(await screen.findByRole("button", { name: /Review API SERVICE.*CRITICAL/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
  await waitFor(() => expect(window.location.hash).toBe("#dashboard"));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Average CPU" }).closest("article")).toHaveTextContent("90%"));
  expect(screen.getByRole("heading", { name: "Active alerts" }).closest("article")).toHaveTextContent("1");
  fireEvent.click(screen.getByRole("link", { name: "Alert Center" }));
  await waitFor(() => expect(window.location.hash).toBe("#alerts"));
  await screen.findByText("CPU warning");
  fireEvent.change(screen.getByRole("combobox", { name: "System" }), { target: { value: "1" } });
  await waitFor(() => expect(screen.getByRole("combobox", { name: "System" })).toHaveValue("1"));
  expect(screen.getByLabelText("Status")).toHaveValue("ALL");
  expect(fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(1);
  expect(fetch.mock.calls.some(([url]) => url === "/api/alerts?page=0&size=5&systemId=1")).toBe(true);
});

test("Management can inspect details but cannot see system or metric write controls", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(reply(url === "/api/dashboard/summary" ? summary :
    url.startsWith("/api/systems/page") ? page([system]) : url.includes("/metrics/history?") ? { items: [] } :
    url === "/api/systems/1" ? { ...system, statusReasons: [] } : page([]))));
  render(<SystemsPage currentUser={{ role: "MANAGEMENT" }} />);
  fireEvent.click(await screen.findByRole("button", { name: /Review API SERVICE/ }));
  await screen.findByText("Health thresholds:");
  expect(screen.queryByRole("button", { name: "Add system" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit Review API" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Submit reading" })).not.toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Submit a metric reading" })).toBeDisabled();
});

test("the alert system filter loads additional systems with bounded requests", async () => {
  const other = { ...system, id: 101, name: "Other page API" };
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(reply(
    url.startsWith("/api/systems/page?page=1") ? page([other], { page: 1, size: 100, first: false, totalPages: 2, totalElements: 101 }) :
    url.startsWith("/api/systems/page") ? page([system], { size: 100, totalPages: 2, totalElements: 101, last: false }) : page([]))));
  render(<AlertsPage currentUser={{ role: "MANAGEMENT" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Load more filter systems" }));
  await screen.findByRole("option", { name: "Other page API" });
  fireEvent.change(screen.getByRole("combobox", { name: "System" }), { target: { value: "101" } });
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/alerts?page=0&size=5&systemId=101", expect.anything()));
  expect(fetch).toHaveBeenCalledWith("/api/systems/page?page=1&size=100", expect.anything());
  expect(screen.queryByRole("button", { name: /Other page API SERVICE/ })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => url === "/api/systems")).toBe(false);
});

test("profile navigation retains visible logout failure and allows a successful retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  let logoutAttempts = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
    if (url === "/api/auth/me") return Promise.resolve(reply({ username: "review.ops", role: "OPERATIONS" }));
    if (url === "/api/health") return Promise.resolve(reply({ status: "UP" }));
    if (url === "/api/auth/csrf") return Promise.resolve(reply({ token: "fresh" }));
    if (url === "/api/auth/logout") return Promise.resolve(reply(null, ++logoutAttempts === 1 ? 503 : 200));
    if (url === "/api/profile") return Promise.resolve(reply({ username: "review.ops", role: "OPERATIONS", email: null }));
    return Promise.resolve(reply(url === "/api/dashboard/summary" ? summary : page([])));
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("link", { name: "My profile" }));
  await waitFor(() => expect(window.location.hash).toBe("#profile"));
  await screen.findByRole("heading", { name: "My profile", level: 2 });
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to log out");
  expect(screen.getByRole("heading", { name: "My profile", level: 2 })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Logout" }));
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  expect(logoutAttempts).toBe(2);
});
