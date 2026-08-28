import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import Login from "../src/Login";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Login", () => {
  test("shows an error when username or password is empty", async () => {
    const onLogin = vi.fn();

    render(<Login onLogin={onLogin} />);

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(
      screen.getByText("Please enter both username and password.")
    ).toBeInTheDocument();

    expect(onLogin).not.toHaveBeenCalled();
  });

  test("logs in successfully with valid credentials", async () => {
    const onLogin = vi.fn();

    const user = {
      username: "testuser",
      role: "USER",
    };

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: "test-csrf-token",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: user,
        }),
      });

    render(<Login onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "testuser" },
    });

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "testpassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith(user);
    });

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      "/api/auth/csrf",
      {
        credentials: "include",
      }
    );

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-TOKEN": "test-csrf-token",
        },
      })
    );
  });

  test("shows an error when login credentials are invalid", async () => {
    const onLogin = vi.fn();

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            token: "test-csrf-token",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          message: "Invalid username or password.",
        }),
      });

    render(<Login onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "wronguser" },
    });

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrongpassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText("Invalid username or password.")
    ).toBeInTheDocument();

    expect(onLogin).not.toHaveBeenCalled();
  });
});