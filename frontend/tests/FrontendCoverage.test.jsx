import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import AlertCenter from "../src/AlertCenter";
import Login from "../src/Login";
import App from "../src/App";
import SystemsPage from "../src/SystemsPage";
import SystemDetails from "../src/SystemDetails";
import { MetricTrend } from "../src/Charts";

afterEach(() => vi.restoreAllMocks());
const alert = { alertId: 1, systemName: "Test API", alertType: "HIGH_CPU", severity: "WARNING",
  message: "Test threshold breach", status: "ACTIVE", createdTime: "2026-10-18T00:00:00Z" };
const page = (items = [], overrides = {}) => ({ items, page: 0, size: 5,
  totalElements: items.length, totalPages: items.length ? 1 : 0, first: true, last: true, ...overrides });
const response = (data, status = 200, message = "Success") => ({ ok: status < 400, status,
  json: async () => ({ success: status < 400, data, message }) });
const operations = { role: "OPERATIONS" };
function fillLogin() {
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "  qa.user  " } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: " password with spaces " } });
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
}

describe("Authentication and session boundaries", () => {
  test("trims username but preserves the exact password", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response({ token: "test" }))
      .mockResolvedValueOnce(response({ username: "qa.user", role: "OPERATIONS" }));
    const onLogin = vi.fn();
    render(<Login onLogin={onLogin} />);
    fillLogin();
    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ username: "qa.user", password: " password with spaces " });
  });
  test("does not submit credentials if CSRF acquisition fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(null, 503));
    render(<Login onLogin={vi.fn()} />);
    fillLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to connect");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  test("network failure produces a recoverable login error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network offline"));
    render(<Login onLogin={vi.fn()} />);
    fillLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to connect");
    expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
  });
  test("failed session restoration returns to the login form", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Network offline"));
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("Alert permissions and error handling", () => {
  test("starts with ALL filter and disables both boundaries on a single page", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(page([alert])));
    render(<AlertCenter currentUser={operations} />);
    await screen.findByText("Test API");
    expect(screen.getByLabelText("Status")).toHaveValue("ALL");
    expect(fetch.mock.calls[0][0]).toBe("/api/alerts?page=0&size=5");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
  test("ALL filter omits the status parameter", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(page([alert])));
    render(<AlertCenter currentUser={operations} />);
    await screen.findByText("Test API");
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ALL" } });
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/alerts?page=0&size=5", expect.anything()));
  });
  test("resolved alerts have no further action buttons", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(page([{ ...alert, status: "RESOLVED" }])));
    render(<AlertCenter currentUser={operations} />);
    await screen.findByText("Test API");
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
    expect(screen.getByText("No action required")).toBeInTheDocument();
  });
  test("failed alert retrieval can be retried", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(null, 500))
      .mockResolvedValueOnce(response(page([alert])));
    render(<AlertCenter currentUser={operations} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load alerts");
    fireEvent.click(screen.getByRole("button", { name: "Refresh alerts" }));
    expect(await screen.findByText("Test API")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  test("failed CSRF blocks the alert mutation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(page([alert])))
      .mockResolvedValueOnce(response(null, 403, "CSRF rejected"));
    render(<AlertCenter currentUser={operations} />);
    fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("CSRF rejected");
    expect(fetch.mock.calls.some(([, options]) => options.method === "PATCH")).toBe(false);
  });
  test("server permission denial is shown without success feedback", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(page([alert])))
      .mockResolvedValueOnce(response({ token: "test" }))
      .mockResolvedValueOnce(response(null, 403, "Access denied"));
    render(<AlertCenter currentUser={operations} />);
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
    expect(screen.queryByText(/successfully/)).not.toBeInTheDocument();
  });
  test.each(["csrf", "mutation"])("401 during %s expires the UI session", async (stage) => {
    const onSessionExpired = vi.fn();
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(page([alert])));
    if (stage === "mutation") fetch.mockResolvedValueOnce(response({ token: "test" }));
    fetch.mockResolvedValueOnce(response(null, 401, "Authentication required"));
    render(<AlertCenter currentUser={operations} onSessionExpired={onSessionExpired} />);
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledOnce());
  });
  test("filter changes reset pagination to the first page", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(page([alert], { totalPages: 2, totalElements: 6, last: false })))
      .mockResolvedValueOnce(response(page([alert], { page: 1, first: false, totalPages: 2, totalElements: 6 })))
      .mockResolvedValueOnce(response(page([])));
    render(<AlertCenter currentUser={operations} />);
    await screen.findByText("Test API");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText(/Page 2 of 2/);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "RESOLVED" } });
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith("/api/alerts?page=0&size=5&status=RESOLVED", expect.anything()));
  });
});

