import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AlertCenter from "../src/AlertCenter";
import Login from "../src/Login";

afterEach(() => vi.restoreAllMocks());
const alert = { alertId: 6, systemName: "Last-page API", alertType: "HIGH_CPU", severity: "WARNING",
  message: "Test breach", status: "ACTIVE", createdTime: "2026-10-18T00:00:00Z" };
const response = data => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const page = (items, overrides = {}) => ({ items, page: 0, size: 5, totalElements: 6,
  totalPages: 2, first: true, last: false, ...overrides });

test("regression: processing the last alert on the last page must return to a valid page", async () => {
  let updated = false;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
    if (url === "/api/auth/csrf") return Promise.resolve(response({ token: "test" }));
    if (options.method === "PATCH") { updated = true; return Promise.resolve(response({ ...alert, status: "ACKNOWLEDGED" })); }
    if (url.includes("page=1")) return Promise.resolve(response(page(updated ? [] : [alert], {
      page: 1, first: false, last: true, totalElements: updated ? 5 : 6, totalPages: updated ? 1 : 2,
    })));
    return Promise.resolve(response(page([{ ...alert, alertId: 1, systemName: "Earlier-page API" }], updated ? { totalElements: 5, totalPages: 1, last: true } : {})));
  });
  render(<AlertCenter currentUser={{ role: "OPERATIONS" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Next" }));
  await screen.findByText("Last-page API");
  fireEvent.click(screen.getByRole("button", { name: "Acknowledge" }));
  await screen.findByText("Last-page API alert acknowledged successfully.");
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.includes("/api/alerts?page=0"))).toHaveLength(2));
  expect(screen.getByText("Earlier-page API")).toBeInTheDocument();
});

test("regression: another alert action must not start while an update is pending", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(url => url === "/api/auth/csrf" ? new Promise(() => {}) :
    Promise.resolve(response(page([alert, { ...alert, alertId: 7, systemName: "Second API" }], { totalElements: 2, totalPages: 1, last: true }))));
  render(<AlertCenter currentUser={{ role: "OPERATIONS" }} />);
  await screen.findByText("Last-page API");
  fireEvent.click(screen.getAllByRole("button", { name: "Acknowledge" })[0]);
  expect(screen.getAllByRole("button", { name: "Acknowledge" })[1]).toBeDisabled();
});

test("regression: a late refresh response must not overwrite the selected filter", async () => {
  let completeOldRefresh;
  let activeCalls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(url => {
    if (url.includes("status=ACTIVE") && ++activeCalls === 2) {
      return new Promise(resolve => { completeOldRefresh = resolve; });
    }
    return Promise.resolve(response(page(url.includes("status=RESOLVED") ? [{ ...alert, status: "RESOLVED", systemName: "Resolved API" }] : [alert], {
      totalElements: 1, totalPages: 1, last: true,
    })));
  });
  render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} />);
  await screen.findByText("Last-page API");
  fireEvent.click(screen.getByRole("button", { name: "Refresh alerts" }));
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "RESOLVED" } });
  await screen.findByText("Resolved API");
  await act(async () => completeOldRefresh(response(page([alert], { totalElements: 1, totalPages: 1, last: true }))));
  expect(screen.getByLabelText("Status")).toHaveValue("RESOLVED");
  expect(screen.queryByText("Last-page API")).not.toBeInTheDocument();
});

test("regression: repeated login clicks must not launch overlapping authentication requests", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => new Promise(() => {}));
  render(<Login onLogin={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "qa.user" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-only-password" } });
  const form = screen.getByRole("button", { name: "Login" }).closest("form");
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(fetch).toHaveBeenCalledTimes(1);
});

test("login submission is disabled while pending and unlocked after failure", async () => {
  let completeCsrf;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => new Promise(resolve => { completeCsrf = resolve; }))
    .mockResolvedValue({ ok: false, status: 401, json: async () => ({ success: false, message: "Invalid credentials" }) });
  render(<Login onLogin={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Username"), { target: { value: "qa.user" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-only-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Login" }));
  expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
  await act(async () => completeCsrf(response({ token: "test" })));
  expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Login" })).toBeEnabled();
  expect(fetch).toHaveBeenCalledTimes(2);
});

test("a stale response body cannot replace a newer filter after JSON parsing", async () => {
  let finishOldJson;
  let activeCalls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(url => {
    if (url.includes("status=ACTIVE") && ++activeCalls === 2) return Promise.resolve({
      ok: true, status: 200, json: () => new Promise(resolve => { finishOldJson = resolve; }),
    });
    return Promise.resolve(response(page(url.includes("status=RESOLVED") ?
      [{ ...alert, status: "RESOLVED", systemName: "New filtered API" }] : [alert], { totalPages: 1, last: true })));
  });
  render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} />);
  await screen.findByText("Last-page API");
  fireEvent.click(screen.getByRole("button", { name: "Refresh alerts" }));
  await waitFor(() => expect(finishOldJson).toBeTypeOf("function"));
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "RESOLVED" } });
  await screen.findByText("New filtered API");
  await act(async () => finishOldJson({ success: true, data: page([alert]) }));
  expect(screen.getByText("New filtered API")).toBeInTheDocument();
  expect(screen.queryByText("Last-page API")).not.toBeInTheDocument();
});

test("superseded 401 responses do not expire a newer successful session", async () => {
  let completeOld;
  let activeCalls = 0;
  const onSessionExpired = vi.fn();
  vi.spyOn(globalThis, "fetch").mockImplementation(url => {
    if (url.includes("status=ACTIVE") && ++activeCalls === 2) return new Promise(resolve => { completeOld = resolve; });
    return Promise.resolve(response(page([alert], { totalPages: 1, last: true })));
  });
  render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} onSessionExpired={onSessionExpired} />);
  await screen.findByText("Last-page API");
  fireEvent.click(screen.getByRole("button", { name: "Refresh alerts" }));
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "ALL" } });
  await screen.findByText("Last-page API");
  await act(async () => completeOld({ ok: false, status: 401 }));
  expect(onSessionExpired).not.toHaveBeenCalled();
});

test("a failed mutation unlocks filters and allows refresh and retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(page([alert], { totalPages: 1, last: true })))
    .mockResolvedValueOnce(response({ token: "test" }))
    .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ success: false, message: "Access denied" }) })
    .mockResolvedValueOnce(response(page([alert], { totalPages: 1, last: true })));
  render(<AlertCenter currentUser={{ role: "OPERATIONS" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
  await screen.findByText("Access denied");
  expect(screen.getByLabelText("Status")).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh alerts" }));
  expect(await screen.findByRole("button", { name: "Acknowledge" })).toBeEnabled();
});
