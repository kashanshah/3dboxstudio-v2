'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from '@/components/i18n/locale-provider';
import { useDialogFocus } from '@/components/auth/use-dialog-focus';
import type { MessageKey } from '@/lib/i18n';

// The first-run tour and the keyboard shortcuts list. The tour points at
// parts of the Studio already on screen; it never changes the design or
// moves between steps, so it is safe to show over a fresh design.

export const TOUR_STORAGE_KEY = 'bx-studio-tour';

type TourStep = { target: string; title: MessageKey; body: MessageKey };

const TOUR_STEPS: TourStep[] = [
  { target: '.pro-workflow-nav', title: 'studio.tour_steps_title', body: 'studio.tour_steps_body' },
  { target: '.pro-inspector.is-open, .pro-inspector', title: 'studio.tour_size_title', body: 'studio.tour_size_body' },
  { target: '.pro-3d-stage.is-active, .pro-view-pane.is-active', title: 'studio.tour_view_title', body: 'studio.tour_view_body' },
  { target: '.pro-workflow-step:nth-child(2)', title: 'studio.tour_design_title', body: 'studio.tour_design_body' },
  { target: '.pro-workflow-step:nth-child(3)', title: 'studio.tour_preview_title', body: 'studio.tour_preview_body' },
  { target: '.pro-file-menu-trigger', title: 'studio.tour_file_title', body: 'studio.tour_file_body' },
];

/** Whether the tour has been finished or skipped on this browser. */
export function tourSeen() {
  try { return window.localStorage.getItem(TOUR_STORAGE_KEY) === 'done'; } catch { return true; }
}

function markTourSeen() {
  try { window.localStorage.setItem(TOUR_STORAGE_KEY, 'done'); } catch { /* storage unavailable: the tour may show again */ }
}

type Rect = { top: number; left: number; width: number; height: number };

const visibleTarget = (selector: string) => {
  for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const box = element.getBoundingClientRect();
    if (box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight) return element;
  }
  return null;
};

/** A short walk through the Studio, one highlighted part at a time. */
export function StudioTour({ onClose }: { onClose: () => void }) {
  const t = useTranslations();
  const steps = TOUR_STEPS;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [card, setCard] = useState<{ top: number; left: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const finish = useCallback(() => { markTourSeen(); onClose(); }, [onClose]);

  // Find this step's part of the page (a part a phone layout hides is shown
  // as a centred card), then place the card beside it: below when there is
  // room, else above, always on screen. Measured in a frame so the card's own
  // size is known.
  const layout = useCallback(() => {
    const target = visibleTarget(step.target);
    const box = target?.getBoundingClientRect();
    const next = box ? { top: box.top, left: box.left, width: box.width, height: box.height } : null;
    const node = cardRef.current;
    const width = node?.offsetWidth ?? 340, height = node?.offsetHeight ?? 180, gap = 12, margin = 12;
    const vw = window.innerWidth, vh = window.innerHeight;
    let top: number, left: number;
    if (!next) { top = Math.max(margin, (vh - height) / 2); left = Math.max(margin, (vw - width) / 2); }
    else {
      top = next.top + next.height + gap;
      if (top + height > vh - margin) top = next.top - height - gap;
      if (top < margin) top = Math.min(vh - height - margin, Math.max(margin, next.top + next.height / 2 - height / 2));
      left = next.width > vw * 0.6 ? next.left + margin : next.left + next.width / 2 - width / 2;
      left = Math.min(vw - width - margin, Math.max(margin, left));
    }
    setRect(next);
    setCard({ top, left });
  }, [step.target]);

  useEffect(() => {
    let frame = window.requestAnimationFrame(layout);
    const again = () => { window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(layout); };
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, true);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener('resize', again); window.removeEventListener('scroll', again, true); };
  }, [layout]);

  // Focus Next once the card is placed (a hidden card can't take focus).
  const placed = card !== null;
  useEffect(() => { if (placed) nextRef.current?.focus(); }, [index, placed]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); finish(); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [finish]);

  const pad = 6;
  return <div className="pro-tour" data-step={index + 1}>
    {rect
      ? <div className="pro-tour-spotlight" aria-hidden="true" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + 2 * pad, height: rect.height + 2 * pad }} />
      : <div className="pro-tour-dim" aria-hidden="true" />}
    <div ref={cardRef} className="pro-tour-card" role="dialog" aria-modal="false" aria-labelledby="pro-tour-title" aria-describedby="pro-tour-body"
      style={card ? { top: card.top, left: card.left } : { visibility: 'hidden' }}>
      <div className="pro-tour-head">
        <span>{t('studio.tour_progress', { step: index + 1, total: steps.length })}</span>
        <button type="button" className="pro-tour-close" aria-label={t('studio.tour_skip')} title={t('studio.tour_skip')} onClick={finish}><X size={16} /></button>
      </div>
      <h2 id="pro-tour-title">{t(step.title)}</h2>
      <p id="pro-tour-body">{t(step.body)}</p>
      <div className="pro-tour-actions">
        {index > 0 ? <button type="button" className="pro-secondary-button" onClick={() => setIndex(index - 1)}>{t('studio.tour_back')}</button> : <button type="button" className="pro-tour-skip" onClick={finish}>{t('studio.tour_skip')}</button>}
        <button ref={nextRef} type="button" className="pro-primary" onClick={() => last ? finish() : setIndex(index + 1)}>{last ? t('studio.tour_done') : t('studio.tour_next')}</button>
      </div>
    </div>
  </div>;
}

