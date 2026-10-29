import { test, expect, type BrowserContext, type Worker, type Page } from '@playwright/test';
import { browserOptions, browserArgs, extensionContext } from './browser';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { RELEASE_URL, STORE_URL } from '../../src/shared/updates';

const release={schemaVersion:1,version:'1.0.7',sha256:'a'.repeat(64),storeVersion:null,storeUrl:null};
let context:BrowserContext,worker:Worker,profile:string,id:string,requests:Record<string,unknown>[],body:unknown,offline:boolean;
test.beforeEach(async()=>{
  profile=await fs.mkdtemp(path.join(os.tmpdir(),'scrollout-updates-'));requests=[];body=release;offline=false;
  ({context}=await extensionContext(profile,path.resolve('dist'),{...browserOptions,headless:true,viewport:{width:1200,height:900},ignoreDefaultArgs:['--disable-extensions'],args:browserArgs}));
  await context.route(RELEASE_URL,async route=>{
    const request=route.request();requests.push({url:request.url(),method:request.method(),body:request.postData(),headers:await request.allHeaders()});
    if(offline){await route.abort();return}
    await route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
  });
  worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');id=new URL(worker.url()).host;
  await expect.poll(async()=>{worker=context.serviceWorkers()[0]??worker;try{return await worker.evaluate(async()=>!!(await chrome.storage.session.get('browserSessionToken')).browserSessionToken)}catch{return false}}).toBe(true);
});
test.afterEach(async()=>{await context?.close();if(profile)await fs.rm(profile,{recursive:true,force:true})});
async function openHelp(page:Page){await page.goto(`chrome-extension://${id}/editor.html`);await page.getByRole('button',{name:'Help',exact:true}).click();await expect(page.getByRole('heading',{name:'Updates',exact:true})).toBeVisible()}

