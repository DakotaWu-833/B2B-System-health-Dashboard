import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import AssistantPage from "../src/AssistantPage";
import RunbookLibrary from "../src/RunbookLibrary";
import { apiJson, apiMutation } from "../src/api";

vi.mock("../src/api", () => ({ apiJson: vi.fn(), apiMutation: vi.fn() }));
afterEach(() => vi.resetAllMocks());
const operations = { username: "ops", role: "OPERATIONS" };
function setupSystems() { apiJson.mockResolvedValue({ items: [{ id: 7, name: "Payments API" }], last: true }); }

test("searches with selected scope and renders model outage with original sources", async () => {
  setupSystems();
  apiMutation.mockResolvedValue({ status: "model_unavailable", answer: null, citations: [{ id: "D1v0c0", title: "Memory procedure", version: 0, chunk: 0, excerpt: "Inspect memory before restarting." }] });
  render(<AssistantPage currentUser={operations} />);
  fireEvent.change(await screen.findByLabelText("System scope"), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "memory issue" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Search runbooks" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Search runbooks" }));
  expect(await screen.findByText("Inspect memory before restarting.")).toBeInTheDocument();
  expect(screen.getByText(/model could not finish/)).toBeInTheDocument();
  expect(apiMutation).toHaveBeenCalledWith("/api/assistant/ask", "POST", { question: "memory issue", systemId: 7 });
});

test("requires an explicit review and confirmation before changing an alert", async () => {
  setupSystems();
  apiMutation.mockResolvedValueOnce({ status: "completed", summary: "High memory [T1]", trace: [], citations: [], proposals: [{ id: "p1", alertId: 9, action: "ACKNOWLEDGE", reason: "Needs review", expiresAt: new Date(Date.now() + 600000).toISOString() }] }).mockResolvedValueOnce({ status: "ACKNOWLEDGED" });
  const changed = vi.fn();
  render(<AssistantPage currentUser={operations} onAlertsChanged={changed} />);
  fireEvent.click(screen.getByRole("button", { name: "Investigate a system" }));
  await waitFor(() => expect(screen.getByLabelText("System scope")).toBeEnabled());
  fireEvent.change(screen.getByLabelText("System scope"), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("Your question"), { target: { value: "Check this system" } });
  fireEvent.click(screen.getByRole("button", { name: "Investigate system" }));
  fireEvent.click(await screen.findByRole("button", { name: "Review action" }));
  expect(apiMutation).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Confirm alert change" }));
  expect(await screen.findByText("Confirmed: ACKNOWLEDGED")).toBeInTheDocument();
  expect(apiMutation).toHaveBeenLastCalledWith("/api/assistant/proposals/p1/confirm", "POST");
  expect(changed).toHaveBeenCalledTimes(1);
});

test("expires the session on an unauthorized assistant request", async () => {
  setupSystems(); apiMutation.mockRejectedValue({ status: 401 }); const expired = vi.fn();
  render(<AssistantPage currentUser={operations} onSessionExpired={expired} />);
  fireEvent.change(await screen.findByLabelText("Your question"), { target: { value: "memory" } });
  await waitFor(() => expect(screen.getByRole("button", { name: "Search runbooks" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Search runbooks" }));
  await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
});

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
