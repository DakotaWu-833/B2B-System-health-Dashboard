import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Dashboard from "../src/Dashboard";

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

    render(<Dashboard />);

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
      {
        credentials: "include",
      }
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/systems",
      {
        credentials: "include",
      }
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
    const refreshedSystems = [{
      id: 3,
      name: "Inventory API",
      type: "API",
      host: "inventory.example.com",
      status: "HEALTHY",
    }];

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: emptySummary }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: refreshedSummary }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: refreshedSystems }),
      });

    render(<Dashboard />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "No monitored systems are available yet."
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Refresh dashboard" })
    );

    expect(await screen.findByText("Inventory API")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
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
});
