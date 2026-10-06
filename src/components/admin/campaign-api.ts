export async function campaignApi<T>(query = '', body?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/admin/campaigns${query}`, { cache: 'no-store', ...(body ? { method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body) } : {}) });
  const result = await response.json().catch(()=>null);
  if (!response.ok) throw new Error(result?.error || 'Could not load campaigns.');
  return result as T;
}
export function campaignDate(value: string | null, timeZone = 'America/Toronto') {
  return value ? new Intl.DateTimeFormat('en-CA',{ timeZone,dateStyle:'medium',timeStyle:'short' }).format(new Date(value)) : '—';
}
export const METRIC_LABELS: Record<string,string> = { sent:'Sent',delivered:'Delivered',unique_opened:'Unique opens',unique_clicked:'Unique clicks',opened:'Total opens',clicked:'Total clicks',bounced:'Bounced',complained:'Complaints',unsubscribed:'Unsubscribed',suppressed:'Suppressed',failed:'Failed',delivery_delayed:'Delayed' };
