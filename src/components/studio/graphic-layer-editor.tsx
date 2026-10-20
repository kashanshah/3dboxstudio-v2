'use client';

import { useState } from 'react';
import { ArrowRight, Circle, Minus, RectangleHorizontal, Square, Star, Triangle } from 'lucide-react';
import { useTranslations } from '@/components/i18n/locale-provider';
import {
  BARCODE_MAX_LENGTH, QR_MAX_LENGTH, SHAPE_KINDS, STROKE_MAX_MM, barcodeError,
  type BarcodeFormat, type BarcodeSpec, type GraphicSpec, type QrSpec, type ShapeKind, type ShapeSpec,
} from '@/lib/packaging/graphic-artwork';

const SWATCHES = ['#111827', '#ffffff', '#0f67e8', '#c2410c', '#15803d', '#b91c1c', '#7c3aed', '#fde68a'];
const SHAPE_ICONS: Record<ShapeKind, typeof Square> = {
  rectangle: RectangleHorizontal, rounded: Square, ellipse: Circle, triangle: Triangle, star: Star, line: Minus, arrow: ArrowRight,
};
const FORMAT_LABELS: Record<BarcodeFormat, string> = { ean13: 'EAN-13', upca: 'UPC-A', code128: 'Code 128' };
/** QRfinity, our sister site, for codes the box designer doesn't make: editable QR codes and more barcode types. */
const QRFINITY_DYNAMIC = 'https://qrfinity.com/dynamic-qr-code-generator?utm_source=3dboxstudio&utm_medium=referral&utm_campaign=studio_qr';
const QRFINITY_BARCODES = 'https://qrfinity.com/barcode-generator?utm_source=3dboxstudio&utm_medium=referral&utm_campaign=studio_barcode';

/** Swatches and a picker; with `optional`, a None button clears the colour. */
function ColourField({ label, value, optional, onChange }: { label: string; value: string | null; optional?: boolean; onChange: (color: string | null) => void }) {
  const t = useTranslations();
  return <div className="pro-graphic-colour">
    <span>{label}</span>
    <div className="pro-panel-colour-row">
      <div className="pro-text-editor-swatches" role="group" aria-label={label}>
        {optional && <button type="button" className="pro-swatch-none" aria-label={t('studio.no_colour')} title={t('studio.no_colour')} aria-pressed={value === null} onClick={() => onChange(null)} />}
        {SWATCHES.map(swatch => <button key={swatch} type="button" aria-label={swatch} aria-pressed={value?.toLowerCase() === swatch} style={{ background: swatch }} onClick={() => onChange(swatch)} />)}
      </div>
      <label className="pro-text-editor-color" title={label}>
        <span className="sr-only">{label}</span>
        <input type="color" value={value ?? '#ffffff'} onChange={event => onChange(event.target.value.toLowerCase())} />
      </label>
    </div>
  </div>;
}

function ShapeEditor({ spec, onChange }: { spec: ShapeSpec; onChange: (patch: Partial<ShapeSpec>) => void }) {
  const t = useTranslations();
  const linear = spec.shape === 'line' || spec.shape === 'arrow';
  return <>
    <div className="pro-graphic-shapes" role="group" aria-label={t('studio.shape')}>
      {SHAPE_KINDS.map(shape => {
        const Icon = SHAPE_ICONS[shape];
        return <button key={shape} type="button" aria-pressed={spec.shape === shape} aria-label={t(`studio.shape_${shape}`)} title={t(`studio.shape_${shape}`)}
          onClick={() => onChange({ shape })}><Icon size={16} /></button>;
      })}
    </div>
    {linear
      ? <ColourField label={t('studio.colour')} value={spec.stroke ?? spec.fill} onChange={color => onChange({ stroke: color, fill: null })} />
      : <>
        <ColourField label={t('studio.fill')} value={spec.fill} optional onChange={fill => onChange(fill === null && spec.stroke === null ? { fill, stroke: '#111827' } : { fill })} />
        <ColourField label={t('studio.outline')} value={spec.stroke} optional onChange={stroke => onChange(stroke === null && spec.fill === null ? { stroke, fill: '#111827' } : { stroke })} />
      </>}
    {(linear || spec.stroke) && <label className="pro-text-editor-range">
      <span>{t('studio.thickness_mm')}<b>{spec.strokeMm.toFixed(1)}</b></span>
      <input type="range" min={0.2} max={10} step={0.1} value={Math.min(spec.strokeMm, STROKE_MAX_MM)} onChange={event => onChange({ strokeMm: Number(event.target.value) })} />
    </label>}
    <p className="pro-text-editor-hint">{t('studio.shape_resize_hint')}</p>
  </>;
}

