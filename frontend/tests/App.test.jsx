import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import App from "../src/App";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
  test.each([["assistant", "OPERATIONS"], ["runbooks", "MANAGEMENT"]])("#%s opens the runbook library for %s and uses global chat for questions", async (hash, role) => {
    window.history.replaceState(null, "", `#${hash}`);
    const response = data => Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true, data }) });
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      if (url === "/api/health") return response({ status: "UP" });
      if (url === "/api/auth/me") return response({ username: "library.user", role });
      if (url === "/api/knowledge/documents") return response([{ id: 3, title: "Shared procedure", version: 1, operationsOnly: false, chunkCount: 1 }]);
      if (url === "/api/knowledge/documents/3") return response({ id: 3, title: "Shared procedure", version: 1, operationsOnly: false, content: "Review response times." });
      if (url === "/api/auth/csrf") return response({ token: "test-csrf-token", headerName: "X-CSRF-TOKEN" });
      if (url === "/api/assistant/chat" && options.method === "POST") return response({ status: "generated_with_sources", answer: "Runbooks supply the cited evidence.", contextLabel: "Runbook library", capturedAt: "2026-11-01T05:00:00Z", citations: [], observations: [], proposals: [] });
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<App />);
    expect(await screen.findByRole("heading", { name: "Runbook library", level: 1 })).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", { name: "Primary navigation" });
    expect(within(navigation).getByRole("link", { name: "Runbook library" })).toHaveAttribute("href", "#runbooks");
    expect(within(navigation).queryByRole("link", { name: "Operations assistant" })).not.toBeInTheDocument();
    const library = screen.getByRole("region", { name: "Runbook library workspace" });
    expect(within(library).queryByRole("button", { name: "Runbook Q&A" })).not.toBeInTheDocument();
    expect(within(library).queryByRole("button", { name: "Investigate a system" })).not.toBeInTheDocument();
    expect(within(library).queryByLabelText("System scope")).not.toBeInTheDocument();
    fireEvent.click(await within(library).findByRole("button", { name: /Shared procedure/ }));
    if (role === "OPERATIONS") {
      expect(await within(library).findByLabelText("Runbook content")).toHaveValue("Review response times.");
      expect(within(library).getByRole("button", { name: "Save and index" })).toBeEnabled();
    } else {
      expect(await within(library).findByText("Review response times.")).toBeInTheDocument();
      expect(within(library).queryByRole("button", { name: "Save and index" })).not.toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" }));
    expect(screen.getByTitle("Runbook library")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "How do I add a runbook?" }));
    expect(await screen.findByText("Runbooks supply the cited evidence.")).toBeInTheDocument();
    const chat = fetch.mock.calls.find(([url]) => url === "/api/assistant/chat");
    expect(JSON.parse(chat[1].body)).toEqual(expect.objectContaining({ question: "How do I add a runbook?", context: expect.objectContaining({ page: "assistant" }) }));
    expect(fetch.mock.calls.some(([url]) => url === "/api/assistant/ask" || url === "/api/assistant/diagnose" || url.startsWith("/api/systems/"))).toBe(false);
  });

  test("returns to sign in when the dashboard session has expired", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      if (url === "/api/health") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              service: "system-health-dashboard",
              status: "UP",
              timestamp: "2026-08-29T08:00:00Z",
            },
          }),
        });
      }

      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { username: "testuser", role: "OPERATIONS" },
          }),
        });
      }

      if (url === "/api/dashboard/summary" || url === "/api/systems/page?page=0&size=10") {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            data: null,
            message: "Authentication required",
          }),
        });
      }

      if (url.startsWith("/api/alerts?")) {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: async () => ({
            success: false,
            data: null,
            message: "Authentication required",
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<App />);

    expect(
      await screen.findByRole("heading", { name: "Sign in" })
    ).toBeInTheDocument();
  });

  test("logs out successfully and returns to the login page", async () => {
    const currentUser = {
      username: "testuser",
      role: "USER",
    };

    vi.spyOn(globalThis, "fetch").mockImplementation((url, options = {}) => {
      if (url === "/api/health") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              service: "system-health-dashboard",
              status: "UP",
              timestamp: "2026-08-28T10:00:00Z",
            },
          }),
        });
      }

      if (url === "/api/auth/me") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: currentUser,
          }),
        });
      }

      if (url === "/api/dashboard/summary") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              total: 0,
              healthy: 0,
              warning: 0,
              critical: 0,
              offline: 0,
            },
          }),
        });
      }

      if (url === "/api/systems/page?page=0&size=10") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: [],
          }),
        });
      }

      if (url.startsWith("/api/alerts?")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              items: [],
              page: 0,
              size: 5,
              totalElements: 0,
              totalPages: 0,
              first: true,
              last: true,
            },
          }),
        });
      }

      if (url === "/api/auth/csrf") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              token: "test-csrf-token",
            },
          }),
        });
      }

      if (url === "/api/auth/logout" && options.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
          }),
        });
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Logout" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Logout" })
    );

    expect(
      await screen.findByRole("heading", { name: "Sign in" })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          headers: {
            "X-CSRF-TOKEN": "test-csrf-token",
          },
        })
      );
    });
  });
});
