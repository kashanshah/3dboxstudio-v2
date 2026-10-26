'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { CartonDimensions } from '@/lib/packaging/reverse-tuck';
import type { TemplateParameterDefinition } from '@/lib/packaging/template-registry';
import type { TemplateDisplayFields } from '@/lib/packaging/template-catalog';

/** A box style as the form needs it: its size controls and own defaults. */
export type AdminTemplateStyle = {
  id: string;
  name: string;
  parameters: TemplateParameterDefinition[];
  defaultDimensions: CartonDimensions;
  defaultMaterial: string;
  thumbnail: string | null;
};

type Original = { name: string; description: string; category: string; order: number | null; thumbnail: string | null };

const SIZES = ['width', 'height', 'depth', 'thickness'] as const;
const text = (value: number | string | undefined) => (value === undefined ? '' : String(value));

/**
 * The display fields of a template. Editing a built-in or JSON template, an
 * empty field keeps the original (shown greyed in it); a named template's
 * fields are its own. With `styles` it adds a named template instead.
 */
export function AdminTemplateForm({ templateId, named, style: fixedStyle, styles, initial, original, materials }: {
  templateId?: string;
  named: boolean;
  style?: AdminTemplateStyle;
  styles?: AdminTemplateStyle[];
  initial: TemplateDisplayFields;
  original: Original | null;
  materials: readonly string[];
}) {
  const router = useRouter();
  const creating = !templateId;
  const [styleId, setStyleId] = useState(fixedStyle?.id ?? styles?.[0]?.id ?? '');
  const style = fixedStyle ?? styles?.find(item => item.id === styleId) ?? null;
  const [slug, setSlug] = useState('');
  const [values, setValues] = useState<Record<string, string>>({
    name: initial.name ?? '', description: initial.description ?? '', category: initial.category ?? '', order: text(initial.order),
    ...Object.fromEntries(SIZES.map(key => [key, text(initial.defaultDimensions?.[key])])),
    defaultMaterial: initial.defaultMaterial ?? '',
  });
  const [thumbnail, setThumbnail] = useState(initial.thumbnail ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const set = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }));
  // A named template starts from its style's size; an edited one from the original.
  const placeholderSize = (key: (typeof SIZES)[number]) => text(style?.defaultDimensions[key]);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.set('file', file);
      const response = await fetch('/api/admin/templates/image', { method: 'POST', body: form });
      const body = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !body.url) { setError(body.error || 'The picture could not be uploaded.'); return; }
      setThumbnail(body.url);
    } catch {
      setError('The picture could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const fields = { ...values, thumbnail };
    try {
      const response = creating
        ? await fetch('/api/admin/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'named', baseTemplateId: styleId, slug, ...fields }) })
        : await fetch(`/api/admin/templates/${encodeURIComponent(templateId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields }) });
      const body = await response.json().catch(() => ({})) as { id?: string; error?: string };
      if (!response.ok) { setError(body.error || 'The template could not be saved.'); return; }
      if (creating && body.id) {
        router.push(`/admin/templates/${encodeURIComponent(body.id)}?created=1`);
        return;
      }
      setMessage('Saved. The site shows the change on its next visit.');
      router.refresh();
    } catch {
      setError('The template could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!templateId || !window.confirm('Clear every change and go back to the original name, size, picture and order?')) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/templates/${encodeURIComponent(templateId)}/reset`, { method: 'POST' });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(body.error || 'The template could not be reset.'); return; }
      setValues({ name: '', description: '', category: '', order: '', width: '', height: '', depth: '', thickness: '', defaultMaterial: '' });
      setThumbnail('');
      setMessage('Back to the original.');
      router.refresh();
    } catch {
      setError('The template could not be reset.');
    } finally {
      setBusy(false);
    }
  };

  const picture = thumbnail || original?.thumbnail || style?.thumbnail || null;
  return <form className="admin-settings-form admin-template-form" onSubmit={submit}>
    {error ? <p className="admin-error" role="alert">{error}</p> : null}
    {message ? <p className="admin-success" role="status">{message}</p> : null}
    {creating && styles ? <>
      <label className="admin-settings-field"><span>Box style</span>
        <select value={styleId} onChange={event => setStyleId(event.target.value)} required>
          {styles.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <small className="admin-muted">Its fold, dieline and exports; your name and defaults.</small>
      </label>
      <label className="admin-settings-field"><span>Slug</span>
        <input value={slug} onChange={event => setSlug(event.target.value.toLowerCase())} required pattern="[a-z][a-z0-9\-]{2,60}" placeholder="candle-box-80x100" autoComplete="off" />
        <small className="admin-muted">Lowercase letters, digits and hyphens. Used in links and kept by designs made from it; it can&apos;t be changed later.</small>
      </label>
    </> : null}
    <label className="admin-settings-field"><span>Name</span>
      <input value={values.name} onChange={event => set('name', event.target.value)} maxLength={80} required={named} placeholder={original?.name} />
    </label>
    <label className="admin-settings-field"><span>Short description</span>
      <textarea value={values.description} onChange={event => set('description', event.target.value)} maxLength={600} rows={4} placeholder={original?.description} />
    </label>
    <div className="admin-template-form-row">
      <label className="admin-settings-field"><span>Category</span>
        <input value={values.category} onChange={event => set('category', event.target.value)} maxLength={40} placeholder={original?.category} />
      </label>
      <label className="admin-settings-field"><span>Card order</span>
        <input type="number" step={1} value={values.order} onChange={event => set('order', event.target.value)} placeholder={text(original?.order ?? undefined)} />
        <small className="admin-muted">Lower first.</small>
      </label>
    </div>
    <fieldset className="admin-settings-group">
      <legend>Default size (mm)</legend>
      <div className="admin-template-size">
        {SIZES.map(key => {
          const control = style?.parameters.find(parameter => parameter.key === key);
          return <label className="admin-settings-field" key={key}>
            <span>{control?.label ?? key}</span>
            <input type="number" step="any" min={control?.min} max={control?.max} value={values[key]} onChange={event => set(key, event.target.value)} placeholder={placeholderSize(key)} />
            {control?.min !== undefined && control.max !== undefined ? <small className="admin-muted">{control.min}–{control.max}</small> : null}
          </label>;
        })}
      </div>
    </fieldset>
    <label className="admin-settings-field"><span>Default material</span>
      <select value={values.defaultMaterial} onChange={event => set('defaultMaterial', event.target.value)}>
        <option value="">{style ? `${named ? 'The style’s' : 'Original'}: ${style.defaultMaterial}` : 'Original'}</option>
        {materials.map(material => <option key={material} value={material}>{material}</option>)}
      </select>
    </label>
    <fieldset className="admin-settings-group">
      <legend>Picture</legend>
      <div className="admin-template-picture">
        {/* eslint-disable-next-line @next/next/no-img-element -- a small preview of an upload, not optimised */}
        <span className="admin-design-thumb admin-template-thumb">{picture ? <img src={picture} alt="" /> : <span aria-hidden>3D</span>}</span>
        <div>
          <label className="admin-btn admin-btn-quiet admin-template-upload">
            {uploading ? 'Uploading…' : 'Upload picture'}
            <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading} onChange={event => void upload(event.target.files?.[0])} />
          </label>
          {thumbnail ? <button type="button" className="admin-text-button" onClick={() => setThumbnail('')}>Use the original picture</button> : null}
          <small className="admin-muted">PNG, JPG or WebP, up to 5 MB, shown on template cards.</small>
        </div>
      </div>
    </fieldset>
    <div className="admin-settings-actions">
      <button className="admin-btn" disabled={busy || uploading}>{busy ? 'Saving…' : creating ? 'Add template' : 'Save changes'}</button>
      {!creating && !named ? <button type="button" className="admin-btn admin-btn-quiet" disabled={busy} onClick={() => void reset()}>Reset to original</button> : null}
    </div>
  </form>;
}
