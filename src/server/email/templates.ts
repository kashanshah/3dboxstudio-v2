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
// Onboarding emails (src/server/onboarding-emails.ts): a welcome when an
// account is verified, and one follow-up a few days later. Both carry an
// unsubscribe link and ask the reader to reply with what they are making.
function unsubscribeNote(url: string) {
  return note(`You get this because you created a 3D Box Studio account. We send two of these emails, no more. <a href="${esc(url)}" style="color:#626779">Unsubscribe</a>`);
}
function bullets(items: string[]) {
  return `<ul style="margin:0 0 20px;padding-left:20px;font-size:16px;line-height:26px">${items.map(item => `<li style="margin:0 0 8px">${item}</li>`).join('')}</ul>`;
}
const textGreeting = (name?: string | null) => name?.trim() ? `Hi ${name.trim()},` : 'Hi there,';

export function renderWelcomeTemplate(input: { name?: string | null; unsubscribeUrl: string }): RenderedEmail {
  const studio = appUrl('/studio'), generator = appUrl('/box-dieline-generator'), templates = appUrl('/box-templates');
  const unsubscribe = webUrl(input.unsubscribeUrl);
  const intro = 'Thanks for joining. Three ways to start:';
  const ask = 'What are you making? Reply to this email and tell us. We read every reply, and it decides what we build next.';
  return {
    subject: 'Welcome to 3D Box Studio',
    text: `${textGreeting(input.name)}\n\n${intro}\n\n- Design in the 3D Studio: pick a box, add your artwork on the flat dieline and see it folded in 3D. ${studio}\n- Download a dieline in any size, free, as SVG, PDF, DXF or a Cricut and Silhouette file. ${generator}\n- Browse the box templates and what each style is good for. ${templates}\n\n${ask}\n\nYou get this because you created a 3D Box Studio account. We send two of these emails, no more. Unsubscribe: ${unsubscribe}`,
    html: shell('Three ways to start, and one question for you.', 'Welcome', 'Welcome to 3D Box Studio',
      greeting(input.name) + paragraph(esc(intro)) + bullets([
        `<a href="${esc(studio)}" style="color:#0075c4">Design in the 3D Studio</a>: pick a box, add your artwork on the flat dieline and see it folded in 3D.`,
        `<a href="${esc(generator)}" style="color:#0075c4">Download a dieline</a> in any size, free, as SVG, PDF, DXF or a Cricut and Silhouette file.`,
        `<a href="${esc(templates)}" style="color:#0075c4">Browse the box templates</a> and what each style is good for.`,
      ]) + button(studio, 'Open the Studio') + paragraph(esc(ask)) + unsubscribeNote(unsubscribe)),
  };
}
/** A few days after the welcome. What it suggests depends on whether they have saved a design yet. */
export function renderOnboardingFollowUpTemplate(input: { name?: string | null; hasDesign: boolean; unsubscribeUrl: string }): RenderedEmail {
  const unsubscribe = webUrl(input.unsubscribeUrl);
  const studio = appUrl('/studio'), templates = appUrl('/box-templates');
  const intro = input.hasDesign
    ? 'You have started a design. A few things people often miss:'
    : 'You have not saved a design yet. The quickest way in:';
  const tips = input.hasDesign ? [
    ['Share it', 'Send a link that opens your box in 3D, no account needed to view it.'],
    ['Export it', 'Download the print-ready dieline, a PNG or JPG mockup, or a short MP4 video.'],
    ['Another size', 'The dieline generator draws any box style at any size, free, no account needed.'],
  ] : [
    ['Pick a template', 'Choose a box style and size in the Box step.'],
    ['Add artwork', 'Drop in your logo or images and place them on each panel of the flat dieline.'],
    ['Check it in 3D', 'Fold it in the preview, then download the dieline or a mockup.'],
  ];
  const ask = 'Stuck, or missing a box style or feature? Reply to this email. A real person reads it.';
  const [cta, ctaUrl] = input.hasDesign ? ['Open your designs', studio] : ['Choose a box template', templates];
  return {
    subject: input.hasDesign ? 'Your box design: share it, export it, print it' : 'Your first box in three steps',
    text: `${textGreeting(input.name)}\n\n${intro}\n\n${tips.map(([title, body]) => `- ${title}: ${body}`).join('\n')}\n\n${cta}: ${ctaUrl}\n\n${ask}\n\nYou get this because you created a 3D Box Studio account. This is the last of our two welcome emails. Unsubscribe: ${unsubscribe}`,
    html: shell(input.hasDesign ? 'Share, export and size your box.' : 'Template, artwork, 3D preview.', 'Getting started', input.hasDesign ? 'Make the most of your design' : 'Your first box in three steps',
      greeting(input.name) + paragraph(esc(intro)) + bullets(tips.map(([title, body]) => `<b>${esc(title)}</b>: ${esc(body)}`)) + button(ctaUrl, cta) + paragraph(esc(ask))
      + note(`You get this because you created a 3D Box Studio account. This is the last of our two welcome emails. <a href="${esc(unsubscribe)}" style="color:#626779">Unsubscribe</a>`)),
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
/** A "Get this box printed" request from the dieline generator. Lines come from quoteLines(). */
export function renderAdminPrintQuoteTemplate(input: { id: string; subject: string; email: string; name: string; lines: [string, string][]; submittedAt: string }): RenderedEmail {
  const subject = input.subject.replace(/[\r\n]+/g, ' ');
  const replyUrl = `mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent('Your box printing quote')}`;
  const lines = [...input.lines, ['Submitted (UTC)', input.submittedAt], ['Request ID', input.id]] as [string, string][];
  const text = `New print quote request on 3D Box Studio\n\n${lines.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nThe visitor agreed that the request may be shared with printing partners.\nReply to: ${input.email}\n${replyUrl}`;
  const html = shell(`${input.name} asked for a print quote.`, 'Admin notification', 'New print quote request',
    paragraph('A visitor asked to get a box printed from the dieline generator. They agreed that the request may be shared with printing partners. Reply directly to this email to get back to them.') +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:20px">${lines.map(([label, value]) => row(label, label === 'Box link' ? `<a href="${esc(value)}" style="color:#0075c4">Open the box</a>` : esc(value).replace(/\r\n|\r|\n/g, '<br>'))).join('')}</table>` +
    button(replyUrl, 'Reply to request') + note('This notification was sent to the admin address configured in 3D Box Studio.'));
  return { subject, html, text };
}
/** Feedback sent from the Studio or the dieline generator. Lines come from feedbackLines(). */
export function renderAdminSiteFeedbackTemplate(input: { id: string; subject: string; replyTo: string | null; lines: [string, string][]; submittedAt: string }): RenderedEmail {
  const subject = `Feedback · ${input.subject}`.replace(/[\r\n]+/g, ' ');
  const replyUrl = input.replyTo ? `mailto:${encodeURIComponent(input.replyTo)}?subject=${encodeURIComponent('Your feedback on 3D Box Studio')}` : null;
  const lines = [...input.lines, ['Submitted (UTC)', input.submittedAt], ['Feedback ID', input.id]] as [string, string][];
  const text = `New feedback on 3D Box Studio\n\n${lines.map(([label, value]) => `${label}: ${value}`).join('\n')}${replyUrl ? `\n\nReply: ${replyUrl}` : '\n\nNo email was given, so this cannot be answered directly.'}`;
  const html = shell('A visitor sent feedback.', 'Admin notification', 'New feedback',
    paragraph(replyUrl ? 'A visitor sent feedback from the site. Reply directly to this email to answer them.' : 'A visitor sent feedback from the site without an email address, so it cannot be answered directly.') +
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-bottom:20px">${lines.map(([label, value]) => row(label, esc(value).replace(/\r\n|\r|\n/g, '<br>'))).join('')}</table>` +
    (replyUrl ? button(replyUrl, 'Reply to feedback') : '') + note('This notification was sent to the admin address configured in 3D Box Studio.'));
  return { subject, html, text };
}
export function getEmailTemplatePreviews(): EmailTemplatePreview[] {
  const contact = renderAdminContactTemplate({ id: 'sample123', name: 'Alex Morgan', email: 'alex@example.com', topic: 'Feature request', subject: 'Custom dieline support', message: 'Hi, I would like to know whether custom dieline import is planned for V2.\nThanks for your help!', submittedAt: '2026-09-29T18:30:00Z' });
  const quote = renderAdminPrintQuoteTemplate({ id: 'sample456', subject: 'Print quote: Mailer box, 500–999', email: 'alex@example.com', name: 'Alex Morgan', submittedAt: '2026-10-20T10:15:00Z', lines: [
    ['Box', 'Mailer box'], ['Size', '220 × 160 × 80 mm (inner)'], ['Board', 'E-flute corrugated, 1.5 mm'], ['Quantity', '500–999'], ['Printing', 'Full colour (CMYK)'], ['Finish', 'Matte'],
    ['Needed by', '2026-12-01'], ['Name', 'Alex Morgan'], ['Email', 'alex@example.com'], ['Country', 'United Kingdom'], ['Notes', 'Printed inside with a pattern.'], ['Box link', appUrl('/box-templates/mailer-box?l=220&w=160&d=80&u=mm')],
  ] });
  const feedback = renderAdminSiteFeedbackTemplate({ id: 'sample789', subject: 'A box or size I need: A hexagon box for candles', replyTo: 'alex@example.com', submittedAt: '2026-10-22T09:05:00Z', lines: [
    ['About', 'A box or size I need'], ['Message', 'A hexagon box for candles, about 80 mm across. Is that planned?'], ['Reply to', 'alex@example.com'],
    ['Sent from', 'generator-style-request'], ['Page', '/box-dieline-generator'], ['style', 'Reverse tuck end'], ['size', '80 x 80 x 100 mm'],
  ] });
  const unsubscribeUrl = appUrl('/unsubscribe?token=sample-preview-token');
  const welcome = renderWelcomeTemplate({ name: 'Alex', unsubscribeUrl });
  const followUp = renderOnboardingFollowUpTemplate({ name: 'Alex', hasDesign: false, unsubscribeUrl });
  const verification = renderVerificationTemplate({ name: 'Alex', verifyUrl: appUrl('/verify-email?token=sample-preview-token') });
  const reset = renderPasswordResetTemplate({ name: 'Alex', resetUrl: appUrl('/reset-password?token=sample-preview-token') });
  return [
    { id: 'admin-contact-submission', label: 'Admin · Contact submission', description: 'Sent to the configured admin address when contact notifications are enabled. Replies go to the visitor.', ...contact, sourcePath: 'src/server/email/templates.ts' },
    { id: 'admin-print-quote', label: 'Admin · Print quote request', description: 'Sent to the configured admin address for each "Get this box printed" request. Replies go to the visitor.', ...quote, sourcePath: 'src/server/email/templates.ts' },
    { id: 'admin-site-feedback', label: 'Admin · Site feedback', description: 'Sent to the configured admin address for feedback from the Studio and the dieline generator, when contact notifications are on. Replies go to the visitor when they gave an email.', ...feedback, sourcePath: 'src/server/email/templates.ts' },
    { id: 'welcome', label: 'Welcome', description: 'Sent once when an account is verified (email sign-up) or created with Google, while the welcomeEmails feature is on. Replies go to the admin address.', ...welcome, sourcePath: 'src/server/email/templates.ts' },
    { id: 'onboarding-follow-up', label: 'Welcome follow-up', description: 'Sent once, 3 days after the welcome, by the daily onboarding job. Suggests next steps by whether the person has saved a design (this preview: none yet).', ...followUp, sourcePath: 'src/server/email/templates.ts' },
    { id: 'verification', label: 'Email verification', description: 'Sent after email signup or a verification resend. One-use link expires in 24 hours.', ...verification, sourcePath: 'src/server/email/templates.ts' },
    { id: 'password-reset', label: 'Password reset', description: 'Sent for password recovery. One-use link expires in 1 hour.', ...reset, sourcePath: 'src/server/email/templates.ts' },
  ];
}