type Shortcut = { keys: string[][]; label: MessageKey };

/** Mac shows ⌘ for the command key; other systems Ctrl. */
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

const shortcutGroups = (mod: string): { title: MessageKey; items: Shortcut[] }[] => [
  { title: 'studio.shortcuts_general', items: [
    { keys: [[mod, 'S']], label: 'studio.shortcut_save' },
    { keys: [[mod, 'Z']], label: 'studio.shortcut_undo' },
    { keys: [[mod, 'Shift', 'Z'], ['Ctrl', 'Y']], label: 'studio.shortcut_redo' },
    { keys: [['?']], label: 'studio.shortcut_help' },
  ] },
  { title: 'studio.shortcuts_view', items: [
    { keys: [['Space']], label: 'studio.shortcut_pan' },
    { keys: [['Scroll'], ['Pinch']], label: 'studio.shortcut_zoom' },
  ] },
  { title: 'studio.shortcuts_artwork', items: [
    { keys: [['←', '↑', '→', '↓']], label: 'studio.shortcut_nudge' },
    { keys: [['Shift', '←']], label: 'studio.shortcut_nudge_far' },
    { keys: [['Delete'], ['Backspace']], label: 'studio.shortcut_delete' },
    { keys: [['Esc']], label: 'studio.shortcut_deselect' },
    { keys: [['Alt']], label: 'studio.shortcut_no_snap' },
    { keys: [['Shift']], label: 'studio.shortcut_free_resize' },
    { keys: [['Shift']], label: 'studio.shortcut_rotate_steps' },
  ] },
];

/** The keyboard shortcuts the Studio understands. */
export function ShortcutsDialog({ onClose, returnTo }: { onClose: () => void; returnTo?: RefObject<HTMLElement | null> }) {
  const t = useTranslations();
  const ref = useDialogFocus<HTMLDivElement>(true, onClose, false, returnTo);
  const mod = isMac() ? '⌘' : 'Ctrl';
  return <div className="pro-confirm-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} className="pro-shortcuts-dialog" role="dialog" aria-modal="true" aria-labelledby="pro-shortcuts-title">
      <header>
        <h2 id="pro-shortcuts-title">{t('studio.keyboard_shortcuts')}</h2>
        <button type="button" className="pro-tour-close" data-autofocus aria-label={t('studio.close')} onClick={onClose}><X size={18} /></button>
      </header>
      {shortcutGroups(mod).map(group => <section key={group.title}>
        <h3>{t(group.title)}</h3>
        <dl>
          {group.items.map(item => <div key={item.label}>
            <dt>{t(item.label)}</dt>
            <dd>{item.keys.map((combo, index) => <span key={index}>
              {index > 0 && <i>{t('studio.shortcut_or')}</i>}
              {combo.map(key => <kbd key={key}>{key}</kbd>)}
            </span>)}</dd>
          </div>)}
        </dl>
      </section>)}
    </div>
  </div>;
}
