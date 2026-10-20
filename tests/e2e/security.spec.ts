import { test, expect, chromium, type BrowserContext, type Worker, type Page } from '@playwright/test';
import { browserOptions, captureArgs } from './browser';
import { randomUUID } from 'node:crypto';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { unzlibSync } from 'fflate';
import http from 'node:http';
import sharp from 'sharp';
import type { Socket } from 'node:net';

test('fractional redactions cover every touched output pixel at native and PDF scales',async({page})=>{
  const bundle=await build({entryPoints:['src/editor/renderer.ts'],bundle:true,format:'iife',globalName:'ScrolloutRenderer',write:false});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const results=await page.evaluate(()=>[1,.4,2].map(scale=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=400;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#FF0000';ctx.fillRect(0,0,400,400);ctx.scale(scale,scale);
    (window as any).ScrolloutRenderer.drawAnnotation(ctx,{id:'private',kind:'redact',x:100.25,y:100.25,width:40.5,height:40.5,color:'#ffffff',opacity:.1,strokeWidth:1,fontSize:32});
    const edge=Math.floor(100.25*scale),last=Math.ceil(140.75*scale)-1;
    return {scale,first:[...ctx.getImageData(edge,edge,1,1).data],last:[...ctx.getImageData(last,last,1,1).data]};
  }));
  for(const result of results){expect(result.first,`first edge at ${result.scale}x`).toEqual([0,0,0,255]);expect(result.last,`last edge at ${result.scale}x`).toEqual([0,0,0,255])}
});

