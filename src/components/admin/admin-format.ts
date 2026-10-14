import { ADMIN_DISPLAY_TIME_ZONE, formatAdminDateTime } from '@/lib/admin-time-zone';

export function adminDate(value: string | null | undefined): string {
  return value ? formatAdminDateTime(value) : '—';
}

export function adminDay(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-US', { timeZone: ADMIN_DISPLAY_TIME_ZONE, month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

/** "3 min ago", "5 days ago", or the date for anything older than a month. */
export function adminRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const minutes = Math.max(0, Math.round((now - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatAdminDateTime(value);
}

export function adminStars(rating: number): string {
  const full = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

export function adminCount(value: number, one: string, many = `${one}s`): string {
  return `${value.toLocaleString('en-US')} ${value === 1 ? one : many}`;
}
