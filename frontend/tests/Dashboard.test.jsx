import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Dashboard from "../src/Dashboard";
import SystemsPage from "../src/SystemsPage";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Dashboard", () => {
  test("shows loading state while dashboard data is being fetched", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {})
    );

    render(<Dashboard />);

    expect(
      screen.getByText("Loading dashboard data...")
    ).toBeInTheDocument();
  });

  test("shows dashboard data after successful API responses", async () => {
    const summary = {
      total: 2,
      healthy: 1,
      warning: 1,
      critical: 0,
      offline: 0,
    };

    const systems = [
      {
        id: 1,
        name: "Payment API",
        type: "API",
        host: "payment.example.com",
        status: "HEALTHY",
      },
      {
        id: 2,
        name: "Order Service",
        type: "SERVICE",
        host: "orders.example.com",
        status: "WARNING",
      },
    ];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: summary,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: systems,
        }),
      });

    render(<><Dashboard /><SystemsPage /></>);

    expect(
      screen.getByText("Loading dashboard data...")
    ).toBeInTheDocument();

    expect(
      await screen.findByText("Payment API")
    ).toBeInTheDocument();

    expect(screen.getByText("Order Service")).toBeInTheDocument();
    expect(screen.getByText("payment.example.com")).toBeInTheDocument();
    expect(screen.getByText("orders.example.com")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.queryByText("Loading dashboard data...")
      ).not.toBeInTheDocument();
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/dashboard/summary",
      expect.objectContaining({ credentials: "include" })
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/systems/page?page=0&size=12",
      expect.objectContaining({ credentials: "include" })
    );
  });

  test("shows an empty state and refreshes dashboard data", async () => {
    const emptySummary = {
      total: 0,
      healthy: 0,
      warning: 0,
      critical: 0,
      offline: 0,
    };
    const refreshedSummary = {
      ...emptySummary,
      total: 1,
      healthy: 1,
    };
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: emptySummary }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: refreshedSummary }) });

    render(<Dashboard />);
    const total = await screen.findByRole("heading", { name: "Total Systems" });
    expect(total.closest("article")).toHaveTextContent("0");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh dashboard" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Total Systems" }).closest("article")).toHaveTextContent("1"));
    expect(screen.getByRole("heading", { name: "Healthy" }).closest("article")).toHaveTextContent("1");
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  test("shows an error when dashboard API request fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({
          success: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      });

    render(<Dashboard />);

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "Unable to load dashboard data. Please try again."
    );

    expect(
      screen.queryByText("Loading dashboard data...")
    ).not.toBeInTheDocument();

    expect(
      screen.queryByText("Payment API")
    ).not.toBeInTheDocument();
  });

  test("systems without readings are gray No data and are not presented as healthy", async () => {
    const summary = { total: 2, healthy: 0, warning: 0, critical: 0, offline: 0, noData: 2,
      freshReadingCount: 0, staleReadingCount: 0, activeAlertCount: 0,
      averageCpuUsage: null, averageMemoryUsage: null, averageResponseTime: null };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ success: true, data: summary }) });
    render(<Dashboard />);
    const noDataCard = (await screen.findByRole("heading", { name: "No data", exact: true })).closest("article");
    expect(noDataCard).toHaveTextContent("2");
    expect(noDataCard.querySelector(".kpi-icon")).toHaveClass("status-no-data");
    expect(screen.getByRole("heading", { name: "Healthy", exact: true }).closest("article")).toHaveTextContent("0");
    expect(screen.getByText("2 systems have no readings")).toBeInTheDocument();
    expect(screen.queryByText("All systems are healthy")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "2 systems by health status" })).toBeInTheDocument();
    expect(screen.getByLabelText("Latest reading freshness")).toHaveTextContent("0 recent · 0 outdated · 2 missing");
  });

  test("stale healthy readings keep their last health category without confirming current health", async () => {
    const summary = { total: 1, healthy: 1, warning: 0, critical: 0, offline: 0, noData: 0,
      freshReadingCount: 0, staleReadingCount: 1, activeAlertCount: 0 };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ success: true, data: summary }) });
    render(<Dashboard />);
    expect(await screen.findByText("1 system has outdated readings")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Healthy", exact: true }).closest("article")).toHaveTextContent("1");
    expect(screen.getByRole("heading", { name: "Offline", exact: true }).closest("article")).toHaveTextContent("0");
    expect(screen.queryByText("All systems are healthy")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Latest reading freshness")).toHaveTextContent("0 recent · 1 outdated · 0 missing");
  });

  test("fresh measured zero readings remain healthy and retain numeric average values", async () => {
    const summary = { total: 1, healthy: 1, warning: 0, critical: 0, offline: 0, noData: 0,
      freshReadingCount: 1, staleReadingCount: 0, activeAlertCount: 0,
      averageCpuUsage: 0, averageMemoryUsage: 0, averageResponseTime: 0 };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, json: async () => ({ success: true, data: summary }) });
    render(<Dashboard />);
    expect(await screen.findByText("All systems are healthy")).toBeInTheDocument();
    for (const [label, value] of [["Average CPU", "0%"], ["Average memory", "0%"], ["Average response time", "0 ms"]]) {
      const card = screen.getByRole("heading", { name: label, exact: true }).closest("article");
      expect(within(card).getByText(value, { exact: true })).toBeInTheDocument();
      expect(within(card).queryByText("No data")).not.toBeInTheDocument();
    }
  });
});
