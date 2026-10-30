import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import SystemDetails from "../src/SystemDetails";

afterEach(() => vi.restoreAllMocks());
const reply = data => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const system = { id: 1, name: "Review API", type: "SERVICE", host: "review.test", status: "HEALTHY" };
const reading = (id, cpu) => ({ metricId: id, timestamp: "2026-10-17T00:00:00Z", cpuUsage: cpu, memoryUsage: 10, responseTime: 100, availability: true });

test("a slow initial history response must not replace a later filtered result", async () => {
  let finishInitial;
  vi.spyOn(globalThis, "fetch").mockImplementation(url => {
    if (url === "/api/systems/1") return Promise.resolve(reply({ ...system, metricDataStatus: "FRESH", statusReasons: [] }));
    if (url.includes("from=")) return Promise.resolve(reply({ items: [reading(2, 42)], nextCursor: null }));
    return new Promise(resolve => { finishInitial = resolve; });
  });
  render(<SystemDetails system={system} />);
  fireEvent.click(await screen.findByRole("tab", { name: "Recent Metrics" }));
  fireEvent.change(await screen.findByLabelText("History from"), { target: { value: "2026-10-17T00:00" } });
  fireEvent.click(screen.getByRole("button", { name: "Apply history range" }));
  await screen.findByText("42%");
  await act(async () => finishInitial(reply({ items: [reading(1, 11)], nextCursor: "old-cursor" })));
  await waitFor(() => expect(screen.getByText("42%")).toBeInTheDocument());
  expect(screen.queryByText("11%")).not.toBeInTheDocument();
});
