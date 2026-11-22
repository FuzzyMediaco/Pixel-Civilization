import React, { useRef } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

export type SheetHeight = "peek" | "half" | "full";
const ORDER: SheetHeight[] = ["peek", "half", "full"];

/**
 * Compact, background-less floating bottom sheet:
 * opens at ~1/3 screen height ("peek") by default with floating translucent controls
 * directly over the live 3D island. Tap or drag the handle or chevron to expand/collapse.
 */
export function BottomSheet({
  id,
  title,
  subtitle,
  height,
  onHeightChange,
  onClose,
  children,
  context,
  header,
  headerLead,
  dock,
  closeLabel,
}: {
  id: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  height: SheetHeight;
  onHeightChange: (h: SheetHeight) => void;
  onClose: () => void;
  children: React.ReactNode;
  /** Contextual sheets (inspector) sit above navigation sheets. */
  context?: boolean;
  /** Replaces the title row (for custom headers such as the inspector card). */
  header?: React.ReactNode;
  /** Optional compact leading control (e.g. icon-only Back button). */
  headerLead?: React.ReactNode;
  /** Pinned controls/tabs rendered above the scrolling sheet body. */
  dock?: React.ReactNode;
  closeLabel?: string;
}) {
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const step = (dir: 1 | -1) => {
    const i = ORDER.indexOf(height) + dir;
    if (i < 0) onClose();
    else onHeightChange(ORDER[Math.min(ORDER.length - 1, i)]);
  };
  const nextCycleHeight = (): SheetHeight => ORDER[(ORDER.indexOf(height) + 1) % ORDER.length];

  return (
    <section
      id={id}
      className={"ui-sheet" + (context ? " is-context" : "")}
      data-height={height}
      aria-label={typeof title === "string" ? title : undefined}
      role="region"
    >
      <div className="ui-sheet-head">
        {headerLead}
        <button
          type="button"
          className="ui-sheet-title-drag"
          aria-label={"Resize panel (now " + height + ")"}
          title="Drag or tap to resize"
          onPointerDown={(e) => {
            drag.current = { y: e.clientY, moved: false };
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current && Math.abs(e.clientY - drag.current.y) > 12) drag.current.moved = true;
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (!d) return;
            const dy = e.clientY - d.y;
            if (!d.moved) {
              onHeightChange(nextCycleHeight());
              return;
            }
            if (dy < -24) step(1);
            else if (dy > 24) step(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp") {
              e.preventDefault();
              step(1);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              step(-1);
            }
          }}
        >
          {header ?? (
            <span className="ui-sheet-title-wrap">
              <strong>{title}</strong>
              {subtitle && <span className="ui-sheet-sub">{subtitle}</span>}
            </span>
          )}
        </button>
        <div className="ui-sheet-head-btns">
          <button
            type="button"
            className="ui-sheet-icon-btn"
            aria-label={height === "full" ? "Shrink panel" : "Expand panel"}
            title={height === "full" ? "Compact view" : "Expand view"}
            onClick={() => onHeightChange(nextCycleHeight())}
          >
            {height === "full" ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
          <button
            type="button"
            className="ui-sheet-icon-btn"
            aria-label={closeLabel ?? "Close"}
            title={closeLabel ?? "Close"}
            onClick={onClose}
          >
            <X size={15} />
          </button>
        </div>
      </div>
      {dock}
      <div className="ui-sheet-body">{children}</div>
    </section>
  );
}
