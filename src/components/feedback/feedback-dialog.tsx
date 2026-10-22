"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useDialogFocus } from "@/components/auth/use-dialog-focus";
import { Turnstile } from "@/components/turnstile";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/content/feedback";
import { trackEvent } from "@/lib/analytics";
import type { FeedbackOpen } from "@/lib/feedback-events";

// The feedback form: what it is about, a message, and an email if the
// visitor wants a reply. It shows the facts sent with it (the page, box and
// size, or the error) so nothing is sent unseen.

export function FeedbackDialog({ request, onClose }: { request: FeedbackOpen; onClose: () => void }) {
  const { user } = useAuth();
  const [kind, setKind] = useState<FeedbackKind>(request.kind ?? "problem");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ email: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const ref = useDialogFocus<HTMLDivElement>(true, onClose, busy);
  const prompt = request.kind === kind && request.prompt ? request.prompt : FEEDBACK_KINDS.find(item => item.value === kind)?.prompt;
  const context = Object.entries(request.context ?? {});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/feedback/site", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, message: String(data.get("message") ?? ""), email: String(data.get("email") ?? ""),
          source: request.source, pagePath: `${window.location.pathname}${window.location.search}`.slice(0, 300), context: request.context ?? {},
          turnstileToken: token,
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(body.error ?? "Could not send your message. Please try again."); return; }
      setSent({ email: String(data.get("email") ?? "").trim() });
      trackEvent("feedback_submitted", { source: request.source, kind });
    } catch {
      setError("Could not send your message. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(<div className="fb-backdrop" onPointerDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={ref} className="fb-dialog" role="dialog" aria-modal="true" aria-labelledby="fb-title" tabIndex={-1}>
      <div className="fb-head">
        <h2 id="fb-title">{sent ? "Thank you" : "Send feedback"}</h2>
        <button type="button" className="fb-close" onClick={onClose} disabled={busy} aria-label="Close"><X aria-hidden="true" /></button>
      </div>
      {sent ? <div className="fb-sent" role="status">
        <p>We read every message, and it goes straight to the people building 3D Box Studio.{sent.email ? ` If we need to know more, we will write to ${sent.email}.` : ""}</p>
        <button type="button" className="fb-submit" onClick={onClose} data-autofocus>Done</button>
      </div> : <form onSubmit={submit}>
        <fieldset className="fb-kinds">
          <legend>What is it about?</legend>
          {FEEDBACK_KINDS.map(item => <label key={item.value} className={kind === item.value ? "is-checked" : undefined}>
            <input type="radio" name="kind" value={item.value} checked={kind === item.value} onChange={() => setKind(item.value)} />
            <span>{item.label}</span>
          </label>)}
        </fieldset>
        {error ? <p className="fb-error" role="alert">{error}</p> : null}
        <label className="fb-field"><span>{prompt}</span><textarea name="message" rows={5} maxLength={3000} required data-autofocus /></label>
        <label className="fb-field"><span>Email <small>(optional, if you would like a reply)</small></span>
          <input name="email" type="email" autoComplete="email" maxLength={254} defaultValue={user?.email ?? ""} placeholder="you@example.com" /></label>
        {context.length ? <details className="fb-context">
          <summary>Sent with your message</summary>
          <dl>{context.map(([key, value]) => <div key={key}><dt>{key.replace(/_/g, " ")}</dt><dd>{String(value)}</dd></div>)}</dl>
        </details> : null}
        <Turnstile onToken={setToken} action="feedback" />
        <button type="submit" className="fb-submit" disabled={busy}>{busy ? "Sending…" : "Send feedback"}</button>
        <p className="fb-note">For anything else, use the <Link href="/contact" onClick={onClose}>contact page</Link>.</p>
      </form>}
    </div>
  </div>, document.body);
}
