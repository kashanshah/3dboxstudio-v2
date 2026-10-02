'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

type Job = { jobId: string; keys: string[] };
export function AdminDeletionCleanup() {
  const [jobs, setJobs] = useState<Job[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => fetch('/api/admin/deletions?jobs=1', { cache: 'no-store', signal: controller.signal }).then(async res => {
      if (res.ok) setJobs((await res.json()).jobs);
    }).catch(() => {});
    refresh();
    window.addEventListener('admin-deletion-updated', refresh);
    return () => { controller.abort(); window.removeEventListener('admin-deletion-updated', refresh); };
  }, [pathname]);
  async function retry() {
    setBusy(true); setError('');
    try {
      for (const job of jobs) {
        const res = await fetch('/api/admin/deletions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jobId: job.jobId }) });
        if (!res.ok) throw new Error('Could not retry file cleanup.');
      }
      const res = await fetch('/api/admin/deletions?jobs=1', { cache: 'no-store' });
      if (!res.ok) throw new Error('Could not refresh file cleanup status.');
      setJobs((await res.json()).jobs);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not clean up files.'); }
    finally { setBusy(false); }
  }
  if (!jobs.length) return null;
  return <aside className="admin-cleanup-notice" role="status"><p>Deleted records have {jobs.reduce((sum, job) => sum + job.keys.length, 0)} stored files awaiting cleanup.</p><details><summary>Pending files</summary>{jobs.map(job => <ul key={job.jobId}>{job.keys.map(key => <li key={key}>{key}</li>)}</ul>)}</details>{error ? <p className="admin-error">{error}</p> : null}<button type="button" className="admin-delete-button" disabled={busy} onClick={retry}>{busy ? 'Cleaning up…' : 'Retry file cleanup'}</button></aside>;
}
