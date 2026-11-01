import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useState } from "react";
import AssistantProvider from "../src/AssistantContext";
import AlertCenter from "../src/AlertCenter";
import Modal from "../src/Modal";
import { apiJson, apiMutation } from "../src/api";

vi.mock("../src/api", () => ({ apiJson: vi.fn(), apiFetch: vi.fn(), apiMutation: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
const ops = { username: "operator", role: "OPERATIONS" };
const reply = (answer = "Current page answer") => ({ status: "generated_with_sources", answer, contextLabel: "Dashboard", capturedAt: "2026-11-01T05:00:00Z", citations: [], observations: [], proposals: [] });
const shell = (page = "dashboard", user = ops, child = <p>Business page</p>) => <AssistantProvider page={page} currentUser={user}>{child}</AssistantProvider>;
function open() { fireEvent.click(screen.getByRole("button", { name: "Open AI assistant" })); }
function message(text) { fireEvent.change(screen.getByLabelText("Message the AI assistant"), { target: { value: text } }); fireEvent.click(screen.getByRole("button", { name: "Send AI message" })); }

function draggableGeometry() {
  vi.stubGlobal("PointerEvent", class extends MouseEvent {
    constructor(type, options = {}) { super(type, options); this.pointerId = options.pointerId ?? 1; this.isPrimary = true; }
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const panel = this.classList.contains("context-chat");
    const x = this.style.left ? Number.parseFloat(this.style.left) : panel ? 580 : 880;
    const y = this.style.top ? Number.parseFloat(this.style.top) : panel ? 40 : 680;
    const width = panel ? Math.min(420, window.innerWidth - 24) : 120;
    const height = panel ? Math.min(600, window.innerHeight - 100) : 58;
    return { x, y, left: x, top: y, right: x + width, bottom: y + height, width, height };
  });
}
function drag(target, from, to) {
  fireEvent.pointerDown(target, { pointerId: 1, button: 0, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(target, { pointerId: 1, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(target, { pointerId: 1, clientX: to[0], clientY: to[1] });
}

test("dragging the launcher does not open chat, stays in the viewport and keeps each page's position", () => {
  draggableGeometry(); const view = render(shell("alerts"));
  const launcher = screen.getByRole("button", { name: "Open AI assistant" });
  expect(launcher.closest(".context-assistant")).toHaveClass("context-assistant--alerts");
  drag(launcher, [900, 700], [100, 100]);
  fireEvent.click(launcher, { detail: 1 });
  expect(screen.queryByRole("dialog", { name: "AI conversation" })).not.toBeInTheDocument();
  expect(launcher).toHaveStyle({ left: "80px", top: "80px" });
  view.rerender(shell("system"));
  expect(launcher.style.left).toBe("");
  view.rerender(shell("alerts"));
  expect(launcher).toHaveStyle({ left: "80px", top: "80px" });
  drag(launcher, [100, 100], [-300, -300]);
  expect(launcher).toHaveStyle({ left: "8px", top: "8px" });
  // A new deliberate click and keyboard activation still work after a drag.
  fireEvent.pointerDown(launcher, { pointerId: 2, button: 0, clientX: 20, clientY: 20 });
  fireEvent.pointerUp(launcher, { pointerId: 2, clientX: 20, clientY: 20 });
  fireEvent.click(launcher, { detail: 1 });
  expect(screen.getByRole("dialog", { name: "AI conversation" })).toBeInTheDocument();
});

test("the conversation can move independently, preserves its draft across minimise and resets on demand", () => {
  draggableGeometry(); render(shell()); open();
  const chat = screen.getByRole("dialog", { name: "AI conversation" });
  fireEvent.change(screen.getByLabelText("Message the AI assistant"), { target: { value: "Keep my question" } });
  drag(chat.querySelector("header"), [600, 60], [100, 120]);
  expect(chat).toHaveStyle({ left: "80px", top: "100px" });
  fireEvent.click(screen.getByRole("button", { name: "Minimise AI assistant" })); open();
  expect(screen.getByRole("dialog", { name: "AI conversation" })).toHaveStyle({ left: "80px", top: "100px" });
  expect(screen.getByLabelText("Message the AI assistant")).toHaveValue("Keep my question");
  fireEvent.click(screen.getByRole("button", { name: "Reset AI position" }));
  expect(screen.getByRole("dialog", { name: "AI conversation" }).style.left).toBe("");
  expect(screen.getByLabelText("Message the AI assistant")).toHaveValue("Keep my question");
});

test("keyboard movement and window resizing keep the assistant reachable", () => {
  draggableGeometry(); render(shell());
  const launcher = screen.getByRole("button", { name: "Open AI assistant" });
  fireEvent.keyDown(launcher, { key: "ArrowLeft" });
  expect(launcher).toHaveStyle({ left: "864px" });
  vi.stubGlobal("innerWidth", 390); vi.stubGlobal("innerHeight", 600);
  fireEvent(window, new Event("resize"));
  expect(launcher).toHaveStyle({ left: "262px", top: "534px" });
  open();
  const chat = screen.getByRole("dialog", { name: "AI conversation" });
  expect(chat).toHaveStyle({ left: "16px", top: "16px" });
  fireEvent.keyDown(screen.getByRole("button", { name: "Move AI conversation" }), { key: "ArrowLeft", shiftKey: true });
  expect(chat).toHaveStyle({ left: "8px" });
  fireEvent.keyDown(launcher, { key: "Home" });
  expect(launcher.style.left).toBe(""); expect(chat.style.left).toBe("");
});

test("cancelling a pointer drag leaves the launcher usable without an accidental open", () => {
  draggableGeometry(); render(shell());
  const launcher = screen.getByRole("button", { name: "Open AI assistant" });
  fireEvent.pointerDown(launcher, { pointerId: 1, button: 0, clientX: 900, clientY: 700 });
  fireEvent.pointerMove(launcher, { pointerId: 1, clientX: 800, clientY: 600 });
  fireEvent.pointerCancel(launcher, { pointerId: 1 });
  fireEvent.click(launcher, { detail: 1 });
  expect(screen.queryByRole("dialog", { name: "AI conversation" })).not.toBeInTheDocument();
  expect(launcher.closest(".context-assistant")).not.toHaveAttribute("data-dragging");
  fireEvent.click(launcher, { detail: 0 });
  expect(screen.getByRole("dialog", { name: "AI conversation" })).toBeInTheDocument();
});

test.each([["dashboard", "What needs attention right now?"], ["alerts", "Summarise the alerts in this view."], ["system", "Summarise system health."], ["profile", "How do I verify my email?"], ["retention", "Explain the archive preview."], ["assistant", "How do I add a runbook?"]])("%s provides page-specific preset questions above the composer", async (page, question) => {
  apiMutation.mockResolvedValue(reply()); render(shell(page)); open();
  const shortcut = screen.getByRole("button", { name: question });
  expect(shortcut.compareDocumentPosition(screen.getByLabelText("Message the AI assistant")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(shortcut);
  expect(await screen.findByText("Current page answer")).toBeInTheDocument();
  expect(apiMutation).toHaveBeenCalledWith("/api/assistant/chat", "POST", expect.objectContaining({ question, context: expect.objectContaining({ page }) }), { signal: expect.any(AbortSignal) });
  if (page === "alerts") expect(apiMutation.mock.calls[0][2].context.archived).toBe(false);
  else expect(apiMutation.mock.calls[0][2].context).not.toHaveProperty("archived");
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

test("a hanging chat times out, aborts and preserves the question in the conversation", async () => {
  apiMutation.mockImplementation(() => new Promise(() => {}));
  render(shell()); open(); vi.useFakeTimers(); message("How can we improve efficiency?");
  await act(async () => { await vi.advanceTimersByTimeAsync(55000); });
  expect(screen.getByText("The request timed out. Please try a more focused question.")).toBeInTheDocument();
  expect(screen.getByText("How can we improve efficiency?")).toBeInTheDocument();
  expect(screen.getByLabelText("Message the AI assistant")).toBeEnabled();
  expect(apiMutation.mock.calls[0][3].signal.aborted).toBe(true);
});

test("cancelling chat permits retry and a late old response cannot replace the new answer", async () => {
  let resolveOld;
  apiMutation.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValueOnce(reply("Current answer"));
  render(shell()); open(); message("Old question");
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  expect(await screen.findByText("Request cancelled. Your conversation is saved.")).toBeInTheDocument();
  expect(apiMutation.mock.calls[0][3].signal.aborted).toBe(true);
  message("A more specific question");
  expect(await screen.findByText("Current answer")).toBeInTheDocument();
  await act(async () => resolveOld(reply("Obsolete answer")));
  expect(screen.queryByText("Obsolete answer")).not.toBeInTheDocument();
});

test("an unauthorized chat expires the session", async () => {
  const expired = vi.fn(); apiMutation.mockRejectedValue({ status: 401 });
  render(<AssistantProvider page="assistant" currentUser={ops} onSessionExpired={expired}><p>Library</p></AssistantProvider>);
  open(); message("How do I add a runbook?");
  await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
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

test("Ask AI on an actual board card binds the preset question to that alert", async () => {
  apiJson.mockResolvedValue({ items: [{ alertId: 42, systemId: 7, systemName: "Checkout API", alertType: "HIGH_CPU", message: "CPU warning", severity: "WARNING", status: "ACTIVE", createdTime: "2026-11-01T05:00:00Z" }], page: 0, totalPages: 1, totalElements: 1, first: true, last: true });
  apiMutation.mockResolvedValue({ ...reply("Selected alert explanation"), freshnessNotice: "Current availability is unknown because measurements are outdated." });
  render(shell("alerts", ops, <AlertCenter currentUser={ops} />));
  fireEvent.click(await screen.findByRole("button", { name: "Ask AI about Checkout API alert 42" }));
  expect(screen.getByTitle("Alert Center · Checkout API · Alert #42")).toBeInTheDocument();
  expect(screen.getByLabelText("Message the AI assistant")).toHaveValue("Explain this alert and suggest what to check next.");
  fireEvent.click(screen.getByRole("button", { name: "Explain this alert." }));
  expect(await screen.findByText("Selected alert explanation")).toBeInTheDocument();
  expect(screen.getByText("Current availability is unknown because measurements are outdated.")).toBeInTheDocument();
  expect(apiMutation.mock.calls[0][2].context).toEqual({ page: "alerts", systemId: 7, alertId: 42, status: "ALL", archived: false });
  expect(screen.getByRole("button", { name: "Find a related runbook." })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Use page context" }));
  expect(screen.getByTitle("Alert Center")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Summarise the alerts in this view." })).toBeEnabled();
});

test("an archived card and Clear selection retain the archived view in the request context", async () => {
  const alert = { alertId: 42, systemId: 7, systemName: "Checkout API", alertType: "HIGH_CPU", message: "CPU warning", severity: "WARNING", status: "RESOLVED", archived: true, createdTime: "2026-11-01T05:00:00Z" };
  apiJson.mockImplementation(path => Promise.resolve({ items: path.includes("archived=true") ? [alert] : [], page: 0, totalPages: 1, first: true, last: true }));
  apiMutation.mockResolvedValueOnce(reply("Archived alert explanation")).mockResolvedValueOnce(reply("Archived page explanation"));
  render(shell("alerts", ops, <AlertCenter currentUser={ops} />));
  fireEvent.click(screen.getByRole("button", { name: "Archived", exact: true }));
  fireEvent.click(await screen.findByRole("button", { name: "Ask AI about Checkout API alert 42" }));
  expect(screen.getByTitle("Alert Center · Archived · Checkout API · Alert #42")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Explain this alert." }));
  await screen.findByText("Archived alert explanation");
  expect(apiMutation.mock.calls[0][2].context).toEqual({ page: "alerts", systemId: 7, alertId: 42, status: "ALL", archived: true });

  fireEvent.click(screen.getByRole("button", { name: "Use page context" }));
  expect(screen.getByTitle("Alert Center · Archived")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Summarise the alerts in this view." }));
  await screen.findByText("Archived page explanation");
  expect(apiMutation.mock.calls[1][2].context).toEqual({ page: "alerts", systemId: null, alertId: null, status: "ALL", archived: true });
  expect(apiMutation.mock.calls[1][2].history).toEqual([]);
});

test("an archived alert detail modal reports its archived scope before Ask AI opens", async () => {
  const alert = { alertId: 42, systemId: 7, systemName: "Checkout API", alertType: "HIGH_CPU", message: "CPU warning", severity: "WARNING", status: "RESOLVED", archived: true, createdTime: "2026-11-01T05:00:00Z" };
  apiJson.mockImplementation(path => Promise.resolve(path.startsWith("/api/alerts?")
    ? { items: path.includes("archived=true") ? [alert] : [], page: 0, totalPages: 1, first: true, last: true }
    : path.includes("/metrics/history?") ? { items: [], nextCursor: null }
    : { id: 7, name: alert.systemName, type: "SERVICE", host: "checkout.test", status: "HEALTHY", metricDataStatus: "NO_DATA", statusReasons: [] }));
  apiMutation.mockResolvedValue(reply("Archived modal explanation"));
  render(shell("alerts", ops, <AlertCenter currentUser={ops} />));
  fireEvent.click(screen.getByRole("button", { name: "Archived", exact: true }));
  fireEvent.click(await screen.findByRole("button", { name: "View recent metrics for Checkout API alert 42" }));
  await screen.findByRole("table", { name: "Recent metric readings" });
  open();
  expect(screen.getByTitle("Alert Center · Archived · Checkout API · Alert #42")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Explain this alert." }));
  await screen.findByText("Archived modal explanation");
  expect(apiMutation.mock.calls[0][2].context).toEqual({ page: "alerts", systemId: 7, alertId: 42, status: "ALL", archived: true });
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
