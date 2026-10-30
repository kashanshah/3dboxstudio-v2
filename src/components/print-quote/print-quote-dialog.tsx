"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogFocus } from "@/components/auth/use-dialog-focus";
import { Turnstile } from "@/components/turnstile";
import { COUNTRY_CODES, QUOTE_COLOURS, QUOTE_CONSENT, QUOTE_FINISHES, QUOTE_QUANTITIES, WAITLIST_CONSENT, countryName, printsIn, type QuoteBox } from "@/content/print-quote";
import { trackEvent } from "@/lib/analytics";
import "./print-quote-dialog.css";

// "Get this box printed": a request for a print quote for the box on the
// generator or in the Studio. It is stored and emailed to us; there is no
// printing partner integration yet, so the dialog promises a reply, not a
// price. Printing is offered in some countries only (PRINT_COUNTRIES): the
// country comes first, starting on the visitor's own, and elsewhere the
// dialog takes an email for when printing gets there instead.

export function PrintQuoteDialog({ box, onClose }: { box: QuoteBox; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [country, setCountry] = useState("");
  const ref = useDialogFocus<HTMLDivElement>(true, onClose, busy);
  const countries = useMemo(() => COUNTRY_CODES.map(code => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name)), []);
  const waitlist = Boolean(country) && !printsIn(country);

  // Start on the visitor's country when the host knows it.
  useEffect(() => {
    let live = true;
    fetch("/api/print-quote").then(response => response.ok ? response.json() : null).then((body: { country?: string | null } | null) => {
      if (live && body?.country) setCountry(current => current || body.country!);
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "").trim();
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/print-quote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(waitlist ? {
          waitlist: true, box: { style: box.style, styleName: box.styleName, source: box.source ?? "generator" }, email: field("email"), country,
          consent: data.get("consent") === "on", pagePath: window.location.pathname, turnstileToken: token,
        } : {
          box, quantity: field("quantity"), colours: field("colours"), finish: field("finish"), deadline: field("deadline") || null,
          name: field("name"), email: field("email"), country, notes: field("notes"), consent: data.get("consent") === "on",
          locale: "en", turnstileToken: token,
        }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(body.error ?? "Could not send your request. Please try again."); return; }
      setSent(true);
      if (waitlist) trackEvent("print_waitlist_joined", { box_type: box.style, country, source: box.source ?? "generator" });
      else trackEvent("print_quote_submitted", { box_type: box.style, quantity: field("quantity"), country, source: box.source ?? "generator" });
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
        {waitlist
          ? <p><b>You’re on the list.</b> We’ll email you once when printing is available in {countryName(country)}.</p>
          : <p><b>Request sent.</b> We will email you at the address you gave, usually within a few business days, with what printing this box would involve.</p>}
        <button type="button" className="pq-submit" onClick={onClose} data-autofocus>Done</button>
      </div> : <form onSubmit={submit}>
        <p id="pq-intro" className="pq-intro">Tell us what you need and we will come back to you with options for printing it. Asking is free and commits you to nothing.</p>
        <dl className="pq-box">
          <div><dt>Box</dt><dd>{box.styleName}</dd></div>
          <div><dt>Size</dt><dd>{size}, {box.mode}</dd></div>
          <div><dt>Board</dt><dd>{box.material}, {box.thickness} mm</dd></div>
          {box.finish ? <div><dt>Finish</dt><dd>{box.finish}</dd></div> : null}
        </dl>
        {error ? <p className="pq-error" role="alert">{error}</p> : null}
        <label className="pq-country"><span>Country for delivery</span>
          <select name="country" required data-autofocus value={country} onChange={event => { setCountry(event.target.value); setError(null); }}>
            <option value="" disabled>Choose a country</option>
            {countries.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
        </label>
        {waitlist ? <>
          <p className="pq-waitlist" role="status">We don’t print in {countryName(country)} yet. Leave your email and we’ll tell you when we do.</p>
          <label><span>Email</span><input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
          <label className="pq-consent"><input type="checkbox" name="consent" required /><span>{WAITLIST_CONSENT} See the <a href="/privacy" target="_blank" rel="noopener">privacy policy</a>.</span></label>
          <Turnstile onToken={setToken} action="print_quote" />
          <button type="submit" className="pq-submit" disabled={busy}>{busy ? "Sending…" : "Email me when it’s available"}</button>
        </> : <>
        <div className="pq-grid">
          <label><span>Quantity</span><select name="quantity" required defaultValue={QUOTE_QUANTITIES[2]}>{QUOTE_QUANTITIES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>Printing</span><select name="colours" required defaultValue={QUOTE_COLOURS[0]}>{QUOTE_COLOURS.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>Finish</span><select name="finish" required defaultValue={QUOTE_FINISHES[0]}>{QUOTE_FINISHES.map(item => <option key={item}>{item}</option>)}</select></label>
          <label><span>Needed by <small>(optional)</small></span><input name="deadline" type="date" /></label>
          <label><span>Name</span><input name="name" autoComplete="name" maxLength={120} required /></label>
          <label><span>Email</span><input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
        </div>
        <label className="pq-notes"><span>Anything else <small>(optional)</small></span><textarea name="notes" rows={3} maxLength={2000} placeholder="Artwork, inserts, delivery address region…" /></label>
        <label className="pq-consent"><input type="checkbox" name="consent" required /><span>{QUOTE_CONSENT} See the <a href="/privacy" target="_blank" rel="noopener">privacy policy</a>.</span></label>
        <Turnstile onToken={setToken} action="print_quote" />
        <button type="submit" className="pq-submit" disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
        </>}
      </form>}
    </div>
  </div>, document.body);
}
