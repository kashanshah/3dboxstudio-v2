"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogFocus } from "@/components/auth/use-dialog-focus";
import { Turnstile } from "@/components/turnstile";
import { QUOTE_COLOURS, QUOTE_CONSENT, QUOTE_FINISHES, QUOTE_QUANTITIES, type QuoteBox } from "@/content/print-quote";
import { trackEvent } from "@/lib/analytics";
import "./print-quote-dialog.css";

// "Get this box printed": a request for a print quote for the box on the
// generator. It is stored and emailed to us; there is no printing partner
// integration yet, so the dialog promises a reply, not a price.

export function PrintQuoteDialog({ box, onClose }: { box: QuoteBox; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const ref = useDialogFocus<HTMLDivElement>(true, onClose, busy);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "").trim();
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/print-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          box, quantity: field("quantity"), colours: field("colours"), finish: field("finish"), deadline: field("deadline") || null,
          name: field("name"), email: field("email"), country: field("country"), notes: field("notes"), consent: data.get("consent") === "on",
          locale: "en", turnstileToken: token,
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(body.error ?? "Could not send your request. Please try again."); return; }
      setSent(true);
      trackEvent("print_quote_submitted", { box_type: box.style, quantity: field("quantity") });
    } catch {
      setError("Could not send your request. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const size = `${box.length} × ${box.width} × ${box.depth} ${box.units}`;
  return createPortal(<div className="pq-backdrop" onPointerDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={ref} className="pq-dialog" role="dialog" aria-modal="true" aria-labelledby="pq-title" aria-describedby="pq-intro" tabIndex={-1}>
      <div className="pq-head">
        <h2 id="pq-title">Get this box printed</h2>
        <button type="button" className="pq-close" onClick={onClose} disabled={busy} aria-label="Close"><X aria-hidden="true" /></button>
      </div>
      {sent ? <div className="pq-sent" role="status">
        <p><b>Request sent.</b> We will email you at the address you gave, usually within a few business days, with what printing this box would involve.</p>
        <button type="button" className="pq-submit" onClick={onClose} data-autofocus>Done</button>
      </div> : <form onSubmit={submit}>
        <p id="pq-intro" className="pq-intro">Tell us what you need and we will come back to you with options for printing it. Asking is free and commits you to nothing.</p>
        <dl className="pq-box">
          <div><dt>Box</dt><dd>{box.styleName}</dd></div>
          <div><dt>Size</dt><dd>{size}, {box.mode}</dd></div>
          <div><dt>Board</dt><dd>{box.material}, {box.thickness} mm</dd></div>
        </dl>
        {error ? <p className="pq-error" role="alert">{error}</p> : null}
        <div className="pq-grid">
          <label><span>Quantity</span><select name="quantity" required data-autofocus defaultValue={QUOTE_QUANTITIES[2]}>{QUOTE_QUANTITIES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>Printing</span><select name="colours" required defaultValue={QUOTE_COLOURS[0]}>{QUOTE_COLOURS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>Finish</span><select name="finish" required defaultValue={QUOTE_FINISHES[0]}>{QUOTE_FINISHES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>Needed by <small>(optional)</small></span><input name="deadline" type="date" /></label>
          <label><span>Name</span><input name="name" autoComplete="name" maxLength={120} required /></label>
          <label><span>Email</span><input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          <label><span>Country</span><input name="country" autoComplete="country-name" maxLength={80} required /></label>
        </div>
        <label className="pq-notes"><span>Anything else <small>(optional)</small></span><textarea name="notes" rows={3} maxLength={2000} placeholder="Artwork, inserts, delivery address region…" /></label>
        <label className="pq-consent"><input type="checkbox" name="consent" required /><span>{QUOTE_CONSENT} See the <a href="/privacy" target="_blank" rel="noopener">privacy policy</a>.</span></label>
        <Turnstile onToken={setToken} action="print_quote" />
        <button type="submit" className="pq-submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
      </form>}
    </div>
  </div>, document.body);
}