async function verifyRedactedExports(page:Page){
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  async function seed(color:string){
    await page.evaluate(async(secretColor)=>{
      const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=300;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,2400,300);ctx.fillStyle=secretColor;ctx.fillRect(100,100,41,41);
      const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!))),open=indexedDB.open('scrollout-temporary',1);const db=await new Promise<IDBDatabase>(resolve=>{open.onsuccess=()=>resolve(open.result)}),tx=db.transaction(['sessions','tiles'],'readwrite');
      tx.objectStore('sessions').put({id:'redaction-security',status:'ready',progress:100,sourceTabId:0,sourceWindowId:0,sourceTitle:'Security test',sourceHost:'example.com',createdAt:1,editorTabIds:[],document:{width:2400,height:300,crop:{x:0,y:0,width:2400,height:300},annotations:[{id:'private',kind:'redact',x:100.25,y:100.25,width:40.5,height:40.5,color:'#ffffff',opacity:.1,strokeWidth:1,fontSize:32}],filename:'Security test',sourceHost:'example.com',createdAt:1}});
      tx.objectStore('tiles').put({id:'redaction-tile',captureId:'redaction-security',sequence:0,x:0,y:0,width:2400,height:300,sourceX:0,sourceY:0,sourceWidth:2400,sourceHeight:300,blob});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve()});db.close();
    },color);
    await page.reload();await expect(page.getByTestId('editor-canvas')).toBeVisible();
  }
  async function exports(){
    const outputs:Record<string,Uint8Array>={};
    for(const [format,label] of [['png','PNG image'],['jpeg','JPEG image'],['pdf','PDF document']]){
      await expect(page.getByRole('button',{name:'Export',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Export',exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('menuitem',{name:label}).click();const bytes=await fs.readFile((await (await wait).path())!);
      if(format==='pdf'){
        const pdf=await PDFDocument.load(bytes);expect(pdf.getPageCount()).toBe(1);
        const images=pdf.context.enumerateIndirectObjects().map(([,object])=>object).filter((object):object is PDFRawStream=>object instanceof PDFRawStream&&object.dict.get(PDFName.of('Subtype'))===PDFName.of('Image')&&object.dict.get(PDFName.of('ColorSpace'))===PDFName.of('DeviceRGB'));
        expect(images).toHaveLength(1);outputs.pdf=unzlibSync(images[0].contents);
      }else outputs[format]=bytes;
    }
    await expect(page.getByRole('button',{name:'Copy image',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Copy image',exact:true}).click();await expect(page.getByText('Image copied to your clipboard.')).toBeVisible();
    outputs.clipboard=new Uint8Array(await page.evaluate(async()=>Array.from(new Uint8Array(await (await (await navigator.clipboard.read())[0].getType('image/png')).arrayBuffer()))));
    return outputs;
  }
  await seed('#FF0000');const red=await exports();await seed('#0000FF');const blue=await exports();
  for(const format of ['png','jpeg','pdf','clipboard'])expect(Buffer.from(red[format]).equals(Buffer.from(blue[format])),`${format} must not depend on the covered secret`).toBe(true);
}
test('PNG, JPEG, PDF, and clipboard contain no pixels from underneath a fractional redaction',async({page})=>{
  await page.goto('/editor.html?capture=redaction-security');await verifyRedactedExports(page);
});

test('source masking protects resampled tile boundaries and fractional crops without changing originals',async({page})=>{
  const bundle=await build({entryPoints:['src/editor/renderer.ts'],bundle:true,format:'iife',globalName:'ScrolloutRenderer',write:false});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  const results=await page.evaluate(async()=>{
    const {TileCache,renderRegion}=(window as any).ScrolloutRenderer;
    const mask={id:'private',kind:'redact',x:60.25,y:40.25,width:40.5,height:40.5,color:'#fff',opacity:.1,strokeWidth:1,fontSize:32};
    async function images(color:string){
      const tiles=[];
      for(const x of [0,80]){
        const canvas=document.createElement('canvas');canvas.width=86;canvas.height=138;const ctx=canvas.getContext('2d')!;
        ctx.fillStyle='#fff';ctx.fillRect(0,0,86,138);ctx.fillStyle=color;ctx.fillRect(3+60-x,5+40,41,41);
        const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!)));
        tiles.push({id:`${color}:${x}`,captureId:'mask-test',sequence:x/80,x,y:0,width:80,height:128,sourceX:3,sourceY:5,sourceWidth:80,sourceHeight:128,blob});
      }
      return tiles;
    }
    const red=await images('#f00'),blue=await images('#00f'),cache=new TileCache(),results=[];
    async function render(tiles:typeof red,region:{x:number;y:number;width:number;height:number},scale:number,annotations=[mask]){
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(region.width*scale);canvas.height=Math.ceil(region.height*scale);const ctx=canvas.getContext('2d')!;
      await renderRegion(ctx,region,tiles,annotations,cache,scale);return ctx.getImageData(0,0,canvas.width,canvas.height).data;
    }
    try{
      for(const region of [{x:0,y:0,width:160,height:128},{x:59.75,y:39.75,width:61.5,height:61.5}])for(const scale of [.04,.4,1190.56/2400,1,2]){
        const a=await render(red,region,scale),b=await render(blue,region,scale);
        results.push({scale,crop:region.x!==0,identical:a.every((value,index)=>value===b[index])});
      }
      const original=await render(red,{x:0,y:0,width:160,height:128},1,[]);
      return {cases:results,originalPixel:[...original.slice((60*160+80)*4,(60*160+80)*4+4)]};
    }finally{cache.clear()}
  });
  for(const result of results.cases)expect(result.identical,`source pixels at ${result.scale}x, cropped=${result.crop}`).toBe(true);
  expect(results.originalPixel).toEqual([255,0,0,255]);
});

test.describe('production extension security and temporary ownership',()=>{
  let context:BrowserContext,worker:Worker,profile:string,id:string,legacyActions:boolean;
  test.beforeEach(async()=>{
    profile=await fs.mkdtemp(path.join(os.tmpdir(),'scrollout-security-'));
    const native=!!process.env.SCROLLOUT_QA_ACTION_FILE;
    if(native)test.setTimeout(180000);
    context=await chromium.launchPersistentContext(profile,{...browserOptions,headless:!native,viewport:null,ignoreDefaultArgs:['--disable-extensions'],args:[...captureArgs().filter(arg=>!native||arg!=='--headless=new'),'--enable-unsafe-extension-debugging',`--load-extension=${path.resolve('dist')}`]});
    const cdp=await context.browser()!.newBrowserCDPSession();legacyActions=false;
    try{({id}=await cdp.send('Extensions.loadUnpacked',{path:path.resolve('dist')}))}
    catch(error){if(!/wasn't found|not found|Unknown method/.test(String(error)))throw error;legacyActions=true}
    worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
    id=new URL(worker.url()).host;
    await expect.poll(()=>worker.evaluate(async()=>!!(await chrome.storage.session.get('browserSessionToken')).browserSessionToken)).toBe(true);
    if(legacyActions&&native){
      // Configure Chrome's existing action shortcut in this throwaway profile.
      // The production manifest, scripts, and permissions remain unmodified.
      const settings=await context.newPage();await settings.goto('chrome://extensions/shortcuts');
      await settings.evaluate(extensionId=>(chrome as any).developerPrivate.updateExtensionCommand({extensionId,commandName:'_execute_action',keybinding:'Ctrl+Shift+Y'}),id);await settings.close();
    }
  });
  test.afterEach(async()=>{await context?.close();if(profile)await fs.rm(profile,{recursive:true,force:true})});
  async function triggerAction(source:Page){
    if(!legacyActions){
      const cdp=await context.browser()!.newBrowserCDPSession(),{targetInfos}=await cdp.send('Target.getTargets',{filter:[{type:'tab'}]});
      await cdp.send('Extensions.triggerAction',{id,targetId:targetInfos.find(t=>t.url===source.url())!.targetId});return;
    }
    const file=process.env.SCROLLOUT_QA_ACTION_FILE;
    if(!file)throw new Error('This Chrome version requires native toolbar verification. Set SCROLLOUT_QA_ACTION_FILE for the native input bridge.');
    const requestId=randomUUID(),title=`Scrollout native QA ${requestId}`;
    await source.evaluate(value=>{document.title=value},title);await source.bringToFront();
    await fs.writeFile(file,JSON.stringify({requestId,title,key:'Control_L+Shift_L+y',version:context.browser()!.version(),done:false}));
    await expect.poll(async()=>{try{const response=JSON.parse(await fs.readFile(file,'utf8'));return response.requestId===requestId&&response.done===true}catch{return false}},{timeout:90000,message:'Waiting for a native extension action in the isolated Chrome window'}).toBe(true);
    await fs.unlink(file);
  }
  async function seededEditor(){
    const page=await context.newPage();await page.goto(`chrome-extension://${id}/editor.html?capture=ownership-security`);
    await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=12;const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!)));
      const open=indexedDB.open('scrollout-temporary',1),db=await new Promise<IDBDatabase>(resolve=>{open.onsuccess=()=>resolve(open.result)}),tx=db.transaction(['sessions','tiles'],'readwrite');
      tx.objectStore('sessions').put({id:'ownership-security',status:'ready',progress:100,sourceTabId:0,sourceWindowId:0,sourceTitle:'Temporary',sourceHost:'example.com',createdAt:1,editorTabIds:[],document:{width:12,height:12,crop:{x:0,y:0,width:12,height:12},annotations:[],filename:'Temporary',sourceHost:'example.com',createdAt:1}});
      tx.objectStore('tiles').put({id:'ownership-tile',captureId:'ownership-security',sequence:0,x:0,y:0,width:12,height:12,sourceX:0,sourceY:0,sourceWidth:12,sourceHeight:12,blob});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve()});db.close();
    });
    await page.reload();await expect(page.getByTestId('editor-canvas')).toBeVisible();return page;
  }
  test('leaving the last editor deletes its session and image tiles',async()=>{
    for(const destination of ['about:blank',`chrome-extension://${id}/editor.html?capture=another-capture`]){
    const page=await seededEditor();await page.goto(destination);
    await expect.poll(()=>worker.evaluate(async()=>{
      const open=indexedDB.open('scrollout-temporary',1),db=await new Promise<IDBDatabase>(resolve=>{open.onsuccess=()=>resolve(open.result)});
      const count=(name:string)=>new Promise<number>(resolve=>{const request=db.transaction(name).objectStore(name).count();request.onsuccess=()=>resolve(request.result)});
      const result={sessions:await count('sessions'),tiles:await count('tiles')};db.close();return result;
    })).toEqual({sessions:0,tiles:0});
    expect(await worker.evaluate(async()=>!!(await chrome.storage.session.get('editorOwners')).editorOwners?.['ownership-security'])).toBe(false);
    }
  });
  test('an editor cannot claim a different capture or send malformed worker commands',async()=>{
    const page=await seededEditor();const other=await context.newPage();await other.goto(`chrome-extension://${id}/editor.html?capture=unrelated`);
    const response=await other.evaluate(()=>chrome.runtime.sendMessage({type:'OWN',id:'ownership-security'}));expect(response.ok).toBe(false);
    expect(await worker.evaluate(async()=>(await chrome.storage.session.get('editorOwners')).editorOwners['ownership-security'].length)).toBe(1);
    for(const payload of [{type:'TILE',id:'ownership-security',sequence:0,total:1,x:0,y:0,metrics:null},{type:'OWN',id:{malformed:true}},{type:'FAILED',id:'ownership-security',reason:{html:'<script>'}}]){
      const reply=await page.evaluate(message=>chrome.runtime.sendMessage(message),payload);expect(reply.ok).toBe(false);
    }
    await page.reload();await expect(page.getByTestId('editor-canvas')).toBeVisible();
  });
  test('production PNG, JPEG, PDF, and clipboard exports erase covered source data before scaling',async()=>{
    const page=await context.newPage();await page.goto(`chrome-extension://${id}/editor.html?capture=redaction-security`);await verifyRedactedExports(page);
  });
  test('untrusted text stays literal and CSP blocks remote resources and inline scripts',async()=>{
    const page=await seededEditor(),requests:string[]=[];
    const sockets=new Set<Socket>(),server=http.createServer((request,response)=>{requests.push(request.url!);response.writeHead(200,{'Content-Type':'text/plain'});response.end('security probe')});server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket))});await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    try{
      const address=server.address() as {port:number},url=`http://127.0.0.1:${address.port}/probe`;
      const untrusted=`"><img data-security-injected src="${url}"><script>window.__qaInjected=true</script>`;
      await page.getByLabel('Screenshot filename').fill(untrusted);
      expect(await page.getByLabel('Screenshot filename').inputValue()).toBe(untrusted.slice(0,120));expect(await page.locator('[data-security-injected]').count()).toBe(0);
      await page.evaluate(target=>{
        (window as any).__qaViolations=[];document.addEventListener('securitypolicyviolation',event=>(window as any).__qaViolations.push(event.effectiveDirective));
        const image=document.createElement('img');image.src=target;document.body.append(image);
        const frame=document.createElement('iframe');frame.src=target;document.body.append(frame);
        const object=document.createElement('object');object.data=target;document.body.append(object);
        const base=document.createElement('base');base.href=target;document.head.append(base);
        const script=document.createElement('script');script.textContent='window.__qaInjected=true';document.body.append(script);
        const form=document.createElement('form');form.action=target;form.method='POST';form.target='_blank';document.body.append(form);form.submit();
        void fetch(target).catch(()=>{});
      },url);
      await expect.poll(()=>page.evaluate(()=>(window as any).__qaViolations)).toEqual(expect.arrayContaining(['img-src','frame-src','object-src','base-uri','script-src-elem','connect-src','form-action']));
      expect(requests).toEqual([]);expect(await page.evaluate(()=>(window as any).__qaInjected)).toBeUndefined();await expect(page.getByTestId('editor-canvas')).toBeVisible();
    }finally{for(const socket of sockets)socket.destroy();await new Promise<void>(resolve=>server.close(()=>resolve()))}
  });
  test('initial storage failure shows an action error and leaves the source untouched',async()=>{
    const source=await context.newPage();await source.goto('http://127.0.0.1:4173/tests/fixtures/capture.html');await source.bringToFront();await source.evaluate(()=>scrollTo({left:30,top:77,behavior:'instant'}));
    await worker.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<typeof original>){if(this.name==='sessions')throw new DOMException('Device storage is full.','QuotaExceededError');return original.apply(this,args)}});
    await triggerAction(source);
    await expect.poll(()=>worker.evaluate(async()=>{const[tab]=await chrome.tabs.query({active:true,currentWindow:true});return {badge:await chrome.action.getBadgeText({tabId:tab.id}),title:await chrome.action.getTitle({tabId:tab.id})}})).toEqual({badge:'!',title:'Could not start capture: Device storage is full.'});
    expect(await source.evaluate(()=>({x:scrollX,y:scrollY,sticky:getComputedStyle(document.querySelector('.sticky')!).position}))).toEqual({x:30,y:77,sticky:'sticky'});expect(context.pages().some(p=>p.url().includes('editor.html?capture='))).toBe(false);
  });
  test('native Chrome action grants activeTab without host permissions and rejects child-frame commands',async()=>{
    const errors:string[]=[];context.on('weberror',event=>errors.push(event.error().message));context.on('console',message=>{if(message.type()==='error'&&message.location().url.startsWith(`chrome-extension://${id}/`))errors.push(message.text())});
    const unexpectedNetwork:string[]=[];context.on('request',request=>{if(/^https?:/.test(request.url())&&!request.url().startsWith('http://127.0.0.1:4173/'))unexpectedNetwork.push(request.url())});
    const cdp=await context.browser()!.newBrowserCDPSession(),source=await context.newPage();await source.goto('http://127.0.0.1:4173/tests/fixtures/capture.html');
    await source.evaluate(async()=>{const frame=document.createElement('iframe');frame.style.cssText='position:absolute;left:0;top:0;width:10px;height:10px';frame.src=location.href;document.body.append(frame);await new Promise(resolve=>frame.onload=resolve)});
    await source.bringToFront();await source.evaluate(()=>scrollTo({left:30,top:77,behavior:'instant'}));
    const version=await cdp.send('Browser.getVersion');
    await triggerAction(source);
    await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture)?.completed??0)).toBeGreaterThan(0);
    const childReplies=await worker.evaluate(async()=>{
      const {activeCapture}=await chrome.storage.session.get('activeCapture');
      return chrome.scripting.executeScript({target:{tabId:activeCapture.tabId,allFrames:true},args:[activeCapture.id],func:async(captureId:string)=>window===window.top?null:chrome.runtime.sendMessage({type:'DONE',id:captureId})});
    });
    expect(childReplies.filter(r=>r.frameId!==0).map(r=>r.result?.ok)).toEqual([false]);
    await expect.poll(()=>context.pages().find(p=>p.url().includes('editor.html?capture='))?.url()).toBeTruthy();const editor=context.pages().find(p=>p.url().includes('editor.html?capture='))!;
    await expect(editor.getByTestId('editor-canvas')).toBeVisible({timeout:30000});await expect(editor.locator('.dimensions')).toHaveText('2,100 × 2,840 px');
    expect(await editor.evaluate(()=>chrome.runtime.getManifest().host_permissions??[])).toEqual([]);
    await editor.getByRole('button',{name:'Export',exact:true}).click();const wait=editor.waitForEvent('download');await editor.getByRole('menuitem',{name:'PNG image'}).click();const image=await sharp((await (await wait).path())!).raw().toBuffer({resolveWithObject:true}),offset=(2770*image.info.width+2040)*image.info.channels;
    expect([...image.data.subarray(offset,offset+3)]).toEqual([40,125,255]);expect(await source.evaluate(()=>({x:scrollX,y:scrollY}))).toEqual({x:30,y:77});
    await expect(editor.getByRole('button',{name:'Export',exact:true})).toBeEnabled();await editor.getByRole('button',{name:'Export',exact:true}).click();const pdfWait=editor.waitForEvent('download');await editor.getByRole('menuitem',{name:'PDF document'}).click();const pdf=await PDFDocument.load(await fs.readFile((await (await pdfWait).path())!));expect(pdf.getPageCount()).toBe(1);
    await expect(editor.getByRole('button',{name:'Copy image',exact:true})).toBeEnabled();await editor.getByRole('button',{name:'Copy image',exact:true}).click();await expect(editor.getByText('Image copied to your clipboard.')).toBeVisible();expect(unexpectedNetwork).toEqual([]);
    const evidence=process.env.SCROLLOUT_QA_EVIDENCE_DIR??path.join(os.tmpdir(),'scrollout-evidence');await fs.mkdir(evidence,{recursive:true});await editor.setViewportSize({width:1600,height:1000});await editor.screenshot({path:path.join(evidence,'editor-production.png')});
    console.log(`Verified production action in ${version.product}`);
    await source.bringToFront();
    if(legacyActions)await source.addStyleTag({content:'main{height:16000px!important}'});
    const before=new Set(context.pages());await triggerAction(source);
    await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture)?.completed??0)).toBeGreaterThan(0);await triggerAction(source);
    await expect.poll(()=>context.pages().find(p=>!before.has(p)&&p.url().includes('editor.html?capture='))?.url()).toBeTruthy();const cancelled=context.pages().find(p=>!before.has(p)&&p.url().includes('editor.html?capture='))!;
    await expect(cancelled.getByText(/Capture cancelled\. Click Scrollout/)).toBeVisible();expect(await source.evaluate(()=>({x:scrollX,y:scrollY}))).toEqual({x:30,y:77});expect(errors).toEqual([]);
  });
});
