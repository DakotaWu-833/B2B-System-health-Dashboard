/** Bound the whole browser operation, including CSRF, even if a transport never settles. */
export function assistantRequest(operation, timeoutMs) {
  const controller = new AbortController();
  let onAbort;
  const stopped = new Promise((_, reject) => {
    onAbort = () => reject(controller.signal.reason);
    controller.signal.addEventListener("abort", onAbort, { once: true });
  });
  const timer = setTimeout(() => controller.abort(new DOMException("The request exceeded its time limit", "TimeoutError")), timeoutMs);
  const promise = Promise.race([Promise.resolve().then(() => operation(controller.signal)), stopped]).finally(() => {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
  });
  return { promise, cancel: () => controller.abort(new DOMException("Request cancelled", "AbortError")) };
}
