'use client';

import { useState } from 'react';
import { PaintBucket } from 'lucide-react';
import { useTranslations } from '@/components/i18n/locale-provider';

const SWATCHES = ['#ffffff', '#111827', '#0f67e8', '#c2410c', '#15803d', '#b91c1c', '#7c3aed', '#f5d0a9', '#fde68a', '#d1d5db'];

/**
 * Colours one panel. With `editing` (a panel colour layer is selected) the
 * panel is fixed and the colour applies as it is picked; otherwise the person
 * picks a panel and a colour and fills it.
 */
export function PanelColourCard({ panels, initialPanel, editing, onFill }: {
  panels: { id: string; name: string }[];
  initialPanel?: string;
  editing?: { panelId: string; color: string };
  onFill: (panelId: string, color: string) => void;
}) {
  const t = useTranslations();
  const [panelId, setPanelId] = useState(editing?.panelId ?? (panels.some(panel => panel.id === initialPanel) ? initialPanel! : panels[0]?.id ?? ''));
  const [color, setColor] = useState(editing?.color ?? '#0f67e8');
  const pick = (next: string) => { setColor(next); if (editing) onFill(editing.panelId, next); };
  if (!panels.length) return null;
  return <section className="pro-panel-colour" aria-label={t('studio.panel_colour')}>
    <span className="pro-panel-colour-title"><PaintBucket size={14} />{editing ? t('studio.panel_colour_of', { panel: panels.find(panel => panel.id === editing.panelId)?.name ?? '' }) : t('studio.panel_colour')}</span>
    {!editing && <label>
      <span className="sr-only">{t('studio.panel')}</span>
      <select value={panelId} onChange={event => setPanelId(event.target.value)}>
        {panels.map(panel => <option key={panel.id} value={panel.id}>{panel.name}</option>)}
      </select>
    </label>}
    <div className="pro-panel-colour-row">
      <div className="pro-text-editor-swatches" role="group" aria-label={t('studio.colour')}>
        {SWATCHES.map(swatch => <button key={swatch} type="button" aria-label={swatch} aria-pressed={color.toLowerCase() === swatch} style={{ background: swatch }} onClick={() => pick(swatch)} />)}
      </div>
      <label className="pro-text-editor-color" title={t('studio.colour')}>
        <span className="sr-only">{t('studio.colour')}</span>
        <input type="color" value={color} onChange={event => pick(event.target.value.toLowerCase())} />
      </label>
    </div>
    {!editing && <button type="button" className="pro-secondary-button pro-panel-colour-apply" disabled={!panelId} onClick={() => onFill(panelId, color)}>
      <PaintBucket size={15} />{' ' + t('studio.fill_panel')}
    </button>}
  </section>;
}
