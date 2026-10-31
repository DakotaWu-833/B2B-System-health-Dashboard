import { afterEach, describe, expect, test, vi } from "vitest";
import { apiMutation, buildApiUrl } from "../src/api";

afterEach(() => vi.restoreAllMocks());

describe("API client", () => {
  test("applies and normalizes a configured API base URL", () => {
    expect(buildApiUrl("/api/health", "https://api.example.test/"))
      .toBe("https://api.example.test/api/health");
    expect(buildApiUrl("api/auth/me", ""))
      .toBe("/api/auth/me");
  });
  test("the same abort signal covers CSRF and the actual mutation", async () => {
    const controller = new AbortController();
    const fetch = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { headerName: "X-CSRF-TOKEN", token: "test-csrf-token" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { status: "completed" } }) });
    await apiMutation("/api/assistant/ask", "POST", { question: "CPU" }, { signal: controller.signal });
    expect(fetch).toHaveBeenNthCalledWith(1, "/api/auth/csrf", expect.objectContaining({ signal: controller.signal }));
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/assistant/ask", expect.objectContaining({ signal: controller.signal, method: "POST" }));
  });
});
