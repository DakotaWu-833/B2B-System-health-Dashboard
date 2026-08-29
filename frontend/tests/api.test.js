import { describe, expect, test } from "vitest";
import { buildApiUrl } from "../src/api";

describe("API client", () => {
  test("applies and normalizes a configured API base URL", () => {
    expect(buildApiUrl("/api/health", "https://api.example.test/"))
      .toBe("https://api.example.test/api/health");
    expect(buildApiUrl("api/auth/me", ""))
      .toBe("/api/auth/me");
  });
});
