import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useState } from "react";
import AssistantProvider from "../src/AssistantContext";
import AlertCenter from "../src/AlertCenter";
import Modal from "../src/Modal";
import { apiFetch, apiMutation } from "../src/api";

vi.mock("../src/api", () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), apiMutation: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
const ops = { username: "operator", role: "OPERATIONS" };
const reply = (answer = "Current page answer") => ({ status: "generated_with_sources", answer, contextLabel: "Dashboard", capturedAt: "2026-11-01T05:00:00Z", citations: [], observations: [], proposals: [] });
const shell = (page = "dashboard", user = ops, child = <p>Business page</p>) => <AssistantProvider page={page} currentUser={user}>{child}</AssistantProvider>;
function open() { fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" })); }
function message(text) { fireEvent.change(screen.getByLabelText("Message the AI assistant"), { target: { value: text } }); fireEvent.click(screen.getByRole("button", { name: "Send AI message" })); }

test.each([["dashboard", "What needs attention right now?"], ["alerts", "Summarise the alerts in this view."], ["system", "Summarise system health."], ["profile", "How do I verify my email?"], ["retention", "Explain the archive preview."], ["assistant", "How do I add a runbook?"]])("%s provides page-specific preset questions above the composer", async (page, question) => {
  apiMutation.mockResolvedValue(reply()); render(shell(page)); open();
  const shortcut = screen.getByRole("button", { name: question });
  expect(shortcut.compareDocumentPosition(screen.getByLabelText("Message the AI assistant")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(shortcut);
  expect(await screen.findByText("Current page answer")).toBeInTheDocument();
  expect(apiMutation).toHaveBeenCalledWith("/api/assistant/chat", "POST", expect.objectContaining({ question, context: expect.objectContaining({ page }) }), { signal: expect.any(AbortSignal) });
  expect(screen.getByRole("button", { name: question })).toBeEnabled();
});

test("minimising preserves the conversation and follow-up requests include bounded history", async () => {
  apiMutation.mockResolvedValueOnce(reply("First response")).mockResolvedValueOnce(reply("Follow-up response"));
  render(shell()); open(); message("Summarise this page");
  expect(await screen.findByText("First response")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Minimise AI assistant" }));
  expect(screen.queryByRole("dialog", { name: "AI conversation" })).not.toBeInTheDocument();
  open(); expect(screen.getByText("First response")).toBeInTheDocument();
  message("What should I check next?");
  expect(await screen.findByText("Follow-up response")).toBeInTheDocument();
  expect(apiMutation.mock.calls[1][2].history).toEqual([{ role: "user", content: "Summarise this page" }, { role: "assistant", content: "First response" }]);
  expect(screen.getByRole("button", { name: "Explain the dashboard numbers." })).toBeEnabled();
});

test("navigation cancels the old request and late results cannot enter another page's conversation", async () => {
  let resolveOld; apiMutation.mockImplementation(() => new Promise(resolve => { resolveOld = resolve; }));
  const view = render(shell()); open(); message("Old dashboard question");
  await waitFor(() => expect(apiMutation).toHaveBeenCalledTimes(1));
  view.rerender(shell("alerts"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Summarise the alerts in this view." })).toBeEnabled());
  expect(apiMutation.mock.calls[0][3].signal.aborted).toBe(true);
  expect(screen.queryByText("Old dashboard question")).not.toBeInTheDocument();
  await act(async () => resolveOld(reply("Obsolete dashboard response")));
  expect(screen.queryByText("Obsolete dashboard response")).not.toBeInTheDocument();
  view.rerender(shell()); expect(screen.getByText("Old dashboard question")).toBeInTheDocument();
});

test("Ask AI on an actual alert row binds the preset question to that alert", async () => {
  apiFetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { items: [{ alertId: 42, systemId: 7, systemName: "Checkout API", alertType: "HIGH_CPU", message: "CPU warning", severity: "WARNING", status: "ACTIVE", createdTime: "2026-11-01T05:00:00Z" }], page: 0, totalPages: 1, totalElements: 1, first: true, last: true } }) });
  apiMutation.mockResolvedValue({ ...reply("Selected alert explanation"), freshnessNotice: "Current availability is unknown because measurements are outdated." });
  render(shell("alerts", ops, <AlertCenter currentUser={ops} />));
  fireEvent.click(await screen.findByRole("button", { name: "Ask AI about Checkout API alert 42" }));
  expect(screen.getByTitle("Alert Center · Checkout API · Alert #42")).toBeInTheDocument();
  expect(screen.getByLabelText("Message the AI assistant")).toHaveValue("Explain this alert and suggest what to check next.");
  fireEvent.click(screen.getByRole("button", { name: "Explain this alert." }));
  expect(await screen.findByText("Selected alert explanation")).toBeInTheDocument();
  expect(screen.getByText("Current availability is unknown because measurements are outdated.")).toBeInTheDocument();
  expect(apiMutation.mock.calls[0][2].context).toEqual({ page: "alerts", systemId: 7, alertId: 42, status: "ALL" });
  expect(screen.getByRole("button", { name: "Find a related runbook." })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Use page context" }));
  expect(screen.getByTitle("Alert Center")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Summarise the alerts in this view." })).toBeEnabled();
});

test("proposals require review and confirmation, while Management has no action controls", async () => {
  const proposal = { id: "proposal-one", alertId: 42, action: "ACKNOWLEDGE", reason: "Review this incident" };
  apiMutation.mockResolvedValueOnce({ ...reply("Suggested next step"), proposals: [proposal] }).mockResolvedValueOnce({ status: "ACKNOWLEDGED" });
  const view = render(shell()); open(); message("Suggest a next step");
  fireEvent.click(await screen.findByRole("button", { name: "Review action" }));
  expect(apiMutation).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Confirm change" }));
  expect(await screen.findByText("Confirmed: ACKNOWLEDGED")).toBeInTheDocument();
  view.unmount(); apiMutation.mockResolvedValue({ ...reply("Read only"), proposals: [proposal] });
  render(shell("dashboard", { username: "manager", role: "MANAGEMENT" })); open(); message("Review alerts");
  expect(await screen.findByText("Read only")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Review action" })).not.toBeInTheDocument();
});

test("the launcher remains inside a system modal and Escape closes only the chat", async () => {
  function SystemModal() { const [show, setShow] = useState(false); return <><button onClick={() => setShow(true)}>Open system</button>{show && <Modal title="Selected system" onClose={() => setShow(false)}><p>System details</p></Modal>}</>; }
  render(shell("system", ops, <SystemModal />));
  fireEvent.click(screen.getByRole("button", { name: "Open system" })); open();
  const chat = screen.getByRole("dialog", { name: "AI conversation" });
  expect(chat.closest("dialog")).toBe(screen.getByRole("dialog", { name: "Selected system" }));
  const escape = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  fireEvent(chat, escape); expect(escape.defaultPrevented).toBe(true);
  expect(screen.getByRole("dialog", { name: "Selected system" })).toBeInTheDocument();
  expect(screen.queryByRole("dialog", { name: "AI conversation" })).not.toBeInTheDocument();
});
