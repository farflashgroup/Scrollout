import { describe, expect, it } from 'vitest';
import { isEditorSender, isEditorUrl, isWorkerMessage } from '../src/shared/messages';
import { readFileSync } from 'node:fs';

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
