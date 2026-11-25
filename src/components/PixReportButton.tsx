import { useState } from "react";

type ResultKind = "advice" | "world" | "design";

export function PixReportButton({ kind, excerpt }: { kind: ResultKind; excerpt: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("inappropriate");
  const [copy, setCopy] = useState(() => excerpt.slice(0, 3000));
  const [id] = useState(() => crypto.randomUUID());
  const [status, setStatus] = useState<"ready" | "sending" | "sent">("ready");
  const [error, setError] = useState("");

  async function send() {
    if (status !== "ready" || !copy.trim()) return;
    setError("");
    setStatus("sending");
    try {
      const response = await fetch("/api/pix/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, kind, reason, excerpt: copy }),
      });
      const result = await response.json();
      if (!response.ok || !result.received) throw new Error(result.error || "Your report could not be saved.");
      setStatus("sent");
    } catch (problem) {
      setError(problem instanceof TypeError || problem instanceof SyntaxError
        ? "Connect to the internet and try again. Your report is still here."
        : problem instanceof Error ? problem.message : "Please try again.");
      setStatus("ready");
    }
  }

  if (status === "sent") return <p className="pix-muted" role="status">Report received. Thank you for flagging this result.</p>;
  if (!open) return <button type="button" className="pc-atlas-toggle-btn" onClick={() => setOpen(true)}>Report this result</button>;
  return (
    <div className="pix-stack" role="group" aria-label="Report a Pix result">
      <label>Reason
        <select value={reason} disabled={status === "sending"} onChange={event => setReason(event.target.value)}>
          <option value="inappropriate">Inappropriate content</option>
          <option value="harmful">Harmful or unsafe advice</option>
          <option value="other">Other concern</option>
        </select>
      </label>
      <label>Text to share with the game team
        <textarea rows={3} maxLength={3000} value={copy} disabled={status === "sending"} onChange={event => setCopy(event.target.value)} />
      </label>
      <p className="pix-muted">You can edit the excerpt or describe a problem you see in the model. Only this text, the reason and the type of result go to the game team.</p>
      <div className="pix-actions">
        <button type="button" className="pc-atlas-primary-btn" disabled={!copy.trim() || status === "sending"} onClick={send}>{status === "sending" ? "Sending…" : "Send report"}</button>
        <button type="button" className="pc-atlas-toggle-btn" disabled={status === "sending"} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {error && <p className="pix-error" role="alert">{error}</p>}
    </div>
  );
}
