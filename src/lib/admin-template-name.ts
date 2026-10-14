import { getPackagingTemplate } from '@/lib/packaging/template-registry';

/** A template's display name for the admin, or its id when it is unknown. */
export function adminTemplateName(id: string | null | undefined): string | null {
  if (!id) return null;
  return getPackagingTemplate(id)?.name ?? id;
}
