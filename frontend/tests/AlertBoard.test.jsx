import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import AlertCenter from "../src/AlertCenter";

afterEach(() => vi.restoreAllMocks());
const active = { alertId: 11, systemId: 3, systemName: "Legacy CRM", alertType: "SERVICE_UNAVAILABLE", severity: "CRITICAL", message: "Legacy CRM is unavailable", status: "ACTIVE", createdTime: "2026-09-21T01:00:00Z" };
const acknowledged = { ...active, alertId: 12, systemName: "Order Database", alertType: "HIGH_CPU", status: "ACKNOWLEDGED" };
const resolved = { ...active, alertId: 8, systemId: 1, systemName: "Customer API", alertType: "SLOW_RESPONSE", severity: "WARNING", message: "A previous response-time warning has been resolved", status: "RESOLVED", createdTime: "2026-09-20T22:00:00Z" };
const page = (items, extra = {}) => ({ items, page: 0, size: 100, totalElements: items.length, totalPages: items.length ? 1 : 0, first: true, last: true, ...extra });
const response = (data, status = 200, message = "Success") => ({ ok: status < 400, status, json: async () => ({ success: status < 400, data, message }) });

describe("Alert Center status board", () => {
  test("shows every status column and keeps Management read-only without system or status dropdowns", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(page([active, acknowledged, resolved])));
    render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} />);
    await screen.findByText("Legacy CRM");
    for (const [label, name] of [["Active", "Legacy CRM"], ["Acknowledged", "Order Database"], ["Resolved", "Customer API"]]) {
      const column = screen.getByRole("region", { name: `${label} alerts` });
      expect(column).toHaveAttribute("tabindex", "0");
      expect(within(column).getByText(name)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: label, level: 3 })).toBeInTheDocument();
      expect(screen.getByLabelText(`1 ${label.toLowerCase()} alerts`)).toHaveTextContent("1");
    }
    expect(screen.getByText(/Management access is read-only/)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "System" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Acknowledge" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Alert pages" })).not.toBeInTheDocument();
  });

  test("loads later API pages into their columns and searches the complete board", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(page([active], { last: false, totalPages: 2, totalElements: 3 })))
      .mockResolvedValueOnce(response(page([acknowledged, resolved], { page: 1, first: false, totalPages: 2, totalElements: 3 })));
    render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} />);
    await screen.findByText("Customer API");
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(fetch).toHaveBeenCalledWith("/api/alerts?page=1&size=100", expect.objectContaining({ credentials: "include" }));
    fireEvent.change(screen.getByLabelText("Search alerts by system name"), { target: { value: "customer" } });
    fireEvent.click(screen.getByRole("button", { name: "Search alerts" }));
    expect(within(screen.getByRole("region", { name: "Resolved alerts" })).getByText("Customer API")).toBeInTheDocument();
    expect(screen.queryByText("Legacy CRM")).not.toBeInTheDocument();
    expect(screen.queryByText("Order Database")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByText("Legacy CRM")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("sorts cards within their state without changing state or issuing mutations", async () => {
    const older = { ...active, alertId: 1, systemName: "Alpha API", createdTime: "2026-09-20T01:00:00Z" };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(page([older, active])));
    render(<AlertCenter currentUser={{ role: "MANAGEMENT" }} />);
    await screen.findByText("Legacy CRM");
    const cards = () => within(screen.getByRole("region", { name: "Active alerts" })).getAllByRole("article");
    expect(cards()[0]).toHaveTextContent("Legacy CRM");
    fireEvent.change(screen.getByLabelText("Sort alerts"), { target: { value: "oldest" } });
    expect(cards()[0]).toHaveTextContent("Alpha API");
    fireEvent.change(screen.getByLabelText("Sort alerts"), { target: { value: "system-desc" } });
    expect(cards()[0]).toHaveTextContent("Legacy CRM");
    fireEvent.change(screen.getByLabelText("Sort alerts"), { target: { value: "system-asc" } });
    expect(cards()[0]).toHaveTextContent("Alpha API");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("acknowledges with CSRF and moves the refreshed card to Acknowledged", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(page([active])))
      .mockResolvedValueOnce(response({ token: "csrf-token", headerName: "X-CSRF-TOKEN" }))
      .mockResolvedValueOnce(response({ ...active, status: "ACKNOWLEDGED" }))
      .mockResolvedValueOnce(response(page([{ ...active, status: "ACKNOWLEDGED" }])));
    render(<AlertCenter currentUser={{ role: "OPERATIONS" }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Acknowledge" }));
    await screen.findByText("Legacy CRM alert acknowledged successfully.");
    expect(await within(screen.getByRole("region", { name: "Acknowledged alerts" })).findByText("Legacy CRM")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Active alerts" })).queryByRole("article")).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/alerts/11/acknowledge", expect.objectContaining({ method: "PATCH", credentials: "include", headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-token" }) }));
  });

  test("resolves an acknowledged alert with CSRF and retains the resolved card", async () => {
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(response(page([acknowledged])))
      .mockResolvedValueOnce(response({ token: "csrf-token", headerName: "X-CSRF-TOKEN" }))
      .mockResolvedValueOnce(response({ ...acknowledged, status: "RESOLVED" }))
      .mockResolvedValueOnce(response(page([{ ...acknowledged, status: "RESOLVED" }])));
    render(<AlertCenter currentUser={{ role: "OPERATIONS" }} />);
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    await screen.findByText("Order Database alert resolved successfully.");
    expect(await within(screen.getByRole("region", { name: "Resolved alerts" })).findByText("Order Database")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/alerts/12/resolve", expect.objectContaining({ method: "PATCH", headers: expect.objectContaining({ "X-CSRF-TOKEN": "csrf-token" }) }));
  });

  test("scheduled resolution leaves the card in place until the parent workflow commits it", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(response(page([active])));
    const schedule = vi.fn();
    const view = render(<AlertCenter currentUser={{ role: "OPERATIONS" }} onResolveRequested={schedule} />);
    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    expect(schedule).toHaveBeenCalledWith(active);
    expect(fetch).toHaveBeenCalledTimes(1);
    view.rerender(<AlertCenter currentUser={{ role: "OPERATIONS" }} onResolveRequested={schedule} pendingResolution={{ alert: active, sending: false }} />);
    expect(within(screen.getByRole("region", { name: "Active alerts" })).getByText("Legacy CRM")).toBeInTheDocument();
    expect(screen.getByText(/Resolution scheduled/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resolve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Acknowledge" })).toBeDisabled();
  });

  test("expires the UI session when the alert collection returns 401", async () => {
    const expired = vi.fn();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(null, 401, "Authentication required"));
    render(<AlertCenter currentUser={{ role: "OPERATIONS" }} onSessionExpired={expired} />);
    await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
  });
});
