export type DeletionKind = 'user' | 'project' | 'design' | 'media';
export type DeletionItem = { id: string; name: string };
export type DeletionPreview = {
  kind: DeletionKind;
  id: string;
  name: string;
  token: string;
  groups: { label: string; items: DeletionItem[] }[];
  updates: { label: string; items: DeletionItem[] }[];
  retainedMedia: DeletionItem[];
};
export type DeletionResult = { jobId: string; pendingFiles: number };
export function isDeletionKind(value: unknown): value is DeletionKind {
  return value === 'user' || value === 'project' || value === 'design' || value === 'media';
}
