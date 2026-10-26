'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** The Active/Inactive switch on a template (Admin → Templates). */
export function AdminTemplateToggle({ id, name, active }: { id: string; name: string; active: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const toggle = async () => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/templates/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !on }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) { setError(body.error || 'Could not change it.'); return; }
      setOn(!on);
      router.refresh();
    } catch {
      setError('Could not change it.');
    } finally {
      setBusy(false);
    }
  };
  return <span className="admin-template-toggle">
    <button type="button" role="switch" aria-checked={on} aria-label={`${name} active`} disabled={busy} onClick={() => void toggle()}>
      <i aria-hidden="true" />{on ? 'Active' : 'Inactive'}
    </button>
    {error ? <small className="admin-error" role="alert">{error}</small> : null}
  </span>;
}
