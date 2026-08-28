import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import SystemDetails from "../src/SystemDetails";

afterEach(() => {
  vi.restoreAllMocks();
});

function createSystem(id, name) {
  return {
    id,
    name,
    type: "API",
    host: `${name.toLowerCase().replaceAll(" ", "-")}.example.com`,
    status: "HEALTHY",
  };
}

function createDetails(system) {
  return {
    id: system.id,
    name: system.name,
    type: system.type,
    host: system.host,
    status: system.status,
    description: `${system.name} description`,
    metricDataStatus: "FRESH",
    statusReasons: [],
  };
}

describe("SystemDetails", () => {
  test("shows loading state while system details are being fetched", () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise(() => {})
    );

    const system = createSystem(1, "Payment API");

    render(<SystemDetails system={system} />);

    expect(
      screen.getByText("Loading system details...")
    ).toBeInTheDocument();
  });

  test("shows an error when a system detail API request fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          message: "Failed to load system details.",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
        }),
      });

    const system = createSystem(1, "Payment API");

    render(<SystemDetails system={system} />);

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Failed to load system details.");

    expect(
      screen.queryByText("Payment API description")
    ).not.toBeInTheDocument();
  });

  test("shows an error when the metrics API request fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: createDetails(createSystem(1, "Payment API")),
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          message: "Failed to load system metrics.",
        }),
      });

    const system = createSystem(1, "Payment API");

    render(<SystemDetails system={system} />);

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Failed to load system metrics.");
  });

  test("prevents stale requests from overwriting a newly selected system", async () => {
    const firstSystem = createSystem(1, "Payment API");
    const secondSystem = createSystem(2, "Order Service");

    let resolveFirstDetails;
    let resolveFirstMetrics;

    vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      if (url === "/api/systems/1") {
        return new Promise((resolve, reject) => {
          resolveFirstDetails = resolve;

          options.signal?.addEventListener("abort", () => {
            reject(
              new DOMException(
                "The operation was aborted.",
                "AbortError"
              )
            );
          });
        });
      }

      if (url === "/api/systems/1/metrics") {
        return new Promise((resolve, reject) => {
          resolveFirstMetrics = resolve;

          options.signal?.addEventListener("abort", () => {
            reject(
              new DOMException(
                "The operation was aborted.",
                "AbortError"
              )
            );
          });
        });
      }

      if (url === "/api/systems/2") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: createDetails(secondSystem),
          }),
        });
      }

      if (url === "/api/systems/2/metrics") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [],
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    const { rerender } = render(
      <SystemDetails system={firstSystem} />
    );

    expect(
      screen.getByText("Loading system details...")
    ).toBeInTheDocument();

    rerender(<SystemDetails system={secondSystem} />);

    expect(
      await screen.findByText("Order Service")
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Payment API")
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("Order Service")
      ).toBeInTheDocument();
    });

    expect(resolveFirstDetails).toBeDefined();
    expect(resolveFirstMetrics).toBeDefined();
  });
});