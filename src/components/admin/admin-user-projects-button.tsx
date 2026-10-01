'use client';

import { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from 'lucide-react';
import { formatAdminDateTime } from '@/lib/admin-time-zone';
import type { AdminUserProjectItem } from '@/server/admin/catalog';

type Props = {
  userId: string;
  userEmail: string;
  userName: string;
  projectCount: number;
};

export function AdminUserProjectsButton({ userId, userEmail, userName, projectCount }: Props) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<AdminUserProjectItem[]>([]);
  const [total, setTotal] = useState(projectCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();

  function openModal() {
    setOpen(true);
    setProjects([]);
    setTotal(projectCount);
    setError(null);
    setLoading(true);
  }

  function closeModal() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch(`/api/admin/users/${encodeURIComponent(userId)}/projects?pageSize=100`, { cache: 'no-store' })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { items?: AdminUserProjectItem[]; total?: number; error?: string };
        if (!res.ok) throw new Error(body.error ?? 'Could not load projects.');
        return body;
      })
      .then((body) => {
        if (!active) return;
        setProjects(body.items ?? []);
        setTotal(body.total ?? projectCount);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not load projects.');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, userId, projectCount]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button type="button" className="admin-email-open" title={`View projects for ${userEmail}`} onClick={openModal}>
        {projectCount.toLocaleString()} project{projectCount === 1 ? '' : 's'}
      </button>
      {open && typeof document !== 'undefined' ? createPortal(
        <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <section className="admin-modal admin-user-designs-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <header className="admin-modal-header">
              <div>
                <p>User projects</p>
                <h2 id={titleId}>{userName}</h2>
              </div>
              <button type="button" className="admin-modal-close" aria-label="Close user projects" onClick={closeModal} autoFocus>
                <X size={18} />
              </button>
            </header>
            <div className="admin-user-designs">
              <p className="admin-user-designs-meta">{userEmail}{' · '}{total.toLocaleString()} project{total === 1 ? '' : 's'}</p>
              {loading ? <p className="admin-muted">Loading projects…</p> : null}
              {error ? <p className="admin-error">{error}</p> : null}
              {!loading && !error && projects.length === 0 ? <p className="admin-muted">This user has no projects.</p> : null}
              {!loading && !error && projects.length > 0 ? (
                <ul className="admin-user-projects-list">
                  {projects.map((project) => (
                    <li key={project.id}>
                      <div className="admin-user-designs-copy">
                        <div className="admin-user-designs-name">
                          <span>{project.name}</span>
                          {project.isDefault ? <span className="admin-user-project-badge">Default</span> : null}
                        </div>
                        <div className="admin-user-designs-id">{project.id}</div>
                        <div className="admin-muted">
                          {formatAdminDateTime(project.updatedAt ?? project.createdAt ?? '')}
                          {' · '}
                          {project.designCount.toLocaleString()} design{project.designCount === 1 ? '' : 's'}
                          {' · '}
                          {project.sceneCount.toLocaleString()} scene{project.sceneCount === 1 ? '' : 's'}
                        </div>
                      </div>
                      <Link className="admin-link" href={project.href}>Designs</Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!loading && !error && total > projects.length ? (
                <p className="admin-muted admin-user-designs-more">Showing {projects.length.toLocaleString()} of {total.toLocaleString()} projects.</p>
              ) : null}
            </div>
          </section>
        </div>,
        document.querySelector('.admin-root') ?? document.body,
      ) : null}
    </>
  );
}
