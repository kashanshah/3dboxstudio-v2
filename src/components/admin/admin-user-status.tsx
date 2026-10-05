import { CircleCheck, Info, Mail } from 'lucide-react';

export function AdminSignupMethod({ method }: { method: string }) {
  const normalized = method.toLowerCase();
  const google = normalized === 'google';
  const label = google ? 'Signed up with Google' : ['email', 'password'].includes(normalized) ? 'Signed up with email address' : 'Signup method unknown';
  return <span className="admin-user-icon" tabIndex={0} role="img" aria-label={label} title={label}>
    {google ? <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.06.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.06v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.91a6 6 0 0 1 0-3.82V7.5H3.06a10 10 0 0 0 0 9l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.34 2.59C7.19 7.72 9.4 5.96 12 5.96Z"/></svg> : <Mail size={16} aria-hidden="true" />}
  </span>;
}

export function AdminVerificationStatus({ verified }: { verified: boolean }) {
  const label = verified ? 'Verified' : 'Unverified';
  return <span className={`admin-user-icon ${verified ? 'is-verified' : 'is-unverified'}`} tabIndex={0} role="img" aria-label={label} title={label}>
    {verified ? <CircleCheck size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}
  </span>;
}
