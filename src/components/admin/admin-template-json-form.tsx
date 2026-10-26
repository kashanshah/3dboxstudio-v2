'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/**
 * Upload of a parametric template definition (docs/parametric-templates.md),
 * pasted or from a .json file. The server checks it builds before saving it
 * as an inactive draft; what fails comes back in words.
 */
export function AdminTemplateJsonForm({ maxBytes }: { maxBytes: number }) {
  const router = useRouter();
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > maxBytes) { setError(`The file is over ${maxBytes / 1000} kB.`); return; }
    setSource(await file.text());
    setError('');
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'json', source }) });
      const body = await response.json().catch(() => ({})) as { id?: string; error?: string };
      if (!response.ok || !body.id) { setError(body.error || 'The definition could not be saved.'); return; }
      router.push(`/admin/templates/${encodeURIComponent(body.id)}?created=1`);
    } catch {
      setError('The definition could not be saved.');
    } finally {
      setBusy(false);
    }
  };
  return <form className="admin-settings-form admin-template-form" onSubmit={submit}>
    {error ? <div className="admin-error admin-template-json-error" role="alert"><strong>The definition was not saved.</strong> {error}</div> : null}
    <label className="admin-settings-field"><span>Definition (JSON)</span>
      <textarea className="admin-template-json" value={source} onChange={event => setSource(event.target.value)} rows={16} spellCheck={false} required
        placeholder={'{\n  "format": "parametric-template/1",\n  "templateId": "my-box",\n  …\n}'} />
    </label>
    <label className="admin-btn admin-btn-quiet admin-template-upload">
      Load a .json file
      <input type="file" accept="application/json,.json" onChange={event => void load(event.target.files?.[0])} />
    </label>
    <div className="admin-settings-actions">
      <button className="admin-btn" disabled={busy || !source.trim()}>{busy ? 'Checking…' : 'Check and save as draft'}</button>
      <span className="admin-muted">It is saved inactive, with a preview, until you make it active.</span>
    </div>
  </form>;
}
