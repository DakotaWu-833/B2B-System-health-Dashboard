import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AlertCenter from "../src/AlertCenter";
import AssistantProvider from "../src/AssistantContext";

afterEach(() => vi.restoreAllMocks());
const resolved = { alertId: 8, systemId: 3, systemName: "Checkout API", alertType: "HIGH_CPU", severity: "WARNING", message: "CPU warning", status: "RESOLVED", archived: false, createdTime: "2026-11-02T00:00:00Z" };
const page = (items, extra = {}) => ({ items, page: 0, size: 100, totalElements: items.length, totalPages: items.length ? 1 : 0, first: true, last: true, ...extra });
const response = (data, status = 200, message = "Success") => ({ ok: status < 400, status, json: async () => ({ success: status < 400, data, message }) });

test.each(["ACTIVE", "ACKNOWLEDGED", "RESOLVED"])("clicking a %s alert opens its own system directly on Recent Metrics", async status => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(response(
    url.startsWith("/api/alerts?") ? page([{ ...resolved, status }]) :
    url.includes("/metrics/history?") ? { items: [{ metricId: 1, timestamp: "2026-11-02T00:00:00Z", cpuUsage: 95, memoryUsage: 20, responseTime: 100, availability: true }], nextCursor: null } :
    { id: 3, name: "Checkout API", type: "SERVICE", host: "checkout.test", status: "CRITICAL", metricDataStatus: "FRESH", latestMetric: { cpuUsage: 95 }, statusReasons: [] })));
  render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "View recent metrics for Checkout API alert 8" }));
  const table = await screen.findByRole("table", { name: "Recent metric readings" });
  expect(screen.getByRole("tab", { name: "Recent Metrics" })).toHaveAttribute("aria-selected", "true");
  expect(within(table).getByText("95%")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Close system dialog" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/systems/3", expect.anything());
  expect(fetch).toHaveBeenCalledWith("/api/systems/3/metrics/history?size=10", expect.anything());
  expect(fetch.mock.calls.every(([, options]) => !options.method)).toBe(true);
});

test("archive and undo use CSRF, stay separate from card navigation and restore the Resolved column", async () => {
  let archived = false;
  const changed = vi.fn();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
    if (url === "/api/auth/csrf") return Promise.resolve(response({ token: "fresh-archive", headerName: "X-CSRF-TOKEN" }));
    if (options.method === "PATCH") {
      archived = url.endsWith("/archive");
      return Promise.resolve(response({ ...resolved, archived }));
    }
    const archivedQuery = new URL(url, "http://localhost").searchParams.get("archived") === "true";
    return Promise.resolve(response(page(archived === archivedQuery ? [{ ...resolved, archived }] : [])));
  });
  render(<AlertCenter currentUser={{ role: "OPERATIONS" }} onAlertsChanged={changed} />);
  fireEvent.click(await screen.findByRole("button", { name: "Archive", exact: true }));
  await screen.findByText("Checkout API alert archived successfully.");
  await waitFor(() => expect(screen.queryByRole("article")).not.toBeInTheDocument());
  expect(screen.queryByRole("button", { name: "Close system dialog" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Archived", exact: true }));
  const restore = await screen.findByRole("button", { name: "Undo archive" });
  expect(within(screen.getByRole("region", { name: "Archived alerts" })).getByText("Checkout API")).toBeInTheDocument();
  fireEvent.click(restore);
  await screen.findByText("Checkout API alert restored to Resolved.");
  await waitFor(() => expect(screen.queryByRole("article")).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Alert board", exact: true }));
  expect(await within(screen.getByRole("region", { name: "Resolved alerts" })).findByText("Checkout API")).toBeInTheDocument();
  for (const action of ["archive", "unarchive"]) {
    expect(fetch).toHaveBeenCalledWith(`/api/alerts/8/${action}`, expect.objectContaining({ method: "PATCH", credentials: "include", headers: expect.objectContaining({ "X-CSRF-TOKEN": "fresh-archive" }) }));
  }
  expect(changed).toHaveBeenCalledTimes(2);
});

test("Management can search later archived pages and inspect cards without seeing write controls", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => {
    if (!url.includes("archived=true")) return Promise.resolve(response(page([])));
    return Promise.resolve(response(url.includes("page=1")
      ? page([{ ...resolved, archived: true }], { page: 1, totalPages: 2, totalElements: 2, first: false })
      : page([{ ...resolved, alertId: 7, systemName: "Other API", archived: true }], { totalPages: 2, totalElements: 2, last: false })));
  });
  render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Archived", exact: true }));
  await screen.findByText("Checkout API");
  expect(fetch).toHaveBeenCalledWith("/api/alerts?page=1&size=100&archived=true", expect.anything());
  fireEvent.change(screen.getByLabelText("Search alerts by system name"), { target: { value: "Checkout" } });
  fireEvent.click(screen.getByRole("button", { name: "Search alerts" }));
  expect(screen.queryByText("Other API")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "View recent metrics for Checkout API alert 8" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Undo archive" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Archive", exact: true })).not.toBeInTheDocument();
});

