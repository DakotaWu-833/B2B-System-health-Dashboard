import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Dashboard from "../src/Dashboard";
import SystemsPage from "../src/SystemsPage";
import App from "../src/App";
import SystemForm from "../src/SystemForm";
import Profile from "../src/Profile";
import SystemDetails from "../src/SystemDetails";

afterEach(() => vi.restoreAllMocks());
const reply = (data, status = 200, message = "Success") => ({ ok: status < 400, status, json: async () => ({ success: status < 400, data, message }) });
const paged = (items, extra = {}) => ({ items, page: 0, size: 10, totalElements: items.length, totalPages: items.length ? 1 : 0, first: true, last: true, ...extra });
const summary = { total: 1, healthy: 1, warning: 0, critical: 0, offline: 0, activeAlertCount: 1,
  averageCpuUsage: 0, averageMemoryUsage: null, averageResponseTime: 0, evaluatedAt: "2026-10-18T00:00:00Z" };
const system = { id: 1, name: "Integrated API", type: "SERVICE", host: "integrated.test", status: "HEALTHY", metricDataStatus: "NO_DATA" };
const emptyAlerts = paged([], { size: 5 });

test("paged systems retain real zeros, missing metrics and management read-only access", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(reply(
    url === "/api/dashboard/summary" ? summary : url.startsWith("/api/systems/page") ? paged([system]) : emptyAlerts)));
  render(<><Dashboard /><SystemsPage currentUser={{ role: "MANAGEMENT" }} /></>);
  const row = await screen.findByRole("button", { name: /Integrated API.*SERVICE/ });
  expect(within(row).getAllByText("No data")).toHaveLength(3);
  expect(within(row).getByText("No measurement")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Average CPU" }).closest("article")).toHaveTextContent("0%");
  expect(screen.getByRole("heading", { name: "Average memory" }).closest("article")).toHaveTextContent("No data");
  expect(screen.queryByRole("button", { name: "Add system" })).not.toBeInTheDocument();
  expect(fetch.mock.calls.some(([url]) => url === "/api/systems")).toBe(false);
});

test("system page navigation requests only the next bounded page", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(reply(
    url === "/api/dashboard/summary" ? summary : url.startsWith("/api/systems/page?page=1") ? paged([{ ...system, id: 2, name: "Second page API" }], { page: 1, first: false, totalPages: 2, totalElements: 11 }) :
    url.startsWith("/api/systems/page") ? paged([system], { last: false, totalPages: 2, totalElements: 11 }) : emptyAlerts)));
  render(<SystemsPage currentUser={{ role: "MANAGEMENT" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Next page" }));
  expect(await screen.findByRole("button", { name: /Second page API.*SERVICE/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Integrated API.*SERVICE/ })).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/systems/page?page=1&size=12", expect.objectContaining({ credentials: "include" }));
});

test("successful alert mutation preserves feedback and the overview loads the current summary", async () => {
  let resolved = false;
  const alert = { alertId: 1, systemName: "Alert API", alertType: "HIGH_CPU", status: "ACTIVE", severity: "WARNING", message: "CPU warning", createdTime: "2026-10-18T00:00:00Z" };
  vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
    if (url === "/api/auth/me") return Promise.resolve(reply({ username: "integrated.ops", role: "OPERATIONS" }));
    if (url === "/api/health") return Promise.resolve(reply({ status: "UP" }));
    if (url === "/api/dashboard/summary") return Promise.resolve(reply({ ...summary, activeAlertCount: resolved ? 0 : 1 }));
    if (url.startsWith("/api/systems/page")) return Promise.resolve(reply(paged([system])));
    if (url === "/api/auth/csrf") return Promise.resolve(reply({ token: "test", headerName: "X-CSRF-TOKEN" }));
    if (options.method === "PATCH") { resolved = true; return Promise.resolve(reply({ ...alert, status: "RESOLVED" })); }
    return Promise.resolve(reply(resolved ? emptyAlerts : paged([alert], { size: 5 })));
  });
  render(<App />);
  fireEvent.click(await screen.findByRole("link", { name: "Alert Center" }));
  await waitFor(() => expect(window.location.hash).toBe("#alerts"));
  fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
  expect(await screen.findByText(/alert acknowledged successfully/)).toBeInTheDocument();
  expect(screen.getByLabelText("Status")).toHaveValue("ALL");
  fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
  await waitFor(() => expect(window.location.hash).toBe("#dashboard"));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Active alerts" }).closest("article")).toHaveTextContent("0"));
});

