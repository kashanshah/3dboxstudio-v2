/* eslint-disable @typescript-eslint/no-require-imports */
// The dieline generator's search pages: titles and descriptions within
// search limits, every page a real route, drafts out of production, and the
// box size calculator's arithmetic.
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const test=require('node:test');
const assert=require('node:assert/strict');

const resolve=Module._resolveFilename;
Module._resolveFilename=function(request,...args){
  return resolve.call(this,request.startsWith('@/')?path.resolve(__dirname,'../src',request.slice(2)):request,...args);
};
require.extensions['.ts']=require.extensions['.tsx']=(module,file)=>{
  module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
};
const fresh=(file,env)=>{
  const saved={...process.env};
  Object.assign(process.env,env);
  for(const key of Object.keys(env)) if(env[key]===undefined) delete process.env[key];
  for(const id of Object.keys(require.cache)) if(id.includes(`${path.sep}src${path.sep}`)) delete require.cache[id];
  try{return require(file);}finally{process.env=saved;}
};

test('each search page has a short title, a description within limits and its own route',()=>{
  const {SEO_PAGES,seoPageMetadata}=require('../src/content/seo-pages.ts');
  const pages=Object.values(SEO_PAGES);
  assert.equal(new Set(pages.map(page=>page.path)).size,pages.length);
  for(const page of pages){
    assert.ok(page.title.length<=60,`${page.path} title is ${page.title.length} characters`);
    assert.ok(page.description.length<=155,`${page.path} description is ${page.description.length} characters`);
    assert.ok(fs.existsSync(path.join(__dirname,'../src/app',page.path,'page.tsx')),`${page.path} has no page`);
    const metadata=seoPageMetadata(page);
    assert.equal(metadata.alternates.canonical,page.path);
    assert.equal(Boolean(metadata.robots),page.status==='draft',`${page.path} robots`);
  }
});

test('drafts are served on previews and in development, not in production unless asked',()=>{
  const seo=file=>fresh('../src/lib/seo.ts',file);
  assert.equal(seo({VERCEL_ENV:'production',SHOW_DRAFTS:undefined}).isServed('draft'),false);
  assert.equal(seo({VERCEL_ENV:'production',SHOW_DRAFTS:undefined}).isServed('published'),true);
  assert.equal(seo({VERCEL_ENV:'preview',SHOW_DRAFTS:undefined}).isServed('draft'),true);
  assert.equal(seo({VERCEL_ENV:'production',SHOW_DRAFTS:'true'}).isServed('draft'),true);
  // A draft guide drops out of the guides a production build serves.
  const blog=fresh('../src/content/blogPosts.ts',{VERCEL_ENV:'production',SHOW_DRAFTS:undefined});
  assert.ok(blog.BLOG_POSTS.every(post=>!post.draft));
});

test('the sitemap lists only approved search pages',()=>{
  const {SEO_PAGES,publishedSeoPages}=require('../src/content/seo-pages.ts');
  const published=publishedSeoPages().map(page=>page.path);
  for(const page of Object.values(SEO_PAGES)) assert.equal(published.includes(page.path),page.status==='published');
});

test('the box size calculator adds the padding inside and the board outside',()=>{
  const {boxSize,orient,suggestStyles,suggestBoard,FIT_PADDING}=require('../src/lib/box-size.ts');
  assert.deepEqual(boxSize({length:180,width:120,depth:60},'mm','standard',0.5),{inner:{length:190,width:130,depth:70},outer:{length:191,width:131,depth:71}});
  const inches=boxSize({length:4,width:3,depth:2},'in','cushioned',1.5);
  assert.equal(inches.inner.length,Math.round((4+2*20/25.4)*100)/100);
  assert.deepEqual(orient({length:60,width:180,depth:20}),{length:180,width:60,depth:20});
  assert.equal(FIT_PADDING.snug.mm,2);
  assert.equal(suggestBoard('heavy','shipping').id,'bflute');
  assert.equal(suggestBoard('light','retail').id,'sbs18');
  // Every suggestion is a real template page.
  const {getBoxTemplatePage}=require('../src/content/box-template-pages.ts');
  for(const use of ['retail','shipping','gift','food']) for(const weight of ['light','medium','heavy']) {
    const styles=suggestStyles(weight,use);
    assert.ok(styles.length>=2,`${use} ${weight}`);
    for(const style of styles) assert.ok(getBoxTemplatePage(style.slug),`${style.slug} has no page`);
  }
});

