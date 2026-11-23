import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export type SheetHeight = "peek" | "half" | "full";
const ORDER: SheetHeight[] = ["peek", "half", "full"];
const ANIM_MS = 210;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
}

/**
 * Keeps an exiting bottom sheet mounted long enough for its smooth slide-down
 * compositor animation while immediately disabling pointer/keyboard interaction
 * on the outgoing sheet, and restores focus cleanly when dismissed.
 */
export function AnimatedSheetHost({
  activeKey,
  children,
}: {
  activeKey: string | null;
  children: React.ReactNode;
}) {
  const [renderedKey, setRenderedKey] = useState<string | null>(activeKey);
  const [renderedNode, setRenderedNode] = useState<React.ReactNode>(children);
  const [exiting, setExiting] = useState(false);
  const openerRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (activeKey) {
      if (!renderedKey && typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
        openerRef.current = document.activeElement;
      }
      setRenderedKey(activeKey);
      setRenderedNode(children);
      setExiting(false);
    } else if (renderedKey) {
      if (prefersReducedMotion()) {
        setRenderedKey(null);
        setRenderedNode(null);
        setExiting(false);
        const opener = openerRef.current;
        openerRef.current = null;
        if (opener && opener.isConnected) opener.focus({ preventScroll: true });
      } else {
        setExiting(true);
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          setRenderedKey(null);
          setRenderedNode(null);
          setExiting(false);
          const opener = openerRef.current;
          openerRef.current = null;
          if (opener && opener.isConnected) opener.focus({ preventScroll: true });
        }, ANIM_MS);
      }
    }
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [activeKey]);

  // Keep live children props fresh whenever activeKey is present
  useEffect(() => {
    if (activeKey && activeKey === renderedKey) {
      setRenderedNode(children);
    }
  }, [activeKey, renderedKey, children]);

  if (!renderedKey || !renderedNode) return null;

  return (
    <div
      className={"ui-sheet-stage" + (exiting ? " is-exiting" : "")}
      data-exiting={exiting ? "true" : "false"}
      aria-hidden={exiting || undefined}
      // @ts-expect-error inert is standard HTML5 and prevents tab/hit-test on exiting sheet
      inert={exiting ? "" : undefined}
    >
      {renderedNode}
    </div>
  );
}

/**
 * Compact, gesture-driven floating bottom sheet:
 * - No bulky opaque header bar: slim integrated drag grip + subtle shadowed title above dock.
 * - Direct DOM-ref drag tracking (zero React re-renders during pointermove).
 * - Drag up/down from grip OR pull down from top of scroll container to snap peek/half/full or dismiss.
 * - Accessible keyboard resizing (ArrowUp / ArrowDown / Escape) and screen-reader close button.
 */
