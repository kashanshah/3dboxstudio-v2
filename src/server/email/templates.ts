import { site } from '@/lib/site';

export type RenderedEmail = { subject: string; html: string; text: string };
export type EmailTemplatePreview = RenderedEmail & {
  id: string; label: string; description: string; sourcePath: string;
};

function esc(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function webUrl(value: string) {
  const url = new URL(value);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Email links must be HTTP(S) URLs without credentials');
  return url.toString();
}
function appUrl(path: string) {
  return webUrl(new URL(path, process.env.AUTH_APP_URL?.trim() || site.url).toString());
}
function paragraph(content: string) {
  return `<p style="margin:0 0 20px;font-size:16px;line-height:26px">${content}</p>`;
}
function button(url: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px"><tr><td bgcolor="#0075c4" style="border-radius:8px;mso-padding-alt:14px 24px"><a href="${esc(url)}" style="display:inline-block;padding:14px 24px;border:1px solid #0075c4;border-radius:8px;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:bold;line-height:22px;text-decoration:none">${esc(label)}</a></td></tr></table>`;
}
function fallback(url: string) {
  return `<p style="margin:0 0 8px;color:#626779;font-size:13px;line-height:20px">If the button doesn’t work, copy and paste this link into your browser:</p><p style="margin:0 0 24px;font-size:13px;line-height:20px;word-break:break-all;overflow-wrap:anywhere"><a href="${esc(url)}" style="color:#0075c4;text-decoration:underline">${esc(url)}</a></p>`;
}
function greeting(name?: string | null) {
  return paragraph(name?.trim() ? `Hi ${esc(name.trim())},` : 'Hi there,');
}
function shell(preheader: string, eyebrow: string, title: string, body: string) {
  const origin = webUrl(site.url.toString());
  const logo = webUrl(new URL('/brand/logo-horizontal-light.png', site.url).toString());
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 3D Box Studio</title></head><body style="margin:0;padding:0;background:#f1f5f9;color:#101720;font-family:Arial,Helvetica,sans-serif"><div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${esc(preheader)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9"><tr><td align="center" style="padding:32px 16px"><!--[if mso]><table role="presentation" width="600"><tr><td><![endif]--><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px"><tr><td style="padding:0 0 24px"><a href="${esc(origin)}" style="display:inline-block;color:#101720;text-decoration:none"><img src="${esc(logo)}" width="170" height="45" border="0" alt="3DBoxStudio" style="display:block;width:170px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;color:#101720;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;line-height:24px"></a></td></tr><tr><td bgcolor="#101720" style="padding:28px 24px;border-radius:12px 12px 0 0"><p style="margin:0 0 10px;color:#bbddf6;font-size:12px;font-weight:bold;line-height:18px;letter-spacing:1px;text-transform:uppercase">${esc(eyebrow)}</p><h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:bold;line-height:36px">${esc(title)}</h1></td></tr><tr><td bgcolor="#ffffff" style="padding:28px 24px;border:1px solid #dce3eb;border-top:0;border-radius:0 0 12px 12px;font-size:16px;line-height:26px">${body}</td></tr><tr><td align="center" style="padding:24px 12px;color:#626779;font-size:12px;line-height:20px">3D Box Studio · Design your packaging, your way.<br><a href="${esc(origin)}" style="color:#626779;text-decoration:underline">${esc(site.url.hostname)}</a></td></tr></table><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`;
}
function note(content: string) {
  return `<p style="margin:0;padding-top:20px;border-top:1px solid #dce3eb;color:#626779;font-size:13px;line-height:21px">${content}</p>`;
}

export function renderVerificationTemplate(input: { name?: string | null; verifyUrl: string }): RenderedEmail {
  const url = webUrl(input.verifyUrl);
  const title = 'Verify your email';
  const instructions = 'Confirm your email address to finish setting up your 3D Box Studio account.';
  const expiry = 'This link expires in 24 hours and can only be used once.';
  const safety = 'If you didn’t create an account, you can ignore this email.';
  return {
    subject: `${title} · 3D Box Studio`,
    text: `${input.name?.trim() ? `Hi ${input.name.trim()},` : 'Hi there,'}\n\n${instructions}\n\nVerify email: ${url}\n\n${expiry}\n\n${safety}`,
    html: shell('One quick step to confirm your email. Link valid for 24 hours.', 'Your account', title,
      greeting(input.name) + paragraph(instructions) + button(url, 'Verify email') + paragraph(esc(expiry)) + fallback(url) + note(esc(safety))),
  };
}
export function renderPasswordResetTemplate(input: { name?: string | null; resetUrl: string }): RenderedEmail {
  const url = webUrl(input.resetUrl);
  const title = 'Reset your password';
  const instructions = 'We received a request to reset the password for your 3D Box Studio account. Choose a new password using the link below.';
  const expiry = 'This link expires in 1 hour and can only be used once.';
  const safety = 'If you didn’t request a reset, you can ignore this email. Your password will stay the same. Never share this link with anyone.';
  return {
    subject: `${title} · 3D Box Studio`,
    text: `${input.name?.trim() ? `Hi ${input.name.trim()},` : 'Hi there,'}\n\n${instructions}\n\nReset password: ${url}\n\n${expiry}\n\n${safety}`,
    html: shell('Choose a new password. Your reset link is valid for 1 hour.', 'Account security', title,
      greeting(input.name) + paragraph(instructions) + button(url, 'Reset password') + paragraph(esc(expiry)) + fallback(url) + note(esc(safety))),
  };
}
export function renderWelcomeTemplate(input: { name?: string | null } = {}): RenderedEmail {
  const url = appUrl('/studio');
  return {
    subject: 'Welcome to 3D Box Studio',
    text: `${input.name?.trim() ? `Hi ${input.name.trim()},` : 'Hi there,'}\n\nWelcome to 3D Box Studio. Start with a box template, add your artwork in 2D, and check your packaging in the 3D preview.\n\nOpen Studio: ${url}\n\nYou can return to your saved designs from your Studio home.`,
    html: shell('Your next packaging idea starts here.', 'Let’s create', 'Welcome to your Studio',
      greeting(input.name) + paragraph('Start with a box template, add your artwork in 2D, and check your packaging in the 3D preview.') + button(url, 'Open Studio') + paragraph('You can return to your saved designs from your Studio home.') + fallback(url)),
  };
}
function row(label: string, value: string) {
  return `<tr><th scope="row" align="left" style="width:100px;padding:8px 12px 8px 0;color:#626779;font-size:13px;font-weight:normal;line-height:20px;vertical-align:top">${esc(label)}</th><td style="padding:8px 0;font-size:14px;line-height:22px;word-break:break-word">${value}</td></tr>`;
}
export function renderAdminContactTemplate(input: { id: string; name: string; email: string; topic: string; subject: string; message: string; submittedAt: string }): RenderedEmail {
  const subject = `New contact message · ${input.subject || input.topic || 'Contact form'}`.replace(/[\r\n]+/g, ' ');
  const replyUrl = `mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(`Re: ${input.subject || input.topic || 'Your message'}`)}`;
  const text = `New contact message on 3D Box Studio\n\nName: ${input.name}\nEmail: ${input.email}\nTopic: ${input.topic || '—'}\nSubject: ${input.subject || '—'}\nSubmitted (UTC): ${input.submittedAt}\nSubmission ID: ${input.id}\n\nMessage:\n${input.message}\n\nReply to: ${input.email}\n${replyUrl}`;
  const html = shell(`${input.name || 'A visitor'} sent a contact message.`, 'Admin notification', 'New contact message',
    paragraph('A visitor sent a message through the contact form. Reply directly to this email to get back to them.') +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:20px">${[
      row('Name', esc(input.name || '—')), row('Email', `<a href="${esc(replyUrl)}" style="color:#0075c4">${esc(input.email)}</a>`),
      row('Topic', esc(input.topic || '—')), row('Subject', esc(input.subject || '—')), row('Submitted (UTC)', esc(input.submittedAt)), row('Submission ID', esc(input.id)),
    ].join('')}</table><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px"><tr><td bgcolor="#f1f5f9" style="padding:20px;border:1px solid #dce3eb;border-radius:8px;font-size:15px;line-height:25px;word-break:break-word"><p style="margin:0 0 10px;font-size:12px;font-weight:bold;color:#626779">MESSAGE</p>${esc(input.message).replace(/\r\n|\r|\n/g, '<br>')}</td></tr></table>` + button(replyUrl, 'Reply to message') + note('This notification was sent to the admin address configured in 3D Box Studio.'));
  return { subject, html, text };
}
export function getEmailTemplatePreviews(): EmailTemplatePreview[] {
  const contact = renderAdminContactTemplate({ id: 'sample123', name: 'Alex Morgan', email: 'alex@example.com', topic: 'Feature request', subject: 'Custom dieline support', message: 'Hi, I would like to know whether custom dieline import is planned for V2.\nThanks for your help!', submittedAt: '2026-09-29T18:30:00Z' });
  const welcome = renderWelcomeTemplate({ name: 'Alex' });
  const verification = renderVerificationTemplate({ name: 'Alex', verifyUrl: appUrl('/verify-email?token=sample-preview-token') });
  const reset = renderPasswordResetTemplate({ name: 'Alex', resetUrl: appUrl('/reset-password?token=sample-preview-token') });
  return [
    { id: 'admin-contact-submission', label: 'Admin · Contact submission', description: 'Sent to the configured admin address when contact notifications are enabled. Replies go to the visitor.', ...contact, sourcePath: 'src/server/email/templates.ts' },
    { id: 'welcome', label: 'Welcome', description: 'Preview only. Available as a template; not automatically sent.', ...welcome, sourcePath: 'src/server/email/templates.ts' },
    { id: 'verification', label: 'Email verification', description: 'Sent after email signup or a verification resend. One-use link expires in 24 hours.', ...verification, sourcePath: 'src/server/email/templates.ts' },
    { id: 'password-reset', label: 'Password reset', description: 'Sent for password recovery. One-use link expires in 1 hour.', ...reset, sourcePath: 'src/server/email/templates.ts' },
  ];
}
