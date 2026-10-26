import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminDeleteTemplate } from '@/components/admin/admin-delete-template';
import { AdminTemplateForm } from '@/components/admin/admin-template-form';
import { AdminTemplatePreview } from '@/components/admin/admin-template-preview';
import { AdminTemplateToggle } from '@/components/admin/admin-template-toggle';
import { BOX_TEMPLATE_SLUGS } from '@/content/box-template-slugs';
import { dielineSvg } from '@/lib/packaging/dieline-vector';
import { getPackagingTemplate, STUDIO_MATERIALS } from '@/lib/packaging/template-registry';
import { getTemplateRuntime } from '@/lib/packaging/template-runtime';
import { decodeRouteParam } from '@/lib/route-params';
import { builtInOrder } from '@/lib/packaging/template-catalog';
import { studioTemplateHref } from '@/lib/studio-entry';
import { getAdminTemplate } from '@/server/admin/templates';

export const metadata: Metadata = { title: 'Admin — Template' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

const SOURCE = { 'built-in': 'Built-in template', named: 'Named template', json: 'Uploaded JSON definition' } as const;

export default async function AdminTemplatePage({ params, searchParams }: Props) {
  const id = decodeRouteParam((await params).id);
  const [found, query] = await Promise.all([getAdminTemplate(id), searchParams]);
  if (!found) notFound();
  const { template, record } = found;
  // Fields are checked against the style the template is drawn by; overrides start from its original record.
  const style = getPackagingTemplate(template.templateId);
  if (!style?.defaultDimensions) notFound();
  const runtime = getTemplateRuntime(template.templateId);
  const size = template.defaultDimensions ?? style.defaultDimensions;
  let svg: string | null = null;
  try {
    const sheet = runtime?.getSheetGeometry?.(runtime.sanitizeParameters(size));
    if (sheet) svg = dielineSvg(sheet, template.name);
  } catch {
    svg = null;
  }
  const named = template.source === 'named';
  const original = named ? null : { name: style.name, description: style.description, category: style.category, order: builtInOrder(template.id), thumbnail: style.thumbnail ?? null };
  const page = template.source === 'built-in' && BOX_TEMPLATE_SLUGS[template.id] ? `/box-templates/${BOX_TEMPLATE_SLUGS[template.id]}` : null;
  return <>
    <AdminPageHeader title={template.name} description={`${SOURCE[template.source]}${named ? ` on the ${style.name}` : ''} · ${template.id}`} />
    <p className="admin-email-back"><Link href="/admin/templates">← All templates</Link></p>
    {query.created ? <p className="admin-success" role="status">{template.source === 'json' ? 'The definition passed every check and is saved as an inactive draft. Review the preview, then make it active.' : 'Template added.'}</p> : null}
    <div className="admin-template-summary">
      <AdminTemplateToggle id={template.id} name={template.name} active={template.active} />
      <span className="admin-muted">{template.designCount
        ? <Link className="admin-link" href={`/admin/designs?template=${encodeURIComponent(template.id)}`}>{template.designCount.toLocaleString('en-US')} design{template.designCount === 1 ? '' : 's'}</Link>
        : 'No designs yet'}</span>
      {page && template.active ? <a className="admin-link" href={page} target="_blank" rel="noopener noreferrer">Template page</a> : null}
      {template.active ? <a className="admin-link" href={studioTemplateHref(template.id, size, 'mm')} target="_blank" rel="noopener noreferrer">Open in Studio</a> : null}
    </div>
    <div className="admin-panel">
      <div className="admin-panel-header"><h2>Preview</h2><p>At the default size</p></div>
      <div className="admin-panel-body">
        <AdminTemplatePreview templateId={template.templateId} definition={template.source === 'json' ? record?.definition ?? null : null} svg={svg} dimensions={size} material={template.defaultMaterial} />
      </div>
    </div>
    <div className="admin-panel">
      <div className="admin-panel-header"><h2>Display</h2><p>{named ? 'Its name and defaults' : 'Empty fields keep the original'}</p></div>
      <AdminTemplateForm templateId={template.id} named={named}
        style={{ id: style.id, name: style.name, parameters: style.parameters, defaultDimensions: style.defaultDimensions, defaultMaterial: style.defaultMaterial, thumbnail: style.thumbnail ?? null }}
        initial={record?.fields ?? {}} original={original} materials={STUDIO_MATERIALS} />
    </div>
    {named ? <AdminDeleteTemplate id={template.id} name={template.name} disabled={template.designCount > 0} /> : null}
  </>;
}
