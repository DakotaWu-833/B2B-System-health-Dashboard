import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import AlertCenter from "../src/AlertCenter";

afterEach(() => {
  vi.restoreAllMocks();
});

const activeAlert = {
  alertId: 11,
  systemId: 3,
  systemName: "Legacy CRM",
  alertType: "SERVICE_UNAVAILABLE",
  severity: "CRITICAL",
  message: "Legacy CRM is unavailable",
  status: "ACTIVE",
  createdTime: "2026-09-21T01:00:00Z",
};

const resolvedAlert = {
  alertId: 8,
  systemId: 1,
  systemName: "Customer API",
  alertType: "SLOW_RESPONSE",
  severity: "WARNING",
  message: "A previous response-time warning has been resolved",
  status: "RESOLVED",
  createdTime: "2026-09-20T22:00:00Z",
};

function page(items, overrides = {}) {
  return {
    items,
    page: 0,
    size: 5,
    totalElements: items.length,
    totalPages: items.length ? 1 : 0,
    first: true,
    last: true,
    ...overrides,
  };
}

function response(data, options = {}) {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    json: async () => ({
      success: options.success ?? true,
      data,
      message: options.message ?? "Success",
    }),
  };
}

describe("AlertCenter", () => {
  test("lists and filters alerts for a read-only management user", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(page([activeAlert])))
      .mockResolvedValueOnce(response(page([resolvedAlert])));

    render(
      <AlertCenter currentUser={{ role: "MANAGEMENT" }} />
    );

    expect(await screen.findByText("Legacy CRM")).toBeInTheDocument();
    expect(
      screen.getByText(/Management access is read-only/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Acknowledge" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Resolve" })
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "RESOLVED" },
    });

    expect(await screen.findByText("Customer API")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      "/api/alerts?page=0&size=5&status=RESOLVED",
      expect.objectContaining({ credentials: "include" })
    );
  });

  test("acknowledges an active alert with a CSRF-protected request", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(page([activeAlert])))
      .mockResolvedValueOnce(
        response({
          token: "csrf-token",
          headerName: "X-CSRF-TOKEN",
        })
      )
      .mockResolvedValueOnce(
        response({ ...activeAlert, status: "ACKNOWLEDGED" })
      )
      .mockResolvedValueOnce(response(page([])));

    render(
      <AlertCenter currentUser={{ role: "OPERATIONS" }} />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Acknowledge" })
    );

    expect(
      await screen.findByText("Legacy CRM alert acknowledged successfully.")
    ).toBeInTheDocument();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/alerts/11/acknowledge",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        headers: { "X-CSRF-TOKEN": "csrf-token" },
      })
    );
    expect(
      screen.getByText("No active alerts are available.")
    ).toBeInTheDocument();
  });

  test("resolves an acknowledged alert with a CSRF-protected request", async () => {
    const acknowledgedAlert = {
      ...activeAlert,
      alertId: 14,
      status: "ACKNOWLEDGED",
    };

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(page([acknowledgedAlert])))
      .mockResolvedValueOnce(
        response({
          token: "csrf-token",
          headerName: "X-CSRF-TOKEN",
        })
      )
      .mockResolvedValueOnce(
        response({ ...acknowledgedAlert, status: "RESOLVED" })
      )
      .mockResolvedValueOnce(response(page([])));

    render(
      <AlertCenter currentUser={{ role: "OPERATIONS" }} />
    );

    expect(
      screen.queryByRole("button", { name: "Acknowledge" })
    ).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));

    expect(
      await screen.findByText("Legacy CRM alert resolved successfully.")
    ).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/alerts/14/resolve",
      expect.objectContaining({
        method: "PATCH",
        credentials: "include",
        headers: { "X-CSRF-TOKEN": "csrf-token" },
      })
    );
  });

  test("loads a bounded next page of alerts", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        response(
          page([activeAlert], {
            totalElements: 6,
            totalPages: 2,
            last: false,
          })
        )
      )
      .mockResolvedValueOnce(
        response(
          page([{ ...activeAlert, alertId: 12, systemName: "Order Database" }], {
            page: 1,
            totalElements: 6,
            totalPages: 2,
            first: false,
          })
        )
      );

    render(
      <AlertCenter currentUser={{ role: "OPERATIONS" }} />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByText("Order Database")).toBeInTheDocument();
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      "/api/alerts?page=1&size=5&status=ACTIVE",
      expect.objectContaining({ credentials: "include" })
    );
    expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument();
  });

  test("expires the UI session when the alerts API returns 401", async () => {
    const onSessionExpired = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      response(null, {
        ok: false,
        status: 401,
        success: false,
        message: "Authentication required",
      })
    );

    render(
      <AlertCenter
        currentUser={{ role: "OPERATIONS" }}
        onSessionExpired={onSessionExpired}
      />
    );

    await waitFor(() => {
      expect(onSessionExpired).toHaveBeenCalledTimes(1);
    });
  });
});