test("system form preserves input on 409 and uses a fresh CSRF token", async () => {
  const saved = vi.fn();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(url === "/api/auth/csrf" ?
    reply({ token: "fresh", headerName: "X-CSRF-TOKEN" }) : reply(null, 409, "Duplicate system")));
  render(<SystemForm onSaved={saved} onCancel={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Existing API" } });
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "SERVICE" } });
  fireEvent.change(screen.getByLabelText("Host"), { target: { value: "existing.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Create system" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  expect(screen.getByLabelText("Name")).toHaveValue("Existing API");
  expect(saved).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledWith("/api/systems", expect.objectContaining({ method: "POST", headers: expect.objectContaining({ "X-CSRF-TOKEN": "fresh" }) }));
});

test("profile completes save, delivery, confirmation and verified-state presentation", async () => {
  let profile = { id: 1, username: "ops", role: "OPERATIONS", email: null, emailVerified: false };
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
    if (url === "/api/auth/csrf") return Promise.resolve(reply({ token: "fresh" }));
    if (url.endsWith("/confirm")) { profile = { ...profile, emailVerified: true }; return Promise.resolve(reply(profile)); }
    if (url.endsWith("/email-verification")) return Promise.resolve(reply({ resendAt: new Date(Date.now() + 60000).toISOString() }));
    if (options.method === "PUT") profile = { ...profile, email: JSON.parse(options.body).email.toLowerCase(), emailVerified: false };
    return Promise.resolve(reply(profile));
  });
  render(<Profile />);
  expect(await screen.findByText("No email address")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "Owner@Example.test" } });
  fireEvent.click(screen.getByRole("button", { name: "Save email address" }));
  fireEvent.click(await screen.findByRole("button", { name: "Send verification code" }));
  expect(await screen.findByText(/Check your inbox/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  expect(await screen.findByText("Verified")).toBeInTheDocument();
  expect(screen.queryByLabelText("Verification code")).not.toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, options]) => options.method === "POST")).toHaveLength(2);
});

test("profile verification errors do not falsely mark an address verified", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(url === "/api/profile" ?
    reply({ username: "manager", role: "MANAGEMENT", email: "manager@example.test", emailVerified: false }) :
    url === "/api/auth/csrf" ? reply({ token: "test" }) : reply(null, 410, "This code has expired")));
  render(<Profile />);
  fireEvent.change(await screen.findByLabelText("Verification code"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("expired");
  expect(screen.getByText("Not verified")).toBeInTheDocument();
});

test("profile session expiry returns control to the application", async () => {
  const expired = vi.fn();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(null, 401, "Authentication required"));
  render(<Profile onSessionExpired={expired} />);
  await waitFor(() => expect(expired).toHaveBeenCalledOnce());
});

test("detail uses returned thresholds and follows the server history cursor", async () => {
  const details = { ...system, description: "test", statusReasons: [], evaluatedThresholds: { cpuWarning: 70, cpuCritical: 90, memoryWarning: 65, memoryCritical: 85, responseTimeWarning: 400, responseTimeCritical: 900 } };
  vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(reply(url === "/api/systems/1" ? details :
    { items: [{ metricId: url.includes("cursor") ? 2 : 1, timestamp: "2026-10-18T00:00:00Z", cpuUsage: url.includes("cursor") ? 30 : 20, memoryUsage: 10, responseTime: 100, availability: true }], nextCursor: url.includes("cursor") ? null : "opaque-cursor", hasMore: !url.includes("cursor") })));
  render(<SystemDetails system={system} />);
  expect(await screen.findByText("CPU: Warning ≥ 70%; Critical ≥ 90%.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Recent Metrics" }));
  expect(await screen.findByText("20%")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(await screen.findByText("30%")).toBeInTheDocument();
  expect(screen.queryByText("20%")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
  expect(await screen.findByText("20%")).toBeInTheDocument();
});


test("profile can recover from a network failure by retrying its initial load", async () => {
  const fetch = vi.spyOn(globalThis, "fetch")
    .mockRejectedValueOnce(new TypeError("Network offline"))
    .mockResolvedValueOnce(reply({ username: "recovered.ops", role: "OPERATIONS", email: "recovered@example.test", emailVerified: true }));
  render(<Profile />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load your profile. Check your connection and try again.");
  expect(screen.queryByLabelText("Email address")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry profile" }));
  expect(await screen.findByRole("heading", { name: "recovered.ops" })).toBeInTheDocument();
  expect(screen.getByLabelText("Email address")).toHaveValue("recovered@example.test");
  expect(screen.getByText("Verified")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Retry profile" })).not.toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenLastCalledWith("/api/profile", expect.objectContaining({ credentials: "include", signal: expect.any(AbortSignal) }));
});
