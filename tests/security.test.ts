import { describe, expect, it } from 'vitest';
import { isEditorSender, isEditorUrl, isWorkerMessage } from '../src/shared/messages';
import { readFileSync } from 'node:fs';
import { readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const editorUrl='chrome-extension://abcdefghijklmnop/editor.html';
const tile={type:'TILE',id:'capture-123',sequence:0,total:1,x:0,y:0,metrics:{width:900,height:700,viewportWidth:900,viewportHeight:700,contentWidth:900,contentHeight:700}};
describe('extension trust boundaries',()=>{
  it('accepts valid capture commands and bounded fractional scroll coordinates',()=>{
    expect(isWorkerMessage(tile)).toBe(true);expect(isWorkerMessage({...tile,x:.25})).toBe(true);
    for(const type of ['OWN','CANCEL','DONE','HEARTBEAT'])expect(isWorkerMessage({type,id:'capture-123'})).toBe(true);
    expect(isWorkerMessage({type:'FAILED',id:'capture-123',reason:'Capture interrupted.'})).toBe(true);
  });
  it('rejects missing, nonfinite, negative, and inconsistent tile fields',()=>{
    for(const value of [null,{},[],{...tile,id:{}},{...tile,metrics:null},{...tile,sequence:-1},{...tile,total:0},{...tile,x:NaN},{...tile,y:Infinity},{...tile,x:-1},{...tile,x:900},{...tile,metrics:{...tile.metrics,width:Infinity}},{...tile,metrics:{...tile.metrics,contentWidth:901}}])expect(isWorkerMessage(value)).toBe(false);
    for(const pixelRatio of [0,-1,Infinity,NaN,'1.25'])expect(isWorkerMessage({...tile,metrics:{...tile.metrics,pixelRatio}})).toBe(false);
  });
  it('rejects object error messages, oversized IDs, and prototype-like keys',()=>{
    for(const value of [{type:'FAILED',id:'capture-123',reason:{}},{type:'OWN',id:'x'.repeat(129)},{type:'OWN',id:'../capture'},{type:'OWN',id:''},...['__proto__','constructor','prototype'].map(id=>({type:'OWN',id}))])expect(isWorkerMessage(value)).toBe(false);
  });
  it('accepts bounded panel regions and rejects offscreen or oversized fragments',()=>{
    const region={source:{x:50,y:70,width:500,height:400},destination:{x:50,y:170,width:500,height:400}};
    expect(isWorkerMessage({...tile,regions:[region]})).toBe(true);
    for(const regions of [[],[null],[{...region,source:{...region.source,x:-1}}],[{...region,source:{...region.source,x:850}}],[{...region,destination:{...region.destination,y:650}}],[{...region,destination:{...region.destination,width:501}}],Array(4).fill(region)])expect(isWorkerMessage({...tile,regions})).toBe(false);
  });
  it('requires the exact editor origin, path, capture ID, and top frame',()=>{
    expect(isEditorUrl(`${editorUrl}?capture=capture-123`,'capture-123',editorUrl)).toBe(true);
    for(const url of [`${editorUrl}?capture=other`,`${editorUrl}.html?capture=capture-123`,'https://example.com/editor.html?capture=capture-123','chrome-extension://other/editor.html?capture=capture-123','not a URL',undefined])expect(isEditorUrl(url,'capture-123',editorUrl)).toBe(false);
    const sender={id:'abcdefghijklmnop',frameId:0,tab:{id:1},url:`${editorUrl}?capture=capture-123`} as chrome.runtime.MessageSender;
    expect(isEditorSender(sender,'capture-123',editorUrl,'abcdefghijklmnop')).toBe(true);
    for(const patch of [{frameId:1},{id:'other'},{tab:undefined},{url:`${editorUrl}?capture=other`}])expect(isEditorSender({...sender,...patch},'capture-123',editorUrl,'abcdefghijklmnop')).toBe(false);
  });
  it('keeps the distributed permissions and remote-resource policy restricted',()=>{
    const manifest=JSON.parse(readFileSync('public/manifest.json','utf8'));
    expect(manifest.permissions).toEqual(['activeTab','scripting','storage','clipboardWrite']);expect(manifest.host_permissions).toBeUndefined();expect(manifest.web_accessible_resources).toBeUndefined();expect(manifest.externally_connectable).toBeUndefined();
    const csp=manifest.content_security_policy.extension_pages;for(const directive of ["default-src 'self'","script-src 'self'","connect-src 'self'","object-src 'none'","frame-src 'none'","base-uri 'none'","form-action 'none'"])expect(csp).toContain(directive);
    expect(csp).not.toContain('unsafe-eval');
    expect(csp.match(/connect-src[^;]+/)?.[0]).toBe("connect-src 'self' https://scrollout.farflash.com/releases.json");
  });
});

describe('public website trust boundaries',()=>{
  it('keeps scripts local and allows only hashed structured data inline',()=>{
    const config=JSON.parse(readFileSync('website/vercel.json','utf8'));
    const csp=config.headers.find((rule:{source:string})=>rule.source==='/(.*)').headers.find((h:{key:string})=>h.key==='Content-Security-Policy').value as string;
    for(const directive of ["default-src 'self'","connect-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'","frame-ancestors 'none'"])expect(csp).toContain(directive);
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
    function pages(dir:string):string[]{return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?pages(path.join(dir,entry.name)):entry.name.endsWith('.html')?[path.join(dir,entry.name)]:[])}
    const htmlFiles=pages('website');expect(htmlFiles.length).toBeGreaterThanOrEqual(13);
    for(const file of htmlFiles){
      const html=readFileSync(file,'utf8');
      expect(html,`${file}: inline event handler`).not.toMatch(/\son\w+\s*=/i);
      expect(html,`${file}: active embedded content`).not.toMatch(/<(?:iframe|object|embed|form)\b/i);
      for(const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
        const src=script[1].match(/\bsrc=["']([^"']+)["']/i)?.[1];
        if(src){expect(src,`${file}: script origin`).toMatch(/^\/(?!\/)/);expect(existsSync(path.join('website',src))).toBe(true)}
        else{
          expect(script[1],`${file}: executable inline script`).toMatch(/type=["']application\/ld\+json["']/i);
          expect(()=>JSON.parse(script[2])).not.toThrow();
          expect(csp,`${file}: missing script hash`).toContain(`'sha256-${createHash('sha256').update(script[2]).digest('base64')}'`);
        }
      }
    }
  });
  it('keeps private submission helpers off the site and preserves custom-domain redirects',()=>{
    for(const file of ['store/START-HERE.html','site-config.json','privacy/content.json','.git/config'])expect(existsSync(path.join('website',file)),file).toBe(false);
    const {redirects}=JSON.parse(readFileSync('website/vercel.json','utf8'));
    expect(redirects).toEqual(expect.arrayContaining([
      expect.objectContaining({source:'/',destination:'https://scrollout.farflash.com/',permanent:true}),
      expect.objectContaining({source:'/:path(.*)',destination:'https://scrollout.farflash.com/:path',permanent:true}),
    ]));
    for(const redirect of redirects)expect(redirect.has).toContainEqual({type:'host',value:'.*\\.vercel\\.app'});
  });
});
