import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import Modal from "../src/Modal";
import SystemForm from "../src/SystemForm";
import SystemDetails from "../src/SystemDetails";

const reply = data => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });
const system = { id: 1, name: "Guarded API", type: "SERVICE", host: "guarded.test", status: "HEALTHY" };
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

test("closing an edited system offers to keep its draft or discard it before closing", async () => {
  const onClose = vi.fn();
  render(<Modal title="Edit Guarded API" onClose={onClose}><SystemForm system={system} onSaved={vi.fn()} onCancel={onClose} /></Modal>);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Unsaved name" } });
  fireEvent.click(screen.getByRole("button", { name: "Close system dialog" }));
  expect(screen.getByRole("group", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Keep editing" })).toHaveFocus();
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Name")).toHaveValue("Unsaved name");
  expect(screen.queryByRole("group", { name: "Discard unsaved changes?" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Close system dialog" }));
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => { vi.advanceTimersByTime(180); });
  expect(onClose).toHaveBeenCalledOnce();
});

test("a pending save blocks dismissal including an already-open discard confirmation", async () => {
  let finishCsrf;
  const onClose = vi.fn();
  const onSaved = vi.fn();
  vi.spyOn(globalThis, "fetch").mockImplementation(url => url === "/api/auth/csrf"
    ? new Promise(resolve => { finishCsrf = resolve; }) : Promise.resolve(reply({ ...system, name: "Saved name" })));
  render(<Modal title="Edit Guarded API" onClose={onClose}><SystemForm system={system} onSaved={onSaved} onCancel={onClose} /></Modal>);
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Saved name" } });
  fireEvent.click(screen.getByRole("button", { name: "Close system dialog" }));
  expect(screen.getByRole("group", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  const close = screen.getByRole("button", { name: "Close system dialog" });
  expect(close).toBeDisabled();
  expect(screen.getByRole("button", { name: "Discard changes" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Keep editing" })).toBeDisabled();
  expect(screen.getByText("Saving your changes. Please keep this window open.")).toHaveAttribute("role", "status");
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  fireEvent.click(close);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: false, cancelable: true }));
  fireEvent.click(screen.getByRole("dialog"));
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveAttribute("open");
  expect(screen.getByText("Saving your changes. Please keep this window open.")).toBeInTheDocument();
  await act(async () => { finishCsrf(reply({ token: "csrf" })); });
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(close).toBeEnabled();
});

test("switching detail tabs preserves a metric draft until discard is confirmed", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(url => Promise.resolve(reply(
    url.includes("metrics/history") ? { items: [], nextCursor: null } : { ...system, statusReasons: [], metricDataStatus: "NO_DATA" }
  )));
  render(<Modal title="Guarded API" onClose={vi.fn()}><SystemDetails system={system} currentUser={{ role: "OPERATIONS" }} /></Modal>);
  await screen.findByText("Health thresholds:");
  const submit = screen.getByRole("tab", { name: "Submit a metric reading" });
  const history = screen.getByRole("tab", { name: "Recent Metrics" });
  fireEvent.click(submit);
  fireEvent.change(screen.getByLabelText("CPU usage (%)"), { target: { value: "45" } });
  fireEvent.click(submit);
  expect(screen.getByLabelText("CPU usage (%)")).toHaveValue(45);
  expect(screen.queryByText("Discard unsaved changes?")).not.toBeInTheDocument();
  fireEvent.click(history);
  expect(submit).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("group", { name: "Discard unsaved changes?" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("CPU usage (%)")).toHaveValue(45);
  fireEvent.click(history);
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(history).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("History from")).toBeInTheDocument();
  fireEvent.click(submit);
  expect(screen.getByLabelText("CPU usage (%)")).toHaveValue(null);
  expect(fetch.mock.calls.some(([, options]) => options.method === "POST")).toBe(false);
});
