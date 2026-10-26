import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminDesignThumb } from '@/components/admin/admin-design-thumb';
import { AdminTemplateToggle } from '@/components/admin/admin-template-toggle';
import { adminRelative } from '@/components/admin/admin-format';
import { getPackagingTemplate } from '@/lib/packaging/template-registry';
import { listAdminTemplates } from '@/server/admin/templates';

export const metadata: Metadata = { title: 'Admin — Templates' };

const SOURCE: Record<string, string> = { 'built-in': 'Built-in', named: 'Named', json: 'JSON' };

export default async function AdminTemplatesPage() {
  const { templates } = await listAdminTemplates();
  const active = templates.filter(template => template.active).length;
  return <>
    <AdminPageHeader title="Templates" description="Every box template on the site. Inactive templates are hidden from the gallery, Studio and generator; designs that use them keep working." />
    <div className="admin-template-actions">
      <Link className="admin-btn" href="/admin/templates/new">Add template</Link>
      <Link className="admin-btn admin-btn-quiet" href="/admin/templates/new?kind=json">Upload JSON definition</Link>
    </div>
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>All templates</h2>
        <p>{active} active of {templates.length}</p>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table admin-table-rich admin-templates-table">
          <thead>
            <tr>
              <th><span className="sr-only">Picture</span></th>
              <th>Template</th>
              <th>Status</th>
              <th>Source</th>
              <th className="admin-num">Designs</th>
              <th>Updated</th>
              <th><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody>
            {templates.map(template => {
              const style = template.source === 'named' ? getPackagingTemplate(template.templateId)?.name ?? template.templateId : template.source === 'json' ? 'Uploaded definition' : template.category;
              return <tr key={template.id} className={template.active ? undefined : 'is-inactive'}>
                <td><AdminDesignThumb src={template.thumbnail ?? null} name={template.name} /></td>
                <td>
                  <Link className="admin-row-link" href={`/admin/templates/${encodeURIComponent(template.id)}`}><strong>{template.name}</strong></Link>
                  <small className="admin-cell-sub">{style}{template.customized ? ' · edited' : ''} · <code>{template.id}</code></small>
                </td>
                <td><AdminTemplateToggle id={template.id} name={template.name} active={template.active} /></td>
                <td><span className="admin-chip">{SOURCE[template.source]}</span></td>
                <td className="admin-num">{template.designCount
                  ? <Link href={`/admin/designs?template=${encodeURIComponent(template.id)}`} aria-label={`${template.designCount} designs using ${template.name}`}>{template.designCount.toLocaleString('en-US')}</Link>
                  : <span className="admin-muted">0</span>}</td>
                <td className="admin-nowrap">{template.updatedAt ? adminRelative(template.updatedAt) : <span className="admin-muted">Never changed</span>}</td>
                <td><Link className="admin-link" href={`/admin/templates/${encodeURIComponent(template.id)}`}>Edit</Link></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  </>;
}
