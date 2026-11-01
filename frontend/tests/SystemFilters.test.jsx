import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import SystemsPage from "../src/SystemsPage";

afterEach(() => vi.restoreAllMocks());
const measured = (id, extra = {}) => ({ id, name: `API ${id}`, type: "SERVICE", host: `api-${id}.test`, status: "HEALTHY",
  metricDataStatus: "FRESH", latestMetric: { cpuUsage: 0, memoryUsage: 0, responseTime: 0, availability: true }, ...extra });
const reply = data => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
function paged(items, page, size) {
  return { items: items.slice(page * size, (page + 1) * size), page, size, totalElements: items.length,
    totalPages: Math.ceil(items.length / size), first: page === 0, last: (page + 1) * size >= items.length };
}
function mockSystems(readSystems) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(url => {
    const query = new URL(url, "http://localhost").searchParams;
    return Promise.resolve(reply(paged(readSystems(), Number(query.get("page")), Number(query.get("size")))));
  });
}
async function openFilters() {
  fireEvent.click(await screen.findByRole("button", { name: /^Filters/ }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "System type" })).toBeEnabled());
}

test("filters cover later server pages and distinguish no readings from genuine healthy zero readings", async () => {
  const systems = Array.from({ length: 100 }, (_, index) => measured(index + 1));
  systems.push(measured(101, { name: "New database", type: "DATABASE", latestMetric: null, metricDataStatus: "NO_DATA" }));
  const fetch = mockSystems(() => systems);
  render(<SystemsPage />);
  await screen.findByRole("button", { name: /API 1 SERVICE/ });
  expect(fetch).toHaveBeenCalledTimes(1);
  await openFilters();
  expect(screen.getByRole("option", { name: "DATABASE" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledWith("/api/systems/page?page=1&size=100", expect.anything());

  fireEvent.change(screen.getByLabelText("Health status"), { target: { value: "status-no-data" } });
  expect(await screen.findByRole("button", { name: /New database DATABASE.*No data/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /API 1 SERVICE/ })).not.toBeInTheDocument();
  expect(screen.getByText("Page 1 of 1 · 1 systems")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Health status"), { target: { value: "status-healthy" } });
  expect(await screen.findByRole("button", { name: /API 1 SERVICE.*HEALTHY/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /New database DATABASE/ })).not.toBeInTheDocument();
  expect(screen.getByText("Page 1 of 9 · 100 systems")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(3);
});

test("type and health filters combine with name search and retain their selection when collapsed", async () => {
  mockSystems(() => [measured(1, { name: "Billing API", status: "CRITICAL" }),
    measured(2, { name: "Billing database", type: "Custom SQL", status: "CRITICAL" }),
    measured(3, { name: "Orders database", type: "Custom SQL", status: "WARNING" })]);
  render(<SystemsPage />);
  await openFilters();
  fireEvent.change(screen.getByLabelText("System type"), { target: { value: "Custom SQL" } });
  await screen.findByRole("button", { name: /Orders database/ });
  fireEvent.change(screen.getByLabelText("Health status"), { target: { value: "status-critical" } });
  await waitFor(() => expect(screen.queryByRole("button", { name: /Orders database/ })).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Search systems by name"), { target: { value: "Billing" } });
  fireEvent.click(screen.getByRole("button", { name: "Search systems" }));
  await screen.findByRole("button", { name: /Billing database/ });
  expect(screen.queryByRole("button", { name: /Billing API/ })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  expect(screen.queryByRole("combobox", { name: "Health status" })).not.toBeInTheDocument();
  await screen.findByRole("button", { name: /Billing database/ });
  await openFilters();
  expect(screen.getByLabelText("System type")).toHaveValue("Custom SQL");
  expect(screen.getByLabelText("Health status")).toHaveValue("status-critical");
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(await screen.findByRole("button", { name: /Billing API/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Billing database/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Orders database/ })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Search systems by name")).toHaveValue("Billing");
});

test("refresh updates filtered results and recovers from an empty status and type combination", async () => {
  let systems = [measured(1, { status: "WARNING" }), measured(2, { type: "DATABASE" })];
  mockSystems(() => systems);
  render(<SystemsPage />);
  await openFilters();
  fireEvent.change(screen.getByLabelText("System type"), { target: { value: "DATABASE" } });
  await screen.findByRole("button", { name: /API 2 DATABASE/ });
  fireEvent.change(screen.getByLabelText("Health status"), { target: { value: "status-warning" } });
  expect(await screen.findByText(/No systems match the selected filters/)).toBeInTheDocument();
  systems = [systems[0], { ...systems[1], status: "WARNING" }];
  fireEvent.click(screen.getByRole("button", { name: "Refresh systems" }));
  expect(await screen.findByRole("button", { name: /API 2 DATABASE.*WARNING/ })).toBeInTheDocument();
  expect(screen.queryByText(/No systems match the selected filters/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Health status")).toHaveValue("status-warning");
});

test("closing filters during a slow collection request keeps the current page response", async () => {
  let finishCollection;
  vi.spyOn(globalThis, "fetch").mockImplementation(url => url.includes("size=100")
    ? new Promise(resolve => { finishCollection = resolve; })
    : Promise.resolve(reply(paged([measured(1)], 0, 12))));
  render(<SystemsPage />);
  await screen.findByRole("button", { name: /API 1 SERVICE/ });
  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Filters/ }));
  await screen.findByRole("button", { name: /API 1 SERVICE/ });
  await act(async () => finishCollection(reply(paged([measured(99)], 0, 100))));
  expect(screen.getByRole("button", { name: /API 1 SERVICE/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /API 99 SERVICE/ })).not.toBeInTheDocument();
});