function QrEditor({ spec, onChange }: { spec: QrSpec; onChange: (patch: Partial<QrSpec>) => void }) {
  const t = useTranslations();
  const [value, setValue] = useState(spec.value);
  return <>
    <label className="pro-text-editor-content">
      <span>{t('studio.qr_content')}</span>
      <textarea value={value} rows={2} maxLength={QR_MAX_LENGTH} spellCheck={false}
        onChange={event => { setValue(event.target.value); if (event.target.value.trim()) onChange({ value: event.target.value.trim() }); }} />
    </label>
    <ColourField label={t('studio.colour')} value={spec.color} onChange={color => color && onChange({ color })} />
    <ColourField label={t('studio.background')} value={spec.background} optional onChange={background => onChange({ background })} />
    <p className="pro-text-editor-hint">{t('studio.qr_hint')}</p>
    <p className="pro-text-editor-hint">{t('studio.qr_dynamic_hint')} <a className="pro-text-editor-hint-link" href={QRFINITY_DYNAMIC} target="_blank" rel="noopener">{t('studio.qr_dynamic_link')}</a></p>
  </>;
}

function BarcodeEditor({ spec, onChange }: { spec: BarcodeSpec; onChange: (patch: Partial<BarcodeSpec>) => void }) {
  const t = useTranslations();
  const [format, setFormat] = useState(spec.format);
  const [value, setValue] = useState(spec.value);
  const error = barcodeError(format, value);
  const commit = (nextFormat: BarcodeFormat, nextValue: string) => {
    setFormat(nextFormat); setValue(nextValue);
    if (!barcodeError(nextFormat, nextValue)) onChange({ format: nextFormat, value: nextValue });
  };
  return <>
    <label className="pro-text-editor-font">
      <span>{t('studio.barcode_type')}</span>
      <select value={format} onChange={event => commit(event.target.value as BarcodeFormat, value)}>
        {(Object.keys(FORMAT_LABELS) as BarcodeFormat[]).map(item => <option key={item} value={item}>{FORMAT_LABELS[item]}</option>)}
      </select>
    </label>
    <label className="pro-text-editor-content">
      <span>{t('studio.barcode_value')}</span>
      <input type="text" value={value} maxLength={BARCODE_MAX_LENGTH} spellCheck={false} inputMode={format === 'code128' ? 'text' : 'numeric'}
        aria-invalid={!!error} aria-describedby={error ? 'barcode-value-error' : undefined}
        onChange={event => commit(format, event.target.value.trim())} />
    </label>
    {error && <p id="barcode-value-error" className="pro-field-error" role="alert">{error}</p>}
    <label className="pro-graphic-check">
      <input type="checkbox" checked={spec.showText} onChange={event => onChange({ showText: event.target.checked })} />
      <span>{t('studio.show_digits')}</span>
    </label>
    <ColourField label={t('studio.colour')} value={spec.color} onChange={color => color && onChange({ color })} />
    <ColourField label={t('studio.background')} value={spec.background} optional onChange={background => onChange({ background })} />
    <p className="pro-text-editor-hint">{t('studio.barcode_hint')}</p>
    <p className="pro-text-editor-hint">{t('studio.barcode_more_hint')} <a className="pro-text-editor-hint-link" href={QRFINITY_BARCODES} target="_blank" rel="noopener">{t('studio.barcode_more_link')}</a></p>
  </>;
}

/** Settings for the selected shape, QR code or barcode layer. */
export function GraphicLayerEditor({ spec, onChange }: { spec: GraphicSpec; onChange: (patch: Partial<GraphicSpec>) => void }) {
  const t = useTranslations();
  const label = spec.kind === 'shape' ? t('studio.shape') : spec.kind === 'qr' ? t('studio.add_qr_code') : t('studio.add_barcode');
  return <section className="pro-text-editor pro-graphic-editor" aria-label={label}>
    <span className="pro-panel-colour-title">{label}</span>
    {spec.kind === 'shape' && <ShapeEditor spec={spec} onChange={onChange} />}
    {spec.kind === 'qr' && <QrEditor spec={spec} onChange={onChange} />}
    {spec.kind === 'barcode' && <BarcodeEditor spec={spec} onChange={onChange} />}
  </section>;
}
