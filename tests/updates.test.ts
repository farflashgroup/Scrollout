import { afterEach, describe, expect, it, vi } from 'vitest';
import { CHECK_INTERVAL, downloadUrl, fetchRelease, installKind, newerVersion, parseRelease, PENDING_UPDATE, RELEASE_URL, STORE_URL, validVersion } from '../src/shared/updates';
import { registerBrowserUpdates } from '../src/extension/updates';

const release={schemaVersion:1,version:'1.0.4',sha256:'a'.repeat(64),storeVersion:null,storeUrl:null};
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers()});
describe('release metadata boundary',()=>{
  it('compares numeric Chrome versions, including missing and fourth components',()=>{
    expect(newerVersion('1.10','1.9')).toBe(true);expect(newerVersion('1.0.3.1','1.0.3')).toBe(true);
    expect(newerVersion('1','1.0.0.0')).toBe(false);expect(newerVersion('1.0.2','1.0.3')).toBe(false);
    for(const value of ['0','1.0.03','1.2.3.4.5','1.0.3-beta','65536','../evil','1.0.4?x=1'])expect(validVersion(value)).toBe(false);
    expect(CHECK_INTERVAL).toBe(43200000);
  });
  it('rejects bad hashes, schemas, versions and untrusted store URLs',()=>{
    expect(parseRelease(release).version).toBe('1.0.4');
    expect(parseRelease({...release,storeVersion:'1.0.3',storeUrl:STORE_URL}).storeUrl).toBe(STORE_URL);
    for(const patch of [{schemaVersion:2},{version:'<script>'},{sha256:'a'.repeat(65)},{sha256:'xyz'},{storeVersion:'1.0.4',storeUrl:'javascript:alert(1)'},{storeVersion:'1.0.4',storeUrl:'https://evil.example/'},{storeUrl:STORE_URL}])expect(()=>parseRelease({...release,...patch})).toThrow();
    expect(downloadUrl('1.0.4')).toBe('https://scrollout.farflash.com/downloads/Scrollout-1.0.4.zip');expect(()=>downloadUrl('../evil')).toThrow();
  });
  it('identifies unpacked and managed installs without treating update_url as proof of a store install',()=>{
    expect(installKind('development','https://clients2.google.com/service/update2/crx')).toBe('unpacked');
    expect(installKind('admin',undefined)).toBe('managed');expect(installKind('normal','https://example.com/updates.xml')).toBe('browser');expect(installKind(undefined,undefined)).toBe('unknown');
  });
  it('uses a fixed credential-free request and never accepts executable release URLs',async()=>{
    const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({...release,downloadUrl:'https://evil.example/payload.js'}),{headers:{'content-type':'application/json'}}));vi.stubGlobal('fetch',mock);
    const result=await fetchRelease();expect(result).not.toHaveProperty('downloadUrl');
    expect(mock).toHaveBeenCalledWith(RELEASE_URL,expect.objectContaining({method:'GET',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error'}));
    expect(mock.mock.calls[0][1]).not.toHaveProperty('body');
  });
  it('rejects HTTP errors, HTML, oversized and malformed responses',async()=>{
    for(const response of [new Response('{}',{status:503}),new Response('<html>',{headers:{'content-type':'text/html'}}),new Response('x'.repeat(8193),{headers:{'content-type':'application/json'}}),new Response('{broken',{headers:{'content-type':'application/json'}})]){
      vi.stubGlobal('fetch',vi.fn().mockResolvedValue(response));await expect(fetchRelease()).rejects.toThrow();
    }
  });
  it('bounds offline checks with a timeout',async()=>{
    vi.useFakeTimers();vi.stubGlobal('fetch',vi.fn((_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))))));
    const result=fetchRelease().catch(error=>error.message);await vi.advanceTimersByTimeAsync(10000);expect(await result).toBe('aborted');
  });
});
describe('safe Chrome update installation',()=>{
  function setup(){
    const values:Record<string,unknown>={},events:Record<string,Function[]>={};let contexts:unknown[]=[];let capturing=false;
    const event=(name:string)=>({addListener:(callback:Function)=>(events[name]??=[]).push(callback)});
    const reload=vi.fn();const local={get:async()=>values,set:async(patch:object)=>{Object.assign(values,patch)},remove:async(key:string)=>{delete values[key]}};
    vi.stubGlobal('chrome',{runtime:{getManifest:()=>({version:'1.0.3'}),getContexts:async()=>contexts,reload,onUpdateAvailable:event('update'),onInstalled:event('installed')},storage:{local,session:{get:async()=>({activeCapture:capturing?{}:undefined})}},tabs:{onRemoved:event('removed'),onUpdated:event('tabUpdated')}});
    registerBrowserUpdates();
    const fire=async(name:string,...args:unknown[])=>{events[name].forEach(cb=>cb(...args));await new Promise(r=>setTimeout(r,0))};
    return {values,reload,fire,setContexts:(value:unknown[])=>{contexts=value},capture:(value:boolean)=>{capturing=value}};
  }
  it('defers while any editor is open and applies after the last page closes',async()=>{
    const state=setup();state.setContexts([{contextType:'TAB'},{contextType:'TAB'}]);await state.fire('update',{version:'1.0.4'});
    expect(state.values[PENDING_UPDATE]).toBe('1.0.4');expect(state.reload).not.toHaveBeenCalled();
    state.setContexts([{contextType:'TAB'}]);await state.fire('removed');expect(state.reload).not.toHaveBeenCalled();
    state.setContexts([]);await state.fire('removed');expect(state.reload).toHaveBeenCalledOnce();
  });
  it('defers during capture even when there are no editor contexts',async()=>{
    const state=setup();state.capture(true);await state.fire('update',{version:'1.0.4'});expect(state.reload).not.toHaveBeenCalled();
    state.capture(false);await state.fire('removed');expect(state.reload).toHaveBeenCalledOnce();
  });
  it('ignores stale versions and clears an applied update',async()=>{
    const state=setup();await state.fire('update',{version:'1.0.2'});expect(state.reload).not.toHaveBeenCalled();
    state.values[PENDING_UPDATE]='1.0.3';await state.fire('installed');expect(state.values[PENDING_UPDATE]).toBeUndefined();
  });
  it('retains a pending update through a reload that did not replace files',async()=>{
    const state=setup();state.values[PENDING_UPDATE]='1.0.4';await state.fire('installed');expect(state.values[PENDING_UPDATE]).toBe('1.0.4');
  });
  it('does not force a reload if the browser cannot verify its open contexts',async()=>{
    const state=setup();chrome.runtime.getContexts=async()=>{throw Error('context read failed')};
    await state.fire('update',{version:'1.0.4'});expect(state.reload).not.toHaveBeenCalled();expect(state.values[PENDING_UPDATE]).toBe('1.0.4');
  });
});
