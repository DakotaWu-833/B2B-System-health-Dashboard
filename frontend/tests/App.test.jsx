import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import App from "../src/App";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("App", () => {
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

      if (url === "/api/dashboard/summary" || url === "/api/systems") {
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

      if (url === "/api/systems") {
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
