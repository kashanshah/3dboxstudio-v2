import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin-page-header';
import { AdminTemplateForm, type AdminTemplateStyle } from '@/components/admin/admin-template-form';
import { AdminTemplateJsonForm } from '@/components/admin/admin-template-json-form';
import { JSON_TEMPLATE_LIMITS } from '@/lib/packaging/json-templates';
import { getPackagingTemplate, STUDIO_MATERIALS } from '@/lib/packaging/template-registry';
import { listAdminTemplates } from '@/server/admin/templates';

export const metadata: Metadata = { title: 'Admin — Add template' };

type Props = { searchParams: Promise<{ kind?: string }> };

export default async function AdminNewTemplatePage({ searchParams }: Props) {
  const json = (await searchParams).kind === 'json';
  const { templates } = await listAdminTemplates();
  // Any active built-in style, with its original sizes and controls.
  const styles: AdminTemplateStyle[] = templates.filter(entry => entry.source === 'built-in' && entry.active).flatMap(entry => {
    const style = getPackagingTemplate(entry.id);
    return style?.defaultDimensions ? [{ id: style.id, name: style.name, parameters: style.parameters, defaultDimensions: style.defaultDimensions, defaultMaterial: style.defaultMaterial, thumbnail: style.thumbnail ?? null }] : [];
  });
  return <>
    <AdminPageHeader title="Add template" description="A named template reuses a box style with its own name and defaults. A JSON definition adds a new structure." />
    <p className="admin-email-back"><Link href="/admin/templates">← All templates</Link></p>
    <nav className="admin-tabs" aria-label="Kind of template">
      <Link href="/admin/templates/new" className={json ? undefined : 'is-active'} aria-current={json ? undefined : 'page'}>From a box style</Link>
      <Link href="/admin/templates/new?kind=json" className={json ? 'is-active' : undefined} aria-current={json ? 'page' : undefined}>JSON definition (advanced)</Link>
    </nav>
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h2>{json ? 'Upload a parametric definition' : 'Named template'}</h2>
        <p>{json ? 'Same format as the built-in definitions; see docs/parametric-templates.md' : 'Listed in the gallery, Studio and generator, starting active'}</p>
      </div>
      {json
        ? <AdminTemplateJsonForm maxBytes={JSON_TEMPLATE_LIMITS.bytes} />
        : <AdminTemplateForm named styles={styles} initial={{}} original={null} materials={STUDIO_MATERIALS} />}
    </div>
  </>;
}
