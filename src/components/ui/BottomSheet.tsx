import React, { useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "./Button";

export type SheetHeight = "peek" | "half" | "full";
const ORDER: SheetHeight[] = ["peek", "half", "full"];

/**
 * The one container for every panel: a bottom sheet with three snap heights on phones
 * and a docked left panel on desktop (see ui.css). Drag or tap the handle to resize;
 * drag down from peek to close.
 */
export function BottomSheet({id, title, subtitle, height, onHeightChange, onClose, children, context, header, closeLabel}: {
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
  closeLabel?: string;
}) {
  const drag = useRef<{y: number; moved: boolean} | null>(null);
  const step = (dir: 1 | -1) => {
    const i = ORDER.indexOf(height) + dir;
    if (i < 0) onClose();
    else onHeightChange(ORDER[Math.min(ORDER.length - 1, i)]);
  };
  return <section id={id} className={"ui-sheet" + (context ? " is-context" : "")} data-height={height} aria-label={typeof title === "string" ? title : undefined} role="region">
    <button type="button" className="ui-sheet-grab" aria-label={"Resize panel (now " + height + ")"}
      onPointerDown={e => {drag.current = {y: e.clientY, moved: false}; (e.target as HTMLElement).setPointerCapture?.(e.pointerId);}}
      onPointerMove={e => {if (drag.current && Math.abs(e.clientY - drag.current.y) > 12) drag.current.moved = true;}}
      onPointerUp={e => {
        const d = drag.current; drag.current = null;
        if (!d) return;
        const dy = e.clientY - d.y;
        if (!d.moved) { onHeightChange(ORDER[(ORDER.indexOf(height) + 1) % ORDER.length]); return; }
        if (dy < -30) step(1); else if (dy > 30) step(-1);
      }}
      onKeyDown={e => {if (e.key === "ArrowUp") {e.preventDefault(); step(1);} if (e.key === "ArrowDown") {e.preventDefault(); step(-1);}}}/>
    <div className="ui-sheet-head">
      {header ?? <h2>{title}{subtitle && <span className="ui-sheet-sub">{subtitle}</span>}</h2>}
      <IconButton aria-label={closeLabel ?? "Close"} icon={<X size={20}/>} onClick={onClose}/>
    </div>
    <div className="ui-sheet-body">{children}</div>
  </section>;
}