describe("Data display and accessible navigation", () => {
  test("system cards are native focusable controls that open details", async () => {
    const system = { id: 2, name: "Keyboard API", type: "SERVICE", host: "keyboard.test", status: "HEALTHY" };
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(response(
      url === "/api/dashboard/summary" ? { total: 1, healthy: 1, warning: 0, critical: 0, offline: 0 } :
      url.startsWith("/api/systems/page") ? page([system]) : url.includes("/metrics/history?") ? { items: [] } : { ...system, metricDataStatus: "NO_DATA", statusReasons: ["No metric data is available"] }
    )));
    render(<SystemsPage />);
    const card = await screen.findByRole("button", { name: /Keyboard API/ });
    expect(card.tagName).toBe("BUTTON");
    card.focus();
    expect(card).toHaveFocus();
    fireEvent.click(card);
    expect(await screen.findByText(/No measurements are available/)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/systems/2", expect.anything());
  });
  test("detail metrics retain health reasons, raw records and both trend charts", async () => {
    const system = { id: 2, name: "Metrics API", status: "WARNING", type: "SERVICE", host: "metrics.test" };
    vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(response(url.includes("/metrics/history?") ?
      [{ metricId: 1, timestamp: "2026-10-18T00:00:00Z", cpuUsage: 80, memoryUsage: 70, responseTime: 600, availability: true }] :
      { ...system, metricDataStatus: "STALE", statusReasons: ["Latest metric data is stale"] })));
    render(<SystemDetails system={system} />);
    expect(await screen.findByText(/latest reading is outside the current update window/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Recent Metrics" }));
    expect(await screen.findByRole("img", { name: /Resource usage/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Response time/ })).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("600 ms")).toBeInTheDocument();
  });
  test("invalid timestamps are excluded and null values produce no chart points", () => {
    render(<MetricTrend title="Invalid metrics" unit="ms" series={[{ key: "responseTime", label: "Response", color: "blue" }]}
      metrics={[{ timestamp: "invalid", responseTime: 12 }, { timestamp: "2026-10-18T00:00:00Z", responseTime: null }]} />);
    expect(screen.getByText("No recorded metrics to chart yet.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
  test("primary navigation opens alert filters and returns to the dashboard", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(response(
      url === "/api/auth/me" ? { username: "qa.manager", role: "MANAGEMENT" } :
      url === "/api/health" ? { status: "UP", service: "test", timestamp: "2026-10-18T00:00:00Z" } :
      url === "/api/dashboard/summary" ? { total: 0, healthy: 0, warning: 0, critical: 0, offline: 0 } : page([]))));
    render(<App />);
    fireEvent.click(await screen.findByRole("link", { name: "Alert Center" }));
  await waitFor(() => expect(window.location.hash).toBe("#alerts"));
    expect(await screen.findByRole("heading", { name: "Alert Center", level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toHaveValue("ALL");
    expect(screen.getByRole("link", { name: "Alert Center" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("link", { name: "Dashboard" }));
  await waitFor(() => expect(window.location.hash).toBe("#dashboard"));
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Status")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Metric retention" })).not.toBeInTheDocument();
  });
});
