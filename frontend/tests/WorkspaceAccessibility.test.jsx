import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "../src/App";
import Login from "../src/Login";
import SystemDetails from "../src/SystemDetails";

const reply = data => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const system = { id: 1, name: "Accessible API", type: "SERVICE", host: "accessible.test", status: "HEALTHY" };
const page = items => ({ items, page: 0, size: 5, totalElements: items.length, totalPages: items.length ? 1 : 0, first: true, last: true });
function mockWorkspace() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(reply(
    url === "/api/auth/me" ? { username: "qa.operations", role: "OPERATIONS" } :
    url === "/api/health" ? { status: "UP" } :
    url === "/api/dashboard/summary" ? { total: 1, healthy: 1, warning: 0, critical: 0, offline: 0, activeAlertCount: 1 } :
    url.startsWith("/api/systems/page") ? page([system]) :
    url.startsWith("/api/alerts?") ? page([{ alertId: 1, systemName: system.name, alertType: "HIGH_CPU", severity: "WARNING", status: "ACTIVE", message: "CPU high", createdTime: "2026-10-18T00:00:00Z" }]) :
    url === "/api/auth/csrf" ? { token: "test" } : { ...system, metricDataStatus: "NO_DATA", statusReasons: [] }
  )));
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test("password visibility keeps the entered value and does not submit authentication", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const onLogin = vi.fn();
  render(<Login onLogin={onLogin} />);
  const password = screen.getByLabelText("Password");
  fireEvent.change(password, { target: { value: "my entered password" } });
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));
  expect(password).toHaveAttribute("type", "text");
  expect(password).toHaveValue("my entered password");
  expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(password).toHaveAttribute("type", "password");
  expect(fetch).not.toHaveBeenCalled();
  expect(onLogin).not.toHaveBeenCalled();
});

test("collapsed navigation keeps named destinations and logout available", async () => {
  mockWorkspace();
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Collapse sidebar" }));
  expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute("aria-expanded", "false");
  for (const name of ["Dashboard", "System", "Alert Center", "My profile", "Metric retention"]) {
    expect(screen.getByRole("link", { name })).toHaveAccessibleName(name);
  }
  expect(screen.getByRole("button", { name: "Logout" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Account menu for qa.operations" }));
  expect(screen.getByRole("link", { name: "Account settings" })).toHaveAttribute("href", "#profile");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(screen.queryByRole("link", { name: "Account settings" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
  expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute("aria-expanded", "true");
});

test("mobile navigation supports Escape and restores focus to its opener", async () => {
  mockWorkspace();
  render(<App />);
  const opener = await screen.findByRole("button", { name: "Open navigation" });
  opener.focus();
  fireEvent.click(opener);
  expect(opener).toHaveAttribute("aria-expanded", "true");
  expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(opener).toHaveAttribute("aria-expanded", "false");
  expect(opener).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
});

test("system detail arrow keys skip the disabled management submission tab", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(reply(
    url.includes("metrics/history") ? { items: [], nextCursor: null } : { ...system, metricDataStatus: "NO_DATA", statusReasons: [] }
  )));
  render(<SystemDetails system={system} currentUser={{ role: "MANAGEMENT" }} />);
  await screen.findByText("Accessible API");
  const basic = screen.getByRole("tab", { name: "Basic information" });
  const history = screen.getByRole("tab", { name: "Recent Metrics" });
  basic.focus();
  fireEvent.keyDown(basic, { key: "ArrowRight" });
  expect(history).toHaveFocus();
  expect(history).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", history.id);
  fireEvent.keyDown(history, { key: "ArrowRight" });
  expect(basic).toHaveFocus();
  expect(basic).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Submit a metric reading" })).toBeDisabled();
});

test("undoing a scheduled alert resolution sends no mutation", async () => {
  const fetch = mockWorkspace();
  render(<App />);
  fireEvent.click(await screen.findByRole("link", { name: "Alert Center" }));
  await waitFor(() => expect(window.location.hash).toBe("#alerts"));
  const resolve = await screen.findByRole("button", { name: "Resolve" });
  vi.useFakeTimers();
  fireEvent.click(resolve);
  expect(screen.getByRole("button", { name: "Undo resolve" })).toBeEnabled();
  expect(fetch.mock.calls.some(([, options]) => options.method === "PATCH")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Undo resolve" }));
  await act(async () => { vi.advanceTimersByTime(11000); });
  expect(screen.getByText("Resolution cancelled. Accessible API alert remains ACTIVE.")).toBeInTheDocument();
  expect(fetch.mock.calls.some(([, options]) => options.method === "PATCH")).toBe(false);
  expect(screen.getByRole("button", { name: "Resolve" })).toBeEnabled();
});


test("moving from mobile to desktop closes the drawer and releases its scroll lock", async () => {
  const listeners = new Set();
  const media = {
    matches: true,
    media: "(max-width: 760px)",
    addEventListener: vi.fn((event, callback) => { if (event === "change") listeners.add(callback); }),
    removeEventListener: vi.fn((event, callback) => { if (event === "change") listeners.delete(callback); }),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => media));
  mockWorkspace();
  render(<App />);
  const opener = await screen.findByRole("button", { name: "Open navigation" });
  opener.focus();
  fireEvent.click(opener);
  expect(opener).toHaveAttribute("aria-expanded", "true");
  expect(document.body.style.overflow).toBe("hidden");
  expect(screen.getByRole("button", { name: "Close navigation" })).toBeInTheDocument();
  act(() => {
    media.matches = false;
    for (const callback of listeners) callback({ matches: false, media: media.media });
  });
  expect(opener).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("button", { name: "Close navigation" })).not.toBeInTheDocument();
  expect(document.body.style.overflow).toBe("");
  expect(opener).toHaveFocus();
  expect(screen.getByRole("complementary", { name: "Application sidebar" })).not.toHaveClass("is-mobile-open");
});
