'use client';
import { useTranslations } from '@/components/i18n/locale-provider';
import Link from "next/link";
import { ArrowLeft, Box, Layers3, Move3d } from "lucide-react";
import { Brand } from "@/components/site-shell";
import type { ReactNode } from "react";
import "./auth-pages.css";

export function AuthShell({ eyebrow, title, intro, children, footer }: { eyebrow: string; title: string; intro: string; children: ReactNode; footer?: ReactNode }) {
  const t = useTranslations();

  return (
    <main className="auth-page">
      <section className="auth-brand-panel" aria-label={t("auth.3d_box_studio")}>
        <div className="auth-brand-home"><Brand /></div>
        <div className="auth-object" aria-hidden="true">
          <div className="auth-object-grid" />
          <div className="auth-carton"><span /><i /><b>{t("auth.form")}<br />{t("auth.meets")}<br />{t("auth.function")}</b><small>{t("auth.3d_box_studio_2")}</small></div>
          <div className="auth-tool-note auth-tool-note-top"><Layers3 /><span><b>{t("auth.artwork_mapped")}</b><small>{t("auth.front_panel")}</small></span></div>
          <div className="auth-tool-note auth-tool-note-bottom"><Move3d /><span><b>{t("auth.ready_to_review")}</b><small>{t("auth.interactive_prototype")}</small></span></div>
        </div>
        <div className="auth-brand-copy"><p>{t("auth.packaging_ideas_made_tangible")}</p><span>{t("auth.move_from_flat_artwork_to_a_dimensional_review_in_one_focused_workspace")}</span></div>
      </section>
      <section className="auth-form-panel">
        <div className="auth-mobile-head"><Brand /></div>
        <div className="auth-form-wrap">
          <Link href="/" className="auth-back"><ArrowLeft />{" " + t("auth.back_home")}</Link>
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
  const t = useTranslations();

  return <main className="auth-loading"><Box /><span>{t("auth.opening_studio")}</span></main>;
}
