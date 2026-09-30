'use client';
import Link from "next/link";
import { ArrowLeft, Box, Layers3, Move3d } from "lucide-react";
import { Brand } from "@/components/site-shell";
import type { ReactNode } from "react";
import "./auth-pages.css";

export function AuthShell({ eyebrow, title, intro, children, footer }: { eyebrow: string; title: string; intro: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label="3D Box Studio">
        <div className="auth-brand-home"><Brand /></div>
        <div className="auth-object" aria-hidden="true">
          <div className="auth-object-grid" />
          <div className="auth-carton"><span /><i /><b>FORM<br />MEETS<br />FUNCTION</b><small>3D BOX STUDIO</small></div>
          <div className="auth-tool-note auth-tool-note-top"><Layers3 /><span><b>Artwork mapped</b><small>Front panel</small></span></div>
          <div className="auth-tool-note auth-tool-note-bottom"><Move3d /><span><b>Ready to review</b><small>Interactive prototype</small></span></div>
        </div>
        <div className="auth-brand-copy"><p>Packaging ideas, made tangible.</p><span>Move from flat artwork to a dimensional review in one focused workspace.</span></div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-mobile-head"><Brand /></div>
        <div className="auth-form-wrap">
          <Link href="/" className="auth-back"><ArrowLeft /> Back home</Link>
          <header className="auth-heading"><p>{eyebrow}</p><h1>{title}</h1><span>{intro}</span></header>
          {children}
          {footer && <footer className="auth-form-footer">{footer}</footer>}
        </div>
      </section>
    </main>
  );
}

export function AuthNotice({ kind = "success", children }: { kind?: "success" | "error" | "info"; children: ReactNode }) {
  return <div className={`auth-notice is-${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

export function AuthLoading() {
  return <main className="auth-loading"><Box /><span>Opening Studio…</span></main>;
}
