import { site } from '@/lib/site';

export type EmailTemplatePreview = {
  id:string; label:string; description:string; subject:string; html:string; text:string; sourcePath:string;
};

function esc(value: unknown) {
  return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function shell(eyebrow:string,title:string,body:string) {
  const origin=site.url.toString().replace(/\/$/,'');
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#eef2f6;color:#101720;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="640" style="max-width:640px;width:100%"><tr><td style="padding:0 0 16px"><a href="${origin}" style="display:inline-block;text-decoration:none"><img src="${origin}/brand/logo-horizontal-light.svg" width="184" height="48" alt="3D Box Studio" style="display:block;width:184px;height:auto;border:0"></a></td></tr><tr><td style="background:#fff;border:1px solid #dce3eb;border-radius:16px;overflow:hidden"><div style="padding:24px 30px;background:#101720;color:#fff"><div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.75">${esc(eyebrow)}</div><div style="font-size:27px;font-weight:600;margin-top:7px">${esc(title)}</div></div><div style="padding:28px 30px;font-size:15px;line-height:1.65">${body}</div><div style="padding:0 30px 26px;color:#6b7280;font-size:12px;text-align:center"><hr style="border:0;border-top:1px solid #e5e7eb;margin:0 0 18px"><a href="${origin}" style="color:#0075c4">www.3dboxstudio.com</a></div></td></tr></table></td></tr></table></body></html>`;
}
function row(label:string,value:string){return `<tr><td style="padding:7px 12px 7px 0;color:#6b7280;vertical-align:top">${esc(label)}</td><td style="padding:7px 0">${value}</td></tr>`;}
function info(rows:string[]){return `<table style="border-collapse:collapse;width:100%;font-size:14px">${rows.join('')}</table>`;}
export function renderAdminContactTemplate(input:{id:string;name:string;email:string;topic:string;subject:string;message:string;submittedAt:string}) {
  const subject=`New contact message · ${input.subject || input.topic}`;
  const text=`New contact message\n\nName: ${input.name}\nEmail: ${input.email}\nTopic: ${input.topic}\nSubject: ${input.subject}\nSubmitted: ${input.submittedAt}\nID: ${input.id}\n\n${input.message}`;
  const html=shell('Admin notification','New contact message',
    `<p>A visitor sent a message through the 3D Box Studio contact form.</p>${info([
      row('Name',esc(input.name)), row('Email',`<a href="mailto:${esc(input.email)}" style="color:#0075c4">${esc(input.email)}</a>`),
      row('Topic',esc(input.topic)), row('Subject',esc(input.subject)), row('Submitted',esc(input.submittedAt)), row('ID',`<code>${esc(input.id)}</code>`)
    ])}<div style="margin-top:18px;padding:18px;border:1px solid #e5e7eb;border-radius:12px;background:#f8fafc;white-space:pre-wrap">${esc(input.message)}</div>`);
  return {subject,html,text};
}
export function getEmailTemplatePreviews(): EmailTemplatePreview[] {
  const contact=renderAdminContactTemplate({id:'sample123',name:'Alex Morgan',email:'alex@example.com',topic:'Feature request',subject:'Custom dieline support',message:'Hi, I would like to know whether custom dieline import is planned for V2.',submittedAt:new Date('2026-09-29T18:30:00Z').toISOString()});
  const welcome={subject:'Welcome to 3D Box Studio',text:'Welcome to 3D Box Studio.',html:shell('3D Box Studio','Welcome to 3D Box Studio','<p>Your workspace is ready. Start a packaging concept in the Studio.</p>')};
  const reset={subject:'Reset your password · 3D Box Studio',text:'Reset your 3D Box Studio password.',html:shell('Account security','Reset your password','<p>Use the secure reset link to choose a new password. This is a library preview for the future account flow.</p>')};
  const verification={subject:'Verify your email · 3D Box Studio',text:'Verify your 3D Box Studio email.',html:shell('Account security','Verify your email','<p>Confirm your email address to finish setting up your account. This is a library preview for the future account flow.</p>')};
  return [
    {id:'admin-contact-submission',label:'Admin · Contact submission',description:'Sent to the configured admin email when a visitor submits the contact form.',...contact,sourcePath:'src/server/email/templates.ts'},
    {id:'welcome',label:'Welcome',description:'Future account welcome email.',...welcome,sourcePath:'src/server/email/templates.ts'},
    {id:'verification',label:'Email verification',description:'Future account verification email.',...verification,sourcePath:'src/server/email/templates.ts'},
    {id:'password-reset',label:'Password reset',description:'Future password reset email.',...reset,sourcePath:'src/server/email/templates.ts'},
  ];
}
