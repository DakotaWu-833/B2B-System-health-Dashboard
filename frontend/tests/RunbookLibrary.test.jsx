import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import RunbookLibrary from "../src/RunbookLibrary";
import { apiJson, apiMutation } from "../src/api";

vi.mock("../src/api", () => ({ apiJson: vi.fn(), apiMutation: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const operations = { username: "ops", role: "OPERATIONS" };

test("management can read shared runbooks and has no editing controls", async () => {
  apiJson.mockResolvedValueOnce([{ id: 3, title: "Shared procedure", version: 1, operationsOnly: false, chunkCount: 1 }]).mockResolvedValueOnce({ id: 3, title: "Shared procedure", version: 1, content: "Review response times." });
  render(<RunbookLibrary currentUser={{ role: "MANAGEMENT" }} />);
  fireEvent.click(await screen.findByRole("button", { name: /Shared procedure/ }));
  expect(await screen.findByText("Review response times.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Save and index" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "New runbook" })).not.toBeInTheDocument();
});

test("keeps unsaved content visible on a version conflict", async () => {
  apiJson.mockResolvedValueOnce([{ id: 3, title: "Memory", version: 1, operationsOnly: true, chunkCount: 1 }]).mockResolvedValueOnce({ id: 3, title: "Memory", version: 1, content: "Old content", operationsOnly: true });
  apiMutation.mockRejectedValue({ status: 409, message: "Document changed. Reload before editing." });
  render(<RunbookLibrary currentUser={operations} />);
  fireEvent.click(await screen.findByRole("button", { name: /Memory/ }));
  await waitFor(() => expect(screen.getByLabelText("Runbook content")).toHaveValue("Old content"));
  fireEvent.change(screen.getByLabelText("Runbook content"), { target: { value: "My unsaved edit" } });
  fireEvent.click(screen.getByRole("button", { name: "Save and index" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Document changed");
  expect(screen.getByLabelText("Runbook content")).toHaveValue("My unsaved edit");
  expect(apiMutation).toHaveBeenCalledWith("/api/knowledge/documents/3", "PUT", expect.objectContaining({ version: 1, content: "My unsaved edit" }));
});