test('glossary terms are alphabetical with unique anchors and working links',()=>{
  const {GLOSSARY}=require('../src/content/packaging-glossary.ts');
  const {getBoxTemplatePage}=require('../src/content/box-template-pages.ts');
  assert.ok(GLOSSARY.length>=25);
  assert.equal(new Set(GLOSSARY.map(item=>item.id)).size,GLOSSARY.length);
  const terms=GLOSSARY.map(item=>item.term.toLowerCase());
  assert.deepEqual(terms,[...terms].sort((a,b)=>a.localeCompare(b)));
  for(const item of GLOSSARY) for(const [,href] of item.definition.matchAll(/\]\((\/[^)]+)\)/g)) {
    if(href.startsWith('/box-templates/')) assert.ok(getBoxTemplatePage(href.split('/')[2]),`${item.id} links to ${href}`);
    else assert.ok(['/box-dieline-generator','/blog/how-to-measure-a-box-inside-vs-outside-dimensions'].includes(href),`${item.id} links to ${href}`);
  }
});

test('every box template page keeps its title and description within search limits',()=>{
  const {BOX_TEMPLATE_PAGES}=require('../src/content/box-template-pages.ts');
  for(const page of BOX_TEMPLATE_PAGES){
    assert.ok(page.title.length<=60,`${page.slug} title is ${page.title.length} characters`);
    assert.ok(page.description.length<=155,`${page.slug} description is ${page.description.length} characters`);
  }
  assert.equal(new Set(BOX_TEMPLATE_PAGES.map(page=>page.title)).size,BOX_TEMPLATE_PAGES.length);
});

test('the standard box sizes chart shows both units and finds the closest box a product fits',()=>{
  const {BOX_SIZE_GROUPS,bothUnits,boxesThatFit,insideMm,chartBoxHref}=require('../src/lib/standard-box-sizes.ts');
  const {getBoxTemplatePage}=require('../src/content/box-template-pages.ts');
  const {styleForTemplate}=require('../src/lib/dieline/styles.ts');
  const boxes=BOX_SIZE_GROUPS.flatMap(group=>group.boxes);
  // Every box opens a real template page in a style that page draws.
  for(const box of boxes) assert.equal(styleForTemplate(getBoxTemplatePage(box.template.slug).templateId).id,box.template.styleId,box.name);
  const medium=boxes.find(box=>box.name==='Medium box');
  assert.deepEqual(bothUnits(medium),{in:'18 × 18 × 16',cm:'45.7 × 45.7 × 40.6'});
  assert.deepEqual(bothUnits(boxes.find(box=>box.name==='400 × 300 × 300 mm')),{in:'15.7 × 11.8 × 11.8',cm:'40 × 30 × 30'});
  // Outside sizes lose a wall of board on each side.
  assert.deepEqual(insideMm(boxes.find(box=>box.name==='400 × 300 × 200 mm')),{length:392,width:292,depth:192});
  // 7 × 5 × 3 in with 20 mm round it, turned any way: the 10 × 8 × 6 in carton first, nothing too small.
  const fits=boxesThatFit({length:3*25.4,width:7*25.4,depth:5*25.4},20);
  assert.equal(fits[0].box.name,'10 × 8 × 6 in');
  assert.ok(fits.every((fit,index)=>fit.emptyShare>0&&(index===0||fit.emptyShare>=fits[index-1].emptyShare)));
  assert.ok(!fits.some(fit=>fit.box.name.includes('mailer')));
  assert.equal(boxesThatFit({length:2000,width:10,depth:10},0).length,0);
  assert.equal(chartBoxHref(medium),'/box-templates/split-top-box?style=shipping-box-rsc&l=18&w=18&d=16&u=in&mode=inner');
});
