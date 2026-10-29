import { expect, type Page } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { testBaseUrl } from './browser';

export async function seedClipboardScreenshot(page:Page) {
  await page.evaluate(async()=>{
    const id=new URL(location.href).searchParams.get('capture')!;
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=3000;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#0B8F78';ctx.fillRect(0,0,1000,3000);ctx.fillStyle='#287DFF';ctx.fillRect(40,2300,800,150);ctx.fillStyle='#FF0000';ctx.fillRect(100,2000,41,41);
    const blob=await new Promise<Blob>(resolve=>canvas.toBlob(value=>resolve(value!)));
    const open=indexedDB.open('scrollout-temporary',1),db=await new Promise<IDBDatabase>(resolve=>{open.onsuccess=()=>resolve(open.result)}),tx=db.transaction(['sessions','tiles'],'readwrite');
    tx.objectStore('sessions').put({id,status:'ready',progress:100,sourceTabId:0,sourceWindowId:0,sourceTitle:'Clipboard fixture',sourceHost:'example.com',createdAt:1,editorTabIds:[],document:{width:1000,height:3000,crop:{x:40,y:50,width:800,height:2400},annotations:[{id:'private',kind:'redact',x:100.25,y:2000.25,width:40.5,height:40.5,color:'#ffffff',opacity:.1,strokeWidth:1,fontSize:32},{id:'outline',kind:'rect',x:220,y:100,width:100,height:100,color:'#FF6359',opacity:1,strokeWidth:4,fontSize:32}],filename:'Clipboard fixture',sourceHost:'example.com',createdAt:1}});
    tx.objectStore('tiles').put({id:`${id}:0`,captureId:id,sequence:0,x:0,y:0,width:1000,height:3000,sourceX:0,sourceY:0,sourceWidth:1000,sourceHeight:3000,blob});
    await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve()});db.close();
  });
  await page.reload();await expect(page.getByTestId('editor-canvas')).toBeVisible();
}

export async function verifyContextImagePaste(page:Page) {
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});
  await expect(page).toHaveTitle('Clipboard fixture — Scrollout');await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  const canvas=page.getByTestId('editor-canvas');await canvas.click({button:'right'});
  await expect(page.getByRole('menu',{name:'Screenshot actions'})).toBeVisible();
  const evidence=process.env.SCROLLOUT_QA_EVIDENCE_DIR;
  if(evidence){await fs.mkdir(evidence,{recursive:true});await page.screenshot({path:path.join(evidence,'clipboard-context-menu.png')})}
  await page.getByRole('menuitem',{name:'Copy image',exact:true}).click();
  await expect(page.getByText('Image copied to your clipboard.')).toBeVisible();await expect(page.getByRole('menu',{name:'Screenshot actions'})).toHaveCount(0);
  const destination=await page.context().newPage();
  try {
    await destination.goto(`${testBaseUrl}/tests/fixtures/capture.html`);
    await destination.evaluate(()=>{
      const target=document.createElement('div');target.contentEditable='true';target.setAttribute('aria-label','Paste screenshot');document.body.replaceChildren(target);
      target.addEventListener('paste',async event=>{event.preventDefault();const image=event.clipboardData?.files[0];if(image)(window as any).__pastedImage={type:image.type,bytes:Array.from(new Uint8Array(await image.arrayBuffer()))}});
    });
    await destination.getByLabel('Paste screenshot').focus();await destination.keyboard.press('Control+v');
    await expect.poll(()=>destination.evaluate(()=>(window as any).__pastedImage?.type)).toBe('image/png');
    const bytes=Buffer.from(await destination.evaluate(()=>(window as any).__pastedImage.bytes)),pasted=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    expect({width:pasted.info.width,height:pasted.info.height}).toEqual({width:800,height:2400});
    const pixel=(x:number,y:number)=>{const i=(y*pasted.info.width+x)*4;return [...pasted.data.subarray(i,i+4)]};
    expect(pixel(5,5)).toEqual([11,143,120,255]);expect(pixel(20,2300)).toEqual([40,125,255,255]);expect(pixel(180,100)).toEqual([255,99,89,255]);
    expect(pixel(60,1950)).toEqual([0,0,0,255]);expect(pixel(100,1990)).toEqual([0,0,0,255]);
    await page.bringToFront();await page.getByRole('button',{name:'Export',exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('menuitem',{name:'PNG image'}).click();
    const exported=await sharp((await (await wait).path())!).ensureAlpha().raw().toBuffer();expect(pasted.data.equals(exported)).toBe(true);expect(errors).toEqual([]);
    if(evidence){await fs.writeFile(path.join(evidence,'clipboard-pasted.png'),bytes);await page.screenshot({path:path.join(evidence,'clipboard-copy-success.png')})}
  } finally {await destination.close()}
}
