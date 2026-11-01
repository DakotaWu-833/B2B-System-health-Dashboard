import { useCallback, useLayoutEffect, useRef, useState } from "react";

const MARGIN = 8;
const same = (a, b) => a?.x === b?.x && a?.y === b?.y;
function bounds() {
  const viewport = window.visualViewport;
  return { x: viewport?.offsetLeft || 0, y: viewport?.offsetTop || 0,
    width: viewport?.width || document.documentElement.clientWidth || window.innerWidth,
    height: viewport?.height || window.innerHeight };
}
function clamp(point, rect) {
  const view = bounds();
  return { x: Math.max(view.x + MARGIN, Math.min(point.x, view.x + view.width - rect.width - MARGIN)),
    y: Math.max(view.y + MARGIN, Math.min(point.y, view.y + view.height - rect.height - MARGIN)) };
}
const positioned = point => point ? { left: point.x, top: point.y, right: "auto", bottom: "auto", animation: "none" } : undefined;

// Keep UI positions in this signed-in session, separately for each business page.
export default function useAssistantPosition(page, open, host, launcher, panel) {
  const [positions, setPositions] = useState({});
  const [moving, setMoving] = useState(null);
  const [viewportHeight, setViewportHeight] = useState(() => bounds().height);
  const drag = useRef(null);
  const lastDrag = useRef(0);
  const selected = positions[page] || {};
  const save = useCallback((kind, point) => setPositions(previous => {
    if (same(previous[page]?.[kind], point)) return previous;
    return { ...previous, [page]: { ...previous[page], [kind]: point } };
  }), [page]);
  const reset = useCallback(() => setPositions(previous => {
    const next = { ...previous }; delete next[page]; return next;
  }), [page]);

  useLayoutEffect(() => {
    function fit() {
      setViewportHeight(bounds().height);
      setPositions(previous => {
        const current = previous[page];
        if (!current) return previous;
        const next = { ...current };
        if (next.launcher && launcher.current) next.launcher = clamp(next.launcher, launcher.current.getBoundingClientRect());
        if (open && panel.current) {
          const rect = panel.current.getBoundingClientRect();
          if (next.panel) next.panel = clamp(next.panel, rect);
          else if (next.launcher) {
            const anchor = launcher.current.getBoundingClientRect(), view = bounds();
            const above = next.launcher.y - rect.height - 18;
            const below = next.launcher.y + anchor.height + 18;
            let point = { x: next.launcher.x + anchor.width - rect.width, y: above };
            if (above < view.y + MARGIN) {
              if (below + rect.height <= view.y + view.height - MARGIN) point.y = below;
              else if (next.launcher.x - rect.width - 18 >= view.x + MARGIN)
                point = { x: next.launcher.x - rect.width - 18, y: next.launcher.y - rect.height / 2 };
              else if (next.launcher.x + anchor.width + 18 + rect.width <= view.x + view.width - MARGIN)
                point = { x: next.launcher.x + anchor.width + 18, y: next.launcher.y - rect.height / 2 };
            }
            next.panel = clamp(point, rect);
          }
        }
        if (same(current.launcher, next.launcher) && same(current.panel, next.panel)) return previous;
        return { ...previous, [page]: next };
      });
    }
    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    if (launcher.current) observer?.observe(launcher.current);
    if (panel.current) observer?.observe(panel.current);
    return () => { window.removeEventListener("resize", fit); window.visualViewport?.removeEventListener("resize", fit); observer?.disconnect(); };
  }, [page, open, host, launcher, panel]);
  useLayoutEffect(() => { drag.current = null; setMoving(null); }, [page, host]);

  function events(kind, ref) {
    return {
      onPointerDown(event) {
        if ((event.button != null && event.button !== 0) || event.isPrimary === false) return;
        if (kind === "panel" && event.target.closest("button") && !event.target.closest("[data-ai-drag-handle]")) return;
        lastDrag.current = 0;
        const rect = ref.current.getBoundingClientRect();
        drag.current = { kind, id: event.pointerId, startX: event.clientX, startY: event.clientY, x: rect.x, y: rect.y, rect, moved: false };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      },
      onPointerMove(event) {
        const current = drag.current;
        if (!current || current.kind !== kind || current.id !== event.pointerId) return;
        const dx = event.clientX - current.startX, dy = event.clientY - current.startY;
        if (!current.moved && Math.hypot(dx, dy) < 5) return;
        current.moved = true; setMoving(kind); event.preventDefault();
        save(kind, clamp({ x: current.x + dx, y: current.y + dy }, current.rect));
      },
      onPointerUp(event) { finish(event); },
      onPointerCancel(event) { finish(event); },
      onLostPointerCapture(event) { finish(event); },
    };
  }
  function finish(event) {
    const current = drag.current;
    if (!current || current.id !== event.pointerId) return;
    if (current.moved) lastDrag.current = Date.now();
    drag.current = null; setMoving(null);
  }
  function keyDown(kind, ref, event) {
    if (event.key === "Home") { event.preventDefault(); reset(); return; }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!direction) return;
    event.preventDefault(); const rect = ref.current.getBoundingClientRect(); const step = event.shiftKey ? 40 : 16;
    save(kind, clamp({ x: rect.x + direction[0] * step, y: rect.y + direction[1] * step }, rect));
  }
  return { launcherStyle: positioned(selected.launcher), panelStyle: { maxHeight: Math.max(0, viewportHeight - 16), ...positioned(selected.panel) }, moving, reset,
    launcherEvents: events("launcher", launcher), panelEvents: events("panel", panel),
    launcherKeyDown: event => keyDown("launcher", launcher, event), panelKeyDown: event => keyDown("panel", panel, event),
    consumeDragClick: event => event.detail !== 0 && Date.now() - lastDrag.current < 400 };
}