test("a rejected archive leaves its card in Resolved and reports the server failure", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(url === "/api/auth/csrf"
    ? response({ token: "fresh" }) : url.endsWith("/archive")
    ? response(null, 409, "Only resolved alerts can be archived or restored.") : response(page([resolved]))));
  render(<AlertCenter currentUser={{ role: "OPERATIONS" }} />);
  fireEvent.click(await screen.findByRole("button", { name: "Archive", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Only resolved alerts");
  expect(within(screen.getByRole("region", { name: "Resolved alerts" })).getByText("Checkout API")).toBeInTheDocument();
});

test("the real assistant sends the current archive filter and keeps board and archived conversations separate", async () => {
  const requests = [];
  const preset = "Summarise the alerts in this view.";
  const answers = ["Board-only answer", "Archived-only answer", "Board follow-up"];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
    if (url === "/api/auth/csrf") return Promise.resolve(response({ token: "chat-csrf", headerName: "X-CSRF-TOKEN" }));
    if (url === "/api/assistant/chat") {
      requests.push(JSON.parse(options.body));
      return Promise.resolve(response({ status: "generated_with_sources", answer: answers[requests.length - 1],
        contextLabel: requests.at(-1).context.archived ? "Archived alerts" : "Alert board", capturedAt: "2026-11-02T00:00:00Z", citations: [], observations: [], proposals: [] }));
    }
    return Promise.resolve(response(page(url.includes("archived=true") ? [] : [resolved])));
  });
  const operator = { username: "archive-chat-test", role: "OPERATIONS" };
  render(<AssistantProvider page="alerts" currentUser={operator}><AlertCenter currentUser={operator} /></AssistantProvider>);
  await screen.findByText("Checkout API");
  fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
  fireEvent.click(screen.getByRole("button", { name: preset }));
  await screen.findByText("Board-only answer");
  expect(requests[0].context).toEqual({ page: "alerts", systemId: null, alertId: null, status: "ALL", archived: false });

  fireEvent.click(screen.getByRole("button", { name: "Archived", exact: true }));
  await within(screen.getByRole("region", { name: "Archived alerts", exact: true })).findByText("No archived alerts.");
  expect(screen.queryByText("Board-only answer")).not.toBeInTheDocument();
  expect(screen.getByTitle("Alert Center · Archived")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: preset }));
  await screen.findByText("Archived-only answer");
  expect(requests[1].context).toEqual({ page: "alerts", systemId: null, alertId: null, status: "ALL", archived: true });
  expect(requests[1].history).toEqual([]);

  fireEvent.click(screen.getByRole("button", { name: "Alert board", exact: true }));
  await screen.findByText("Checkout API");
  expect(screen.getByText("Board-only answer")).toBeInTheDocument();
  expect(screen.queryByText("Archived-only answer")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: preset }));
  await screen.findByText("Board follow-up");
  expect(requests[2].context.archived).toBe(false);
  expect(requests[2].history).toEqual([{ role: "user", content: preset }, { role: "assistant", content: "Board-only answer" }]);
});

test.each([false, true])("moving a selected alert out of archived=%s resets AI to the current page", async archivedView => {
  let archived = archivedView;
  const requests = [];
  vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
    if (url === "/api/auth/csrf") return Promise.resolve(response({ token: "chat-csrf", headerName: "X-CSRF-TOKEN" }));
    if (url === "/api/assistant/chat") {
      requests.push(JSON.parse(options.body));
      return Promise.resolve(response({ status: "generated_with_sources", answer: requests.length === 1 ? "Selected alert answer" : "Current page answer", citations: [], observations: [], proposals: [] }));
    }
    if (options.method === "PATCH") {
      archived = !archivedView;
      return Promise.resolve(response({ ...resolved, archived }));
    }
    const requestedArchive = new URL(url, "http://localhost").searchParams.get("archived") === "true";
    return Promise.resolve(response(page(requestedArchive === archived ? [{ ...resolved, archived }] : [])));
  });
  const operator = { username: "archive-selected-chat-test", role: "OPERATIONS" };
  render(<AssistantProvider page="alerts" currentUser={operator}><AlertCenter currentUser={operator} /></AssistantProvider>);
  if (archivedView) fireEvent.click(screen.getByRole("button", { name: "Archived", exact: true }));
  fireEvent.click(await screen.findByRole("button", { name: "Ask AI about Checkout API alert 8" }));
  fireEvent.click(screen.getByRole("button", { name: "Explain this alert." }));
  await screen.findByText("Selected alert answer");
  expect(requests[0].context).toEqual({ page: "alerts", systemId: 3, alertId: 8, status: "ALL", archived: archivedView });

  fireEvent.click(screen.getByRole("button", { name: archivedView ? "Undo archive" : "Archive", exact: true }));
  await screen.findByText(archivedView ? "Checkout API alert restored to Resolved." : "Checkout API alert archived successfully.");
  expect(screen.queryByText("Selected alert answer")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Use page context" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Summarise the alerts in this view." }));
  await screen.findByText("Current page answer");
  expect(requests[1].context).toEqual({ page: "alerts", systemId: null, alertId: null, status: "ALL", archived: archivedView });
  expect(requests[1].history).toEqual([]);
});
