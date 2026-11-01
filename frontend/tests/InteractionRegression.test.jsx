import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AlertCenter from "../src/AlertCenter";
import Login from "../src/Login";

afterEach(() => vi.restoreAllMocks());
const alert = { alertId: 6, systemName: "Last-page API", alertType: "HIGH_CPU", severity: "WARNING",
  message: "Test breach", status: "ACTIVE", createdTime: "2026-10-18T00:00:00Z" };
const response = data => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const page = (items, overrides = {}) => ({ items, page: 0, size: 5, totalElements: 6,
  totalPages: 2, first: true, last: false, ...overrides });

test("regression: processing a later-page alert retains cards from the full board", async () => {
  let updated = false;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((url, options) => {
    if (url === "/api/auth/csrf") return Promise.resolve(response({ token: "test" }));
    if (options.method === "PATCH") { updated = true; return Promise.resolve(response({ ...alert, status: "ACKNOWLEDGED" })); }
    if (url.includes("page=1")) return Promise.resolve(response(page([{ ...alert, status: updated ? "ACKNOWLEDGED" : "ACTIVE" }], { page: 1, first: false, last: true })));
    return Promise.resolve(response(page([{ ...alert, alertId: 1, systemName: "Earlier-page API" }])));
  });
  render(<AlertCenter currentUser={{ role: "OPERATIONS" }} />);
  const card = await screen.findByRole("article", { name: "Last-page API High Cpu alert #6" });
  fireEvent.click(within(card).getByRole("button", { name: "Acknowledge" }));
  await screen.findByText("Last-page API alert acknowledged successfully.");
  await waitFor(() => expect(fetch.mock.calls.filter(([url]) => url.includes("/api/alerts?page=0"))).toHaveLength(2));
  expect(await within(screen.getByRole("region", { name: "Acknowledged alerts" })).findByText("Last-page API")).toBeInTheDocument();
  expect(within(screen.getByRole("region", { name: "Active alerts" })).getByText("Earlier-page API")).toBeInTheDocument();
});

test("regression: another alert action must not start while an update is pending", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(url => url === "/api/auth/csrf" ? new Promise(() => {}) :
    Promise.resolve(response(page([alert, { ...alert, alertId: 7, systemName: "Second API" }], { totalElements: 2, totalPages: 1, last: true }))));
  render(<AlertCenter currentUser={{ role: "OPERATIONS" }} />);
  await screen.findByText("Last-page API");
  fireEvent.click(screen.getAllByRole("button", { name: "Acknowledge" })[0]);
  expect(screen.getByRole("button", { name: "Acknowledge" })).toBeDisabled();
});

test("regression: a late refresh cannot overwrite a newer externally refreshed board", async () => {
  let completeOldRefresh;
  let calls = 0;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    if (++calls === 2) return new Promise(resolve => { completeOldRefresh = resolve; });
    return Promise.resolve(response(page(calls > 2 ? [{ ...alert, status: "RESOLVED", systemName: "Resolved API" }] : [alert], { totalElements: 1, totalPages: 1, last: true })));
  });
  const view = render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} />);
  await screen.findByText("Last-page API");
  fireEvent.click(screen.getByRole("button", { name: "Refresh alerts" }));
  view.rerender(<AlertCenter currentUser={{ role: "MANAGEMENT" }} refreshVersion={1} />);
  await screen.findByText("Resolved API");
  expect(fetch.mock.calls[1][1].signal.aborted).toBe(true);
  await act(async () => completeOldRefresh(response(page([alert], { totalElements: 1, totalPages: 1, last: true }))));
  expect(within(screen.getByRole("region", { name: "Resolved alerts" })).getByText("Resolved API")).toBeInTheDocument();
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

test("a stale response body cannot replace a newer board after JSON parsing", async () => {
  let finishOldJson;
  let calls = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    if (++calls === 2) return Promise.resolve({ ok: true, status: 200, json: () => new Promise(resolve => { finishOldJson = resolve; }) });
    return Promise.resolve(response(page(calls > 2 ? [{ ...alert, status: "RESOLVED", systemName: "New results API" }] : [alert], { totalPages: 1, last: true })));
  });
  const view = render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} />);
  await screen.findByText("Last-page API");
  fireEvent.click(screen.getByRole("button", { name: "Refresh alerts" }));
  await waitFor(() => expect(finishOldJson).toBeTypeOf("function"));
  view.rerender(<AlertCenter currentUser={{ role: "MANAGEMENT" }} refreshVersion={1} />);
  await screen.findByText("New results API");
  await act(async () => finishOldJson({ success: true, data: page([alert]) }));
  expect(screen.getByText("New results API")).toBeInTheDocument();
  expect(screen.queryByText("Last-page API")).not.toBeInTheDocument();
});

test("superseded 401 responses do not expire a newer successful board session", async () => {
  let completeOld;
  let calls = 0;
  const onSessionExpired = vi.fn();
  vi.spyOn(globalThis, "fetch").mockImplementation(() => {
    if (++calls === 2) return new Promise(resolve => { completeOld = resolve; });
    return Promise.resolve(response(page([alert], { totalPages: 1, last: true })));
  });
  const view = render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} onSessionExpired={onSessionExpired} />);
  await screen.findByText("Last-page API");
  fireEvent.click(screen.getByRole("button", { name: "Refresh alerts" }));
  view.rerender(<AlertCenter currentUser={{ role: "MANAGEMENT" }} onSessionExpired={onSessionExpired} refreshVersion={1} />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Refresh alerts" })).toBeEnabled());
  await act(async () => completeOld({ ok: false, status: 401, json: async () => ({ success: false, message: "Authentication required" }) }));
  expect(onSessionExpired).not.toHaveBeenCalled();
});

test("a failed mutation preserves sorting and allows refresh and retry", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response(page([alert], { totalPages: 1, last: true })))
    .mockResolvedValueOnce(response({ token: "test" }))
    .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ success: false, message: "Access denied" }) })
    .mockResolvedValueOnce(response(page([alert], { totalPages: 1, last: true })));
  render(<AlertCenter currentUser={{ role: "OPERATIONS" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
  await screen.findByText("Access denied");
  expect(screen.getByLabelText("Sort alerts")).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Refresh alerts" }));
  expect(await screen.findByRole("button", { name: "Acknowledge" })).toBeEnabled();
});