test('unpacked installs get safe release notices with no host permission or capture payload',async()=>{
  const page=await context.newPage();await openHelp(page);
  await expect(page.getByText('Version 1.0.7 is available.',{exact:true})).toBeVisible();await expect(page.getByText(/Installed version 1.0.6 - loaded unpacked/)).toBeVisible();
  await expect(page.getByRole('link',{name:'Download version 1.0.7'})).toHaveAttribute('href','https://scrollout.farflash.com/downloads/Scrollout-1.0.7.zip');
  expect(await page.evaluate(()=>chrome.runtime.getManifest().permissions)).toEqual(['activeTab','scripting','storage','clipboardWrite']);
  expect(await page.evaluate(()=>chrome.runtime.getManifest().host_permissions)).toBeUndefined();
  expect(requests).toHaveLength(1);expect(requests[0]).toMatchObject({url:RELEASE_URL,method:'GET',body:null});
  const headers=requests[0].headers as Record<string,string>;expect(headers.cookie).toBeUndefined();expect(headers.referer).toBeUndefined();
  await page.getByRole('button',{name:'Got it'}).click();await page.getByRole('button',{name:'Update details'}).click();await expect(page.getByRole('heading',{name:'Updates',exact:true})).toBeVisible();
});
test('cached checks survive editor reload, opt-out persists, and manual checking still works',async()=>{
  const page=await context.newPage();await openHelp(page);await expect(page.getByText('Release information checked just now.')).toBeVisible();
  await page.getByLabel('Check releases automatically').uncheck();await page.reload();await page.getByRole('button',{name:'Help',exact:true}).click();
  await expect(page.getByLabel('Check releases automatically')).not.toBeChecked();expect(requests).toHaveLength(1);
  await page.evaluate(async()=>{const cache=(await chrome.storage.local.get('releaseCheck')).releaseCheck;await chrome.storage.local.set({releaseCheck:{...cache,attemptedAt:0}})});
  await page.reload();await page.getByRole('button',{name:'Help',exact:true}).click();await expect(page.getByLabel('Check releases automatically')).not.toBeChecked();expect(requests).toHaveLength(1);
  await page.getByRole('button',{name:'Check for updates',exact:true}).click();await expect(page.getByText('Release information checked just now.')).toBeVisible();expect(requests).toHaveLength(2);
});
test('network and malicious metadata failures preserve the editor and do not create untrusted links',async()=>{
  offline=true;const page=await context.newPage();await openHelp(page);await expect(page.getByText(/Could not check for updates/)).toBeVisible();
  offline=false;body={...release,storeVersion:'1.0.7',storeUrl:'https://evil.example/update'};
  await page.getByRole('button',{name:'Check for updates',exact:true}).click();await expect(page.getByText(/Could not check for updates/)).toBeVisible();
  expect(await page.locator('a[href*="evil.example"]').count()).toBe(0);await page.getByRole('button',{name:'Got it'}).click();await expect(page.getByRole('heading',{name:'Capture your first page'})).toBeVisible();
});
test('an unapproved store release is never offered as a migration or browser update',async()=>{
  const page=await context.newPage();await openHelp(page);await expect(page.getByText('Release information checked just now.')).toBeVisible();
  await expect(page.getByRole('link',{name:/Install from the Chrome Web Store/})).toHaveCount(0);
  body={...release,storeVersion:'1.0.7',storeUrl:STORE_URL};await page.getByRole('button',{name:'Check for updates',exact:true}).click();await expect(page.getByRole('link',{name:/Install from the Chrome Web Store/})).toHaveAttribute('href',STORE_URL);
});
test('ready Chrome updates wait through duplicate editors and apply after the last closes',async()=>{
  const first=await context.newPage(),second=await context.newPage();await first.goto(`chrome-extension://${id}/editor.html`);await second.goto(first.url());
  await expect(second.getByRole('heading',{name:'Capture your first page'})).toBeVisible();
  await worker.evaluate(async()=>{(globalThis as any).__reloads=0;chrome.runtime.reload=()=>{(globalThis as any).__reloads++};await chrome.storage.local.set({pendingBrowserUpdate:'1.0.7'})});
  await first.close();await expect.poll(()=>worker.evaluate(()=>(globalThis as any).__reloads)).toBe(0);
  await second.close();await expect.poll(()=>worker.evaluate(()=>(globalThis as any).__reloads)).toBe(1);
});
for(const installType of ['normal','admin'] as const)test(`${installType} installs keep Chrome policy updates separate from unpacked releases`,async()=>{
  const page=await context.newPage();await page.addInitScript(type=>{
    const original=chrome.management.getSelf;chrome.management.getSelf=async()=>({...await original(),installType:type,updateUrl:'https://clients2.google.com/service/update2/crx'});
  },installType);
  await openHelp(page);await expect(page.getByText('Release information checked just now.')).toBeVisible();
  await expect(page.getByRole('link',{name:'Download version 1.0.7'})).toHaveCount(0);
  await expect(page.getByText('Version 1.0.7 is available.',{exact:true})).toHaveCount(0);
  if(installType==='admin')await expect(page.getByText(/Your organization may control the available version/)).toBeVisible();
  await page.evaluate(()=>{(window as any).__nativeChecks=0;chrome.runtime.requestUpdateCheck=async()=>{(window as any).__nativeChecks++;return {status:'throttled' as chrome.runtime.RequestUpdateCheckStatus}}});
  body={...release,storeVersion:'1.0.7',storeUrl:STORE_URL};await page.getByRole('button',{name:'Check for updates',exact:true}).click();
  await expect(page.getByText(/Chrome is limiting update checks/)).toBeVisible();expect(await page.evaluate(()=>(window as any).__nativeChecks)).toBe(1);
  await page.evaluate(()=>chrome.storage.local.set({pendingBrowserUpdate:'1.0.7'}));await expect(page.getByText('Version 1.0.7 is available.',{exact:true})).toBeVisible();
});
test('unreadable preferences prevent automatic network checks and leave manual retry available',async()=>{
  const page=await context.newPage();await page.addInitScript(()=>{chrome.storage.local.get=async()=>{throw Error('storage unavailable')}});
  await openHelp(page);await expect(page.getByText(/Local update settings could not be read/)).toBeVisible();expect(requests).toHaveLength(0);
  await page.getByRole('button',{name:'Check for updates',exact:true}).click();await expect(page.getByText('Release information checked just now.')).toBeVisible();expect(requests).toHaveLength(1);
});
test('update help works in a narrow window',async()=>{
  const page=await context.newPage();await page.setViewportSize({width:390,height:844});await openHelp(page);
  await expect(page.getByRole('link',{name:'Download version 1.0.7'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  expect(await page.getByRole('dialog').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
  const evidence=process.env.SCROLLOUT_QA_EVIDENCE_DIR??path.join(os.tmpdir(),'scrollout-evidence');await fs.mkdir(evidence,{recursive:true});
  await page.getByRole('heading',{name:'Updates',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(evidence,'update-help-mobile.png')});
  await page.setViewportSize({width:1200,height:1000});await page.getByRole('heading',{name:'Updates',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(evidence,'update-help-desktop.png')});
  await page.getByRole('button',{name:'Got it'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
