'use client';

import { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold } from 'lucide-react';
import { useTranslations } from '@/components/i18n/locale-provider';
import { TEXT_FONTS, TEXT_MAX_LENGTH, textWeight, type TextAlign, type TextSpec } from '@/lib/packaging/text-artwork';

const SWATCHES = ['#111827', '#ffffff', '#0f67e8', '#c2410c', '#15803d', '#b91c1c', '#7c3aed', '#a16207'];

/** Settings for the selected text layer: the words, font, colour and spacing. */
export function TextLayerEditor({ spec, onChange }: { spec: TextSpec; onChange: (patch: Partial<TextSpec>) => void }) {
  const t = useTranslations();
  const [content, setContent] = useState(spec.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const font = TEXT_FONTS.find(item => item.id === spec.font);
  // A new text layer opens with its words selected, ready to type over.
  useEffect(() => {
    const field = textareaRef.current;
    if (field && spec.content === 'Your text') { field.focus(); field.select(); }
    // Only when the editor first opens for this layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <section className="pro-text-editor" aria-label={t('studio.text')}>
    <label className="pro-text-editor-content">
      <span>{t('studio.text')}</span>
      <textarea ref={textareaRef} value={content} rows={Math.min(5, Math.max(2, content.split('\n').length))} maxLength={TEXT_MAX_LENGTH}
        onChange={event => { setContent(event.target.value); onChange({ content: event.target.value }); }} />
    </label>
    <div className="pro-text-editor-row">
      <label className="pro-text-editor-font">
        <span>{t('studio.font')}</span>
        <select value={spec.font} onChange={event => onChange({ font: event.target.value as TextSpec['font'] })}>
          {TEXT_FONTS.map(item => <option key={item.id} value={item.id}>{item.label} · {item.style}</option>)}
        </select>
      </label>
      <button type="button" className="pro-text-editor-toggle" aria-pressed={textWeight(spec) === 700} disabled={!font?.bold}
        title={font?.bold ? t('studio.bold') : t('studio.this_font_has_one_weight')} aria-label={t('studio.bold')}
        onClick={() => onChange({ bold: !spec.bold })}><Bold size={16} /></button>
    </div>
    <div className="pro-text-editor-row">
      <div className="pro-text-editor-align" role="group" aria-label={t('studio.alignment')}>
        {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([align, Icon]) =>
          <button key={align} type="button" aria-pressed={spec.align === align} aria-label={t(`studio.align_${align}`)} title={t(`studio.align_${align}`)}
            onClick={() => onChange({ align: align as TextAlign })}><Icon size={16} /></button>)}
      </div>
      <label className="pro-text-editor-color" title={t('studio.text_colour')}>
        <span className="sr-only">{t('studio.text_colour')}</span>
        <input type="color" value={spec.color} onChange={event => onChange({ color: event.target.value.toLowerCase() })} />
      </label>
    </div>
    <div className="pro-text-editor-swatches" role="group" aria-label={t('studio.text_colour')}>
      {SWATCHES.map(color => <button key={color} type="button" aria-label={color} aria-pressed={spec.color.toLowerCase() === color}
        style={{ background: color }} onClick={() => onChange({ color })} />)}
    </div>
    <label className="pro-text-editor-range">
      <span>{t('studio.letter_spacing')}<b>{Math.round(spec.letterSpacing * 100)}</b></span>
      <input type="range" min={-10} max={50} step={1} value={Math.round(spec.letterSpacing * 100)}
        onChange={event => onChange({ letterSpacing: Number(event.target.value) / 100 })} />
    </label>
    {content.includes('\n') && <label className="pro-text-editor-range">
      <span>{t('studio.line_height')}<b>{spec.lineHeight.toFixed(1)}</b></span>
      <input type="range" min={0.8} max={2.5} step={0.1} value={spec.lineHeight}
        onChange={event => onChange({ lineHeight: Number(event.target.value) })} />
    </label>}
    <p className="pro-text-editor-hint">{t('studio.text_resize_hint')}</p>
  </section>;
}
