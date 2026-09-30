/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);};
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,file);
const {getEmailTemplatePreviews,renderVerificationTemplate,renderPasswordResetTemplate,renderAdminContactTemplate}=require('../src/server/email/templates.ts');
test('all email previews include readable HTML and plain text; active previews use production renderers',()=>{
 const previews=getEmailTemplatePreviews();assert.equal(previews.length,4);
 for(const item of previews){assert.match(item.html,/<html lang="en">/);assert.match(item.html,/role="presentation"/);assert.match(item.html,/mso-padding-alt/);assert.doesNotMatch(item.html,/<img|<script|\.svg|future account flow/);assert.ok(item.text.length>100);}
 for(const [id,render,prop,pathname] of [['verification',renderVerificationTemplate,'verifyUrl','/verify-email'],['password-reset',renderPasswordResetTemplate,'resetUrl','/reset-password']]){
  const preview=previews.find(x=>x.id===id),url=preview.text.match(/https?:\/\/[^\s]+/)[0];assert.equal(new URL(url).pathname,pathname);
  assert.deepEqual({subject:preview.subject,html:preview.html,text:preview.text},render({name:'Alex',[prop]:url}));
 }
 assert.match(previews.find(x=>x.id==='welcome').description,/not automatically sent/);
});
test('account templates escape names/URLs, disclose correct expiry, and reject unsafe links',()=>{
 const url='https://studio.example/reset-password?token=abc&next=%22test%22';
 const reset=renderPasswordResetTemplate({name:'<script>"&',resetUrl:url});
 assert.doesNotMatch(reset.html,/<script>/);assert.match(reset.html,/&lt;script&gt;&quot;&amp;/);assert.match(reset.html,/token=abc&amp;next/);
 assert.match(reset.text,/1 hour/);assert.match(reset.text,/password will stay the same/);assert.match(reset.text,/only be used once/);assert.ok(reset.text.includes(url));
 assert.match(renderVerificationTemplate({verifyUrl:'https://studio.example/verify-email?token=a'}).text,/24 hours/);
 for(const unsafe of ['javascript:alert(1)','data:text/html,hello','https://user:pass@example.com'])assert.throws(()=>renderVerificationTemplate({verifyUrl:unsafe}));
});
test('admin contact content stays inert and multiline messages survive; reply URL is encoded',()=>{
 const contact=renderAdminContactTemplate({id:'abc',name:'<img onerror="alert(1)">',email:'alex+test@example.com',topic:'Question',subject:'Hello\r\nBcc: bad',message:'First line\n<script>bad</script>\nLast line',submittedAt:'2026-09-29T18:30:00Z'});
 assert.doesNotMatch(contact.html,/<img|<script>/);assert.match(contact.html,/First line<br>&lt;script&gt;bad&lt;\/script&gt;<br>Last line/);
 assert.ok(contact.html.includes('mailto:alex%2Btest%40example.com?subject=Re%3A%20Hello%0D%0ABcc%3A%20bad'));
 assert.doesNotMatch(contact.subject,/[\r\n]/);assert.match(contact.text,/Submitted \(UTC\)/);assert.match(contact.text,/Reply to: alex\+test@example.com/);
});
