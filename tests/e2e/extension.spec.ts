import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { browserOptions, captureArgs, testBaseUrl } from './browser';

let context:BrowserContext,worker:Worker,folder:string;
test.describe('real MV3 capture pipeline',()=>{
  test.beforeEach(async({},testInfo)=>{
    folder=await fs.mkdtemp(path.join(os.tmpdir(),'scrollout-extension-'));
    const extension=path.join(folder,'extension');await fs.cp(path.resolve('dist'),extension,{recursive:true});
    const manifest=JSON.parse(await fs.readFile(path.join(extension,'manifest.json'),'utf8'));
    expect(manifest.permissions).toEqual(['activeTab','scripting','storage','clipboardWrite']);expect(manifest.host_permissions).toBeUndefined();
    // Only the isolated test copy gets host access because Playwright cannot click
    // browser-toolbar actions to grant activeTab. Production stays unchanged.
    manifest.host_permissions=['<all_urls>'];manifest.background.service_worker='test-background.js';await fs.writeFile(path.join(extension,'manifest.json'),JSON.stringify(manifest));
    await fs.writeFile(path.join(extension,'test-events.js'),"const add = chrome.tabs.onUpdated.addListener; globalThis.__scrolloutTabUpdates = []; chrome.tabs.onUpdated.addListener = listener => { globalThis.__scrolloutTabUpdates.push(listener); add.call(chrome.tabs.onUpdated, listener); };");
    await fs.writeFile(path.join(extension,'test-background.js'),"import './test-events.js'; import { start } from './background.js'; globalThis.__scrolloutStart = start;");
    context=await chromium.launchPersistentContext(path.join(folder,'profile'),{...browserOptions,headless:true,viewport:null,ignoreDefaultArgs:['--disable-extensions'],args:[...captureArgs(testInfo.annotations.some(a=>a.type==='high-dpi')?2:1),'--enable-unsafe-extension-debugging',`--load-extension=${extension}`]});
    // Branded Chrome 137+ removed startup loading; Chrome 120 predates the CDP
    // loader. Support both without modifying the extension under test.
    const cdp=await context.browser()!.newBrowserCDPSession();
    try{if(!context.serviceWorkers().length)await cdp.send('Extensions.loadUnpacked',{path:extension})}
    catch(error){if(!/wasn't found|not found|Unknown method/.test(String(error)))throw error}
    worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
    await expect.poll(async()=>{worker=context.serviceWorkers().find(w=>w.url().endsWith('/test-background.js'))??worker;try{return await worker.evaluate(()=>typeof (globalThis as any).__scrolloutStart==='function')}catch{return false}}).toBe(true);
  });
  test.afterEach(async()=>{await context?.close();if(folder)await fs.rm(folder,{recursive:true,force:true})});
  async function start(){await worker.evaluate(async()=>{const tabs=await chrome.tabs.query({active:true,currentWindow:true});await (globalThis as any).__scrolloutStart(tabs[0])})}
  async function source(suffix=''){const page=await context.newPage();await page.goto(`${testBaseUrl}/tests/fixtures/capture.html${suffix}`);await page.bringToFront();await page.evaluate(()=>scrollTo({top:77,left:30,behavior:'instant'}));return page}
  async function editor(){await expect.poll(()=>context.pages().find(p=>p.url().includes('editor.html?capture='))?.url()).toBeTruthy();return context.pages().find(p=>p.url().includes('editor.html?capture='))!}
  test('stitches both axes, lazy images, initial feed length, and restores the page',async()=>{
    const page=await source('?grow');const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));await start();const edit=await editor();await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});
    await expect(edit.locator('.dimensions')).toHaveText(`${size.width.toLocaleString()} × ${size.height.toLocaleString()} px`);
    expect(await page.evaluate(()=>({x:scrollX,y:scrollY,fixed:getComputedStyle(document.querySelector('.header')!).visibility,sticky:getComputedStyle(document.querySelector('.sticky')!).position}))).toEqual({x:30,y:77,fixed:'visible',sticky:'sticky'});
    await edit.getByRole('button',{name:'Export',exact:true}).click();const wait=edit.waitForEvent('download');await edit.getByRole('menuitem',{name:'PNG image'}).click();const image=await sharp((await (await wait).path())!).raw().toBuffer({resolveWithObject:true});
    expect(image.info.width).toBe(size.width);expect(image.info.height).toBe(size.height);
    const pixel=(x:number,y:number)=>{const i=(y*image.info.width+x)*image.info.channels;return [...image.data.subarray(i,i+3)]};
    expect(pixel(2040,2770)).toEqual([40,125,255]);expect(pixel(900,750)).toEqual([11,143,120]);expect(pixel(900,1550)).toEqual([11,143,120]);expect(pixel(440,2380)).toEqual([40,125,255]);
    await edit.getByRole('button',{name:'Copy image',exact:true}).click();await expect(edit.getByText('Image copied to your clipboard.')).toBeVisible();
    await edit.getByLabel('Screenshot filename').fill('Saved temporary edit');await edit.waitForTimeout(400);await edit.reload();await expect(edit.getByLabel('Screenshot filename')).toHaveValue('Saved temporary edit');
    const id=new URL(edit.url()).searchParams.get('capture')!;
    await expect.poll(()=>worker.evaluate(async(captureId)=>(await chrome.storage.session.get('editorOwners')).editorOwners?.[captureId]?.length,id)).toBe(1);
    await edit.close();await expect.poll(async()=>worker.evaluate(async(captureId)=>{const request=indexedDB.open('scrollout-temporary',1);const db=await new Promise<IDBDatabase>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});const read=db.transaction('sessions').objectStore('sessions').get(captureId);const value=await new Promise(resolve=>{read.onsuccess=()=>resolve(read.result)});db.close();return !!value},id)).toBe(false);
    await expect.poll(()=>worker.evaluate(async(captureId)=>!!(await chrome.storage.session.get('editorOwners')).editorOwners?.[captureId],id)).toBe(false);
  });
  test('duplicate editors retain temporary captures and browser resets expire them',async()=>{
    const page=await source();await start();const edit=await editor();await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});
    const id=new URL(edit.url()).searchParams.get('capture')!;
    const duplicate=await context.newPage();await duplicate.goto(edit.url());await expect(duplicate.getByTestId('editor-canvas')).toBeVisible();
    await expect.poll(()=>worker.evaluate(async(captureId)=>(await chrome.storage.session.get('editorOwners')).editorOwners?.[captureId]?.length,id)).toBe(2);
    await edit.close();await expect.poll(()=>worker.evaluate(async(captureId)=>(await chrome.storage.session.get('editorOwners')).editorOwners?.[captureId]?.length,id)).toBe(1);
    await duplicate.reload();await expect(duplicate.getByTestId('editor-canvas')).toBeVisible();
    // Browser restart clears storage.session but preserves disk-backed IDB.
    // Recreate that lifecycle boundary without using a normal user profile.
    await worker.evaluate(()=>chrome.storage.session.clear());
    const cdp=await context.newCDPSession(page);await cdp.send('ServiceWorker.enable');await cdp.send('ServiceWorker.stopAllWorkers');
    await duplicate.reload();await expect(duplicate.getByText('This capture is no longer available')).toBeVisible();
    await expect(duplicate.getByText(/temporary capture has expired/)).toBeVisible();await expect(duplicate.getByTestId('editor-canvas')).toHaveCount(0);
  });
  test('captures both axes of a dominant application panel with header, footer and restored scroll',async()=>{
    const page=await context.newPage();await page.goto(`${testBaseUrl}/tests/fixtures/panel.html`);await page.bringToFront();
    const expected=await page.evaluate(()=>{const panel=document.querySelector('.panel')!;panel.scrollTo({left:17,top:77,behavior:'instant'});const r=panel.getBoundingClientRect();return {width:innerWidth+panel.scrollWidth-panel.clientWidth,height:innerHeight+panel.scrollHeight-panel.clientHeight,panelX:r.left+panel.clientLeft,panelY:r.top+panel.clientTop}});
    await start();const edit=await editor();await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});
    await expect(edit.locator('.dimensions')).toHaveText(`${expected.width.toLocaleString()} × ${expected.height.toLocaleString()} px`);
    await edit.getByRole('button',{name:'Export',exact:true}).click();const wait=edit.waitForEvent('download');await edit.getByRole('menuitem',{name:'PNG image'}).click();const image=await sharp((await (await wait).path())!).raw().toBuffer({resolveWithObject:true});
    const pixel=(x:number,y:number)=>{const i=(Math.round(y)*image.info.width+Math.round(x))*image.info.channels;return [...image.data.subarray(i,i+3)]};
    expect(pixel(200,20)).toEqual([255,99,89]);expect(pixel(expected.panelX+1540,expected.panelY+40+2430)).toEqual([40,125,255]);expect(pixel(200,expected.height-20)).toEqual([23,33,43]);
    expect(pixel(expected.panelX+700,expected.panelY+40+750)).toEqual([11,143,120]);expect(pixel(expected.panelX+700,expected.panelY+40+1550)).toEqual([11,143,120]);
    expect(await page.evaluate(()=>{const panel=document.querySelector('.panel')!;return {x:panel.scrollLeft,y:panel.scrollTop,sticky:getComputedStyle(document.querySelector('.sticky')!).position}})).toEqual({x:17,y:77,sticky:'sticky'});
    if(process.env.SCROLLOUT_QA_EVIDENCE_DIR){await fs.mkdir(process.env.SCROLLOUT_QA_EVIDENCE_DIR,{recursive:true});await edit.screenshot({path:path.join(process.env.SCROLLOUT_QA_EVIDENCE_DIR,'panel-editor.png')});await sharp(image.data,{raw:image.info}).png().toFile(path.join(process.env.SCROLLOUT_QA_EVIDENCE_DIR,'panel-export.png'))}
  });
  test('panel captures preserve final pixels at 125% zoom and high DPI with fractional borders and padding',{annotation:{type:'high-dpi',description:'2x native display scale'}},async()=>{
    const page=await context.newPage();await page.goto(`${testBaseUrl}/tests/fixtures/panel.html`);await page.bringToFront();
    await worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await chrome.tabs.setZoom(tab.id!,1.25)});
    await page.addStyleTag({content:'.panel{border:1.25px solid #555;padding:5.25px}'});
    const origin=await page.evaluate(()=>{const panel=document.querySelector('.panel')!,content=document.querySelector('.content')!,r=content.getBoundingClientRect();return {x:r.left,y:r.top,viewportWidth:innerWidth,viewportHeight:innerHeight}});
    const scale=await worker.evaluate(async dimensions=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true}),data=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'}),bytes=Uint8Array.from(atob(data.slice(data.indexOf(',')+1)),c=>c.charCodeAt(0)),bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));const value={x:bitmap.width/dimensions.viewportWidth,y:bitmap.height/dimensions.viewportHeight};bitmap.close();await chrome.storage.session.set({lastScreenshotAt:Date.now()});return value},origin);
    await start();const edit=await editor();await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});
    await edit.getByRole('button',{name:'Export',exact:true}).click();const wait=edit.waitForEvent('download');await edit.getByRole('menuitem',{name:'PNG image'}).click();const image=await sharp((await (await wait).path())!).raw().toBuffer({resolveWithObject:true});
    const pixel=(x:number,y:number)=>{const i=(Math.round(y*scale.y)*image.info.width+Math.round(x*scale.x))*image.info.channels;return [...image.data.subarray(i,i+3)]};
    expect(pixel(origin.x+1540,origin.y+2430)).toEqual([40,125,255]);
    for(const y of [725,750,775,1525,1550,1575])expect(pixel(origin.x+700,origin.y+y)).toEqual([11,143,120]);
    expect(pixel(200,20)).toEqual([255,99,89]);expect(pixel(200,image.info.height/scale.y-20)).toEqual([23,33,43]);
    expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.sticky')!).position)).toBe('sticky');
  });
  for(const zoom of [1.25,1.3])test(`vertical panels at ${zoom*100}% zoom capture each row once without phantom horizontal tiles`,async()=>{
    const page=await context.newPage();await page.goto(`${testBaseUrl}/tests/fixtures/panel.html?virtual&vertical`);await page.bringToFront();
    await worker.evaluate(async factor=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await chrome.tabs.setZoom(tab.id!,factor);const capture=chrome.tabs.captureVisibleTab.bind(chrome.tabs);(globalThis as any).__captureTimes=[];chrome.tabs.captureVisibleTab=(async(...args:any[])=>{(globalThis as any).__captureTimes.push(Date.now());return (capture as any)(...args)}) as typeof chrome.tabs.captureVisibleTab},zoom);
    const expected=await page.evaluate(()=>{const panel=document.querySelector('.panel')!,r=panel.getBoundingClientRect(),content=document.querySelector('.content')!.getBoundingClientRect();return {captures:Math.ceil(panel.scrollHeight/r.height),x:content.left+300,y:content.top+3975,viewportWidth:innerWidth,viewportHeight:innerHeight,pixelRatio:devicePixelRatio}});
    await start();const edit=await editor();await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});
    const times=await worker.evaluate(()=>(globalThis as any).__captureTimes as number[]);expect(times).toHaveLength(expected.captures);for(let i=1;i<times.length;i++)expect(times[i]-times[i-1]).toBeGreaterThanOrEqual(550);
    await edit.getByRole('button',{name:'Export',exact:true}).click();const wait=edit.waitForEvent('download');await edit.getByRole('menuitem',{name:'PNG image'}).click();const image=await sharp((await (await wait).path())!).raw().toBuffer({resolveWithObject:true});
    // Chrome may report a ratio just below the requested zoom; use its actual
    // display scale when rounding the one-viewport output and final-row pixel.
    expect(image.info.width).toBe(Math.round(expected.viewportWidth*expected.pixelRatio));
    const i=(Math.round(expected.y*expected.pixelRatio)*image.info.width+Math.round(expected.x*expected.pixelRatio))*image.info.channels;expect([...image.data.subarray(i,i+3)]).toEqual([40,125,255]);
    expect(await page.evaluate(()=>({x:document.querySelector('.panel')!.scrollLeft,y:document.querySelector('.panel')!.scrollTop}))).toEqual({x:0,y:0});
  });
  test('capture completion opens the editor when background polling is suspended',async()=>{
    await context.addInitScript(()=>{const interval=window.setInterval;window.setInterval=((handler:TimerHandler,timeout?:number,...args:unknown[])=>timeout===500?0:interval(handler,timeout,...args)) as typeof window.setInterval});
    const page=await context.newPage();await page.goto(`${testBaseUrl}/tests/fixtures/panel.html?virtual&vertical`);await page.bringToFront();await start();const edit=await editor();await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});await expect(edit.getByRole('button',{name:'Export',exact:true})).toBeEnabled();
  });
  test('captures virtualized panel rows beyond the original viewport and restores on cancellation',async()=>{
    const page=await context.newPage();await page.goto(`${testBaseUrl}/tests/fixtures/panel.html?virtual`);await page.bringToFront();
    const origin=await page.evaluate(()=>{const panel=document.querySelector('.panel')!,r=panel.getBoundingClientRect();return{x:r.left+panel.clientLeft,y:r.top+panel.clientTop}});
    await start();const edit=await editor();await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});
    await edit.getByRole('button',{name:'Export',exact:true}).click();const wait=edit.waitForEvent('download');await edit.getByRole('menuitem',{name:'PNG image'}).click();const image=await sharp((await (await wait).path())!).raw().toBuffer({resolveWithObject:true}),i=((origin.y+40+3975)*image.info.width+origin.x+900)*image.info.channels;
    expect([...image.data.subarray(i,i+3)]).toEqual([40,125,255]);
    await edit.close();await page.bringToFront();await page.evaluate(()=>document.querySelector('.panel')!.scrollTo({left:17,top:77,behavior:'instant'}));await start();const cancelled=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);
    await page.evaluate(()=>document.querySelector('.panel')!.scrollTo({top:900,behavior:'instant'}));await expect(cancelled.getByText('We couldn’t finish this capture')).toBeVisible();
    expect(await page.evaluate(()=>{const panel=document.querySelector('.panel')!;return{x:panel.scrollLeft,y:panel.scrollTop}})).toEqual({x:17,y:77});
  });
  test('switching tabs cancels and restores source styles and scrolling',async()=>{
    const page=await source();await start();const edit=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);
    const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await expect(edit.getByText('We couldn’t finish this capture')).toBeVisible();await expect(edit.getByText(/Capture cancelled because you changed tabs/)).toBeVisible();expect(await page.evaluate(()=>scrollY)).toBe(77);expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.sticky')!).position)).toBe('sticky');
  });
  test('a second action invocation cancels and restores the page',async()=>{
    const page=await source();await start();const edit=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);
    await start();await expect(edit.getByText('We couldn’t finish this capture')).toBeVisible();await expect(edit.getByText(/Capture cancelled\. Click Scrollout/)).toBeVisible();expect(await page.evaluate(()=>scrollY)).toBe(77);expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.header')!).visibility)).toBe('visible');
  });
  test('navigation interrupts capture with a clear error',async()=>{
    const page=await source();await start();const edit=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);
    await page.goto('about:blank');await expect(edit.getByText('We couldn’t finish this capture')).toBeVisible();await expect(edit.getByText(/page navigated/)).toBeVisible();await expect(edit.getByTestId('editor-canvas')).toHaveCount(0);
  });
  test('loading-status updates during capture preserve the original document',async()=>{
    const page=await source();await start();const edit=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);
    await worker.evaluate(async()=>{const {activeCapture}=await chrome.storage.session.get('activeCapture'),tab=await chrome.tabs.get(activeCapture.tabId);for(const listener of (globalThis as any).__scrolloutTabUpdates)listener(tab.id,{status:'loading'},tab)});
    await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});expect(await page.evaluate(()=>scrollY)).toBe(77);
  });
  test('reloading the same URL cancels instead of mixing document images',async()=>{
    const page=await source();await start();const edit=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);
    await page.reload();await expect(edit.getByText('We couldn’t finish this capture')).toBeVisible();await expect(edit.getByText(/page navigated|access to it changed/)).toBeVisible();await expect(edit.getByTestId('editor-canvas')).toHaveCount(0);
  });
  test('restricted pages show an actionable capture error',async()=>{
    const page=await context.newPage();await page.goto('chrome://version');await page.bringToFront();await start();const edit=await editor();
    await expect(edit.getByText('We couldn’t finish this capture')).toBeVisible();await expect(edit.getByText('This page does not allow full-page capture. Try a regular website instead.')).toBeVisible();
  });
  test('capture quota errors restore the page and show a useful failure',async()=>{
    const page=await source();await worker.evaluate(()=>{chrome.tabs.captureVisibleTab=async()=>{throw new Error('Screenshot capture quota exceeded. Please try again.')}});await start();const edit=await editor();await expect(edit.getByText(/Screenshot capture quota exceeded/)).toBeVisible();expect(await page.evaluate(()=>scrollY)).toBe(77);expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.header')!).visibility)).toBe('visible');
  });
  test('storage failures restore the page without reporting successful capture',async()=>{
    const page=await source();await worker.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<typeof original>){if(this.name==='tiles')throw new DOMException('Device storage is full. Export or delete other files and try again.','QuotaExceededError');return original.apply(this,args)}});await start();const edit=await editor();await expect(edit.getByText(/Device storage is full/)).toBeVisible();await expect(edit.getByTestId('editor-canvas')).toHaveCount(0);expect(await page.evaluate(()=>scrollY)).toBe(77);
  });
  test('viewport resize cancels cleanly',async()=>{
    const page=await source();await start();const edit=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);await page.setViewportSize({width:850,height:650});await expect(edit.getByText(/viewport (?:or zoom )?changed/)).toBeVisible();expect(await page.evaluate(()=>scrollY)).toBe(77);
  });
  test('manual scrolling cancels and restores the exact source position',async()=>{
    const page=await source();await start();const edit=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);await page.mouse.move(400,300);await page.mouse.wheel(0,200);await expect(edit.getByText(/you scrolled the page/)).toBeVisible();expect(await page.evaluate(()=>scrollY)).toBe(77);
  });
  test('unexpected document scrolling cancels even without wheel or keyboard events',async()=>{
    const page=await source();await start();const edit=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);
    await page.evaluate(()=>scrollTo({top:500,left:300,behavior:'instant'}));await expect(edit.getByText(/page scrolled unexpectedly/)).toBeVisible();expect(await page.evaluate(()=>({x:scrollX,y:scrollY}))).toEqual({x:30,y:77});await expect(edit.getByTestId('editor-canvas')).toHaveCount(0);
  });
  test('zoomed captures retain native pixel dimensions',async()=>{
    const page=await source();await worker.evaluate(async()=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});await chrome.tabs.setZoom(tab.id!,1.25)});
    const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));await start();const edit=await editor();await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});
    await expect(edit.locator('.dimensions')).toHaveText(`${Math.round(dimensions.width*1.25).toLocaleString()} × ${Math.round(dimensions.height*1.25).toLocaleString()} px`);expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.sticky')!).position)).toBe('sticky');
  });
  test('worker termination preserves state or reports interruption with restored styles',async()=>{
    const page=await source();await start();const edit=await editor();await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);
    const cdp=await context.newCDPSession(page);await cdp.send('ServiceWorker.enable');await cdp.send('ServiceWorker.stopAllWorkers');
    const captureId=new URL(edit.url()).searchParams.get('capture')!;
    // A worker restart can briefly show the editor's initial loading screen.
    // Wait for saved completion/interruption, not a transient heading change.
    await expect.poll(()=>edit.evaluate(async id=>{
      const open=indexedDB.open('scrollout-temporary',1),db=await new Promise<IDBDatabase>((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error)});
      const request=db.transaction('sessions').objectStore('sessions').get(id),status=await new Promise<string>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result?.status??'missing');request.onerror=()=>reject(request.error)});db.close();return status;
    },captureId),{timeout:30000}).toMatch(/^(ready|error)$/);
    await expect.poll(()=>page.evaluate(()=>scrollY),{timeout:6000}).toBe(77);expect(await page.evaluate(()=>getComputedStyle(document.querySelector('.header')!).visibility)).toBe('visible');
  });
  test('worker startup stops an orphaned capture when its last editor disappears',async()=>{
    const page=await source();await page.addStyleTag({content:'main{height:16000px!important}'});await start();const edit=await editor();
    await expect.poll(()=>worker.evaluate(async()=>((await chrome.storage.session.get('activeCapture')).activeCapture as any)?.completed??0)).toBeGreaterThan(0);
    const cdp=await context.newCDPSession(page);await cdp.send('ServiceWorker.enable');await cdp.send('ServiceWorker.stopAllWorkers');await edit.close();
    await expect.poll(()=>page.evaluate(()=>({x:scrollX,y:scrollY,fixed:getComputedStyle(document.querySelector('.header')!).visibility,sticky:getComputedStyle(document.querySelector('.sticky')!).position})),{timeout:3000}).toEqual({x:30,y:77,fixed:'visible',sticky:'sticky'});
  });
  test('high-DPI captures use the actual Chrome bitmap scale',{annotation:{type:'high-dpi',description:'2x native display scale'}},async()=>{
    const page=await source();const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,viewportWidth:innerWidth,viewportHeight:innerHeight,dpr:devicePixelRatio}));expect(size.dpr).toBe(2);
    // CDP's emulated DPR can differ from tabs.captureVisibleTab's native bitmap.
    // Calibrate against the API, rather than inventing pixels from window.DPR.
    const scale=await worker.evaluate(async(dimensions)=>{const [tab]=await chrome.tabs.query({active:true,currentWindow:true});const data=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});const bytes=Uint8Array.from(atob(data.slice(data.indexOf(',')+1)),c=>c.charCodeAt(0));const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));const value={x:bitmap.width/dimensions.viewportWidth,y:bitmap.height/dimensions.viewportHeight};bitmap.close();await chrome.storage.session.set({lastScreenshotAt:Date.now()});return value},size);
    await start();const edit=await editor();await expect(edit.getByTestId('editor-canvas')).toBeVisible({timeout:30000});await expect(edit.locator('.dimensions')).toHaveText(`${Math.round(size.width*scale.x).toLocaleString()} × ${Math.round(size.height*scale.y).toLocaleString()} px`);
  });
});