export function BottomSheet({
  id,
  title,
  subtitle,
  height,
  onHeightChange,
  onClose,
  closeLabel = "Close",
  context,
  header,
  headerLead,
  headerTrail,
  dock,
  hideTitle,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  height: SheetHeight;
  onHeightChange: (h: SheetHeight) => void;
  onClose: () => void;
  closeLabel?: string;
  context?: boolean;
  header?: React.ReactNode;
  headerLead?: React.ReactNode;
  headerTrail?: React.ReactNode;
  dock?: React.ReactNode;
  hideTitle?: boolean;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastT: number;
    velY: number;
    startH: number;
    fromScroll: boolean;
    dragging: boolean;
  } | null>(null);
  const [entered, setEntered] = useState(prefersReducedMotion);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) {
      setEntered(true);
      return;
    }
    setEntered(false);
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setEntered(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [id]);

  // Escape dismisses active sheet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const tag = (e.target as HTMLElement | null)?.tagName;
        if (tag === "INPUT" && (e.target as HTMLInputElement).value) return;
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resetDragVisuals = () => {
    const el = sheetRef.current;
    if (!el) return;
    el.classList.remove("is-dragging");
    el.style.removeProperty("transform");
    el.style.removeProperty("opacity");
    el.style.removeProperty("height");
  };

  const beginDrag = (e: React.PointerEvent, fromScroll: boolean) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const el = sheetRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: performance.now(),
      velY: 0,
      startH: rect.height,
      fromScroll,
      dragging: !fromScroll,
    };
    if (!fromScroll) {
      el.classList.add("is-dragging");
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore capture issues
      }
    }
  };

  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const el = sheetRef.current;
    if (!d || !el || d.pointerId !== e.pointerId) return;

    const dy = e.clientY - d.startY;
    const now = performance.now();
    const dt = Math.max(1, now - d.lastT);
    d.velY = (e.clientY - d.lastY) / dt; // px/ms
    d.lastY = e.clientY;
    d.lastT = now;

    if (d.fromScroll && !d.dragging) {
      const body = bodyRef.current;
      // Only hijack downward pull from scroll top
      if (dy > 8 && (!body || body.scrollTop <= 1)) {
        d.dragging = true;
        d.startY = e.clientY;
        el.classList.add("is-dragging");
      } else {
        return;
      }
    }

    const effDy = e.clientY - d.startY;
    const vh = window.innerHeight || 800;
    const maxH = Math.min(vh * 0.78, 680);
    const minPeekH = Math.min(vh * 0.31, 266);

    if (effDy > 0 && height === "peek") {
      // Smooth pull-down dismiss from peek with compositor-only transform + opacity
      el.style.transform = `translate3d(0, ${effDy}px, 0)`;
      el.style.opacity = String(Math.max(0.2, 1 - effDy / Math.max(140, d.startH * 0.9)));
    } else if (effDy > 0) {
      // Dragging downward from half/full: shrink height until peek, then translate
      const nextH = d.startH - effDy;
      if (nextH >= minPeekH) {
        el.style.height = `${Math.round(nextH)}px`;
        el.style.transform = "translate3d(0, 0, 0)";
        el.style.opacity = "1";
      } else {
        const overflow = minPeekH - nextH;
        el.style.height = `${Math.round(minPeekH)}px`;
        el.style.transform = `translate3d(0, ${overflow}px, 0)`;
        el.style.opacity = String(Math.max(0.25, 1 - overflow / 160));
      }
    } else {
      // Dragging upward: grow toward half/full smoothly
      const nextH = Math.min(maxH, d.startH - effDy);
      el.style.height = `${Math.round(nextH)}px`;
      el.style.transform = "translate3d(0, 0, 0)";
      el.style.opacity = "1";
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    const wasDragging = d.dragging;
    const dy = e.clientY - d.startY;
    const vel = d.velY; // positive = downward px/ms
    resetDragVisuals();

    if (!wasDragging) return;

    const i = ORDER.indexOf(height);
    // Tap on grip toggles peek <-> half
    if (Math.abs(dy) < 10 && Math.abs(vel) < 0.25 && !d.fromScroll) {
      onHeightChange(height === "peek" ? "half" : "peek");
      return;
    }

    // Fast flick down or pulled far down
    if (vel > 0.55 || dy > 110) {
      if (height === "peek" || vel > 1.1 || dy > 190) {
        onClose();
      } else {
        onHeightChange(ORDER[Math.max(0, i - 1)]);
      }
      return;
    }
    if (dy > 42) {
      if (i === 0) onClose();
      else onHeightChange(ORDER[i - 1]);
      return;
    }

    // Fast flick up or dragged up
    if (vel < -0.55 || dy < -120) {
      onHeightChange(dy < -180 || vel < -1.0 ? "full" : ORDER[Math.min(2, i + 1)]);
      return;
    }
    if (dy < -40) {
      onHeightChange(ORDER[Math.min(2, i + 1)]);
    }
  };

  const onGripKeyDown = (e: React.KeyboardEvent) => {
    const i = ORDER.indexOf(height);
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onHeightChange(ORDER[Math.min(2, i + 1)]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (i === 0) onClose();
      else onHeightChange(ORDER[i - 1]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onHeightChange(height === "peek" ? "half" : height === "half" ? "full" : "peek");
    }
  };

  return (
    <section
      ref={sheetRef}
      id={id}
      role="region"
      aria-label={title}
      className={
        "ui-sheet" +
        (context ? " is-context" : "") +
        (entered ? " is-entered" : " is-entering")
      }
      data-height={height}
    >
      {/* Slim floating header + drag handle (no bulky card box) */}
      <div
        className={"ui-sheet-rail" + (header ? " has-custom-header" : "")}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button, input, a, select")) return;
          beginDrag(e, false);
        }}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {headerLead && <div className="ui-sheet-rail-lead">{headerLead}</div>}

        {header ? (
          <div className="ui-sheet-custom-head">{header}</div>
        ) : (
          <div className="ui-sheet-rail-center">
            <button
              type="button"
              className="ui-sheet-grip-btn"
              aria-label={`${title} sheet height: ${height}. Swipe or press up/down arrow to resize, down from peek to close`}
              title="Swipe up/down to resize or close"
              onKeyDown={onGripKeyDown}
              onClick={() => onHeightChange(height === "peek" ? "half" : "peek")}
            >
              <span className="ui-sheet-grip" aria-hidden="true" />
            </button>
            {!hideTitle && (
              <div className="ui-sheet-shadow-title">
                <h2>{title}</h2>
                {subtitle && <span className="ui-sheet-shadow-sub">{subtitle}</span>}
              </div>
            )}
          </div>
        )}

        {headerTrail && <div className="ui-sheet-rail-trail">{headerTrail}</div>}

        {/* Keyboard/screen-reader accessible close (visually minimal; swipe-down & Esc are primary) */}
        <button
          type="button"
          className="ui-sheet-sr-close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          {closeLabel}
        </button>
      </div>

      {dock && (
        <div
          className="ui-sheet-dock-wrap"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button, input, a, select, [role='slider']")) return;
            beginDrag(e, false);
          }}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {dock}
        </div>
      )}

      <div
        ref={bodyRef}
        className="ui-sheet-body"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("input[type='range']")) return;
          beginDrag(e, true);
        }}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {children}
      </div>
    </section>
  );
}
