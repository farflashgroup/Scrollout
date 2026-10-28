import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import path from 'node:path';
import os from 'node:os';
import { unzipSync } from 'fflate';

async function drag(page:any,a:{x:number;y:number},b:{x:number;y:number}){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up()}
test('draw, undo, text, redact, crop, and export real images and PDF',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/editor.html?demo=1');await expect(page.getByTestId('editor-canvas')).toBeVisible();
  await page.getByRole('button',{name:'Draw',exact:true}).click();await drag(page,{x:700,y:300},{x:900,y:350});await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('button',{name:'Redo',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Redo',exact:true}).click();
  await page.getByRole('button',{name:'Text',exact:true}).click();await page.mouse.click(730,400);await page.getByLabel('Annotation text').fill('Looks good');await page.getByLabel('Annotation text').press('Enter');await expect(page.getByLabel('Annotation text')).toHaveCount(0);
  await page.getByRole('button',{name:'Redact',exact:true}).click();await drag(page,{x:730,y:480},{x:830,y:520});await expect(page.getByText('Solid black · fully opaque')).toBeVisible();
  await page.getByRole('button',{name:'Crop',exact:true}).click();await drag(page,{x:650,y:250},{x:1000,y:600});await page.getByRole('button',{name:'Apply crop'}).click();await expect(page.locator('.dimensions')).toHaveText('700 × 700 px');
  await page.getByRole('button',{name:'Export',exact:true}).click();const pngWait=page.waitForEvent('download');await page.getByRole('menuitem',{name:'PNG image'}).click();const png=await pngWait;const image=await sharp(await png.path()).raw().toBuffer({resolveWithObject:true});expect(image.info.width).toBe(700);expect(image.info.height).toBe(700);
  const pixel=(460*image.info.width+260)*image.info.channels;expect([...image.data.subarray(pixel,pixel+3)]).toEqual([0,0,0]);
  await expect(page.getByRole('button',{name:'Export',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Export',exact:true}).click();const jpegWait=page.waitForEvent('download');await page.getByRole('menuitem',{name:'JPEG image'}).click();const jpeg=await jpegWait;expect((await sharp(await jpeg.path()).metadata()).format).toBe('jpeg');
  await expect(page.getByRole('button',{name:'Export',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Export',exact:true}).click();const pdfWait=page.waitForEvent('download');await page.getByRole('menuitem',{name:'PDF document'}).click();const pdf=await pdfWait;expect((await PDFDocument.load(await fs.readFile((await pdf.path())!))).getPageCount()).toBe(1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('.dimensions')).toHaveText('1,440 × 5,200 px');
  await page.getByRole('button',{name:'Export',exact:true}).click();const fullPdfWait=page.waitForEvent('download');await page.getByRole('menuitem',{name:'PDF document'}).click();const fullPdf=await fullPdfWait;expect((await PDFDocument.load(await fs.readFile((await fullPdf.path())!))).getPageCount()).toBe(3);expect(errors).toEqual([]);
});
test('all shape tools, selection movement, resizing, and keyboard delete work',async({page})=>{
  await page.goto('/editor.html?demo=1');await expect(page.getByTestId('editor-canvas')).toBeVisible();
  for(const name of ['Highlight','Arrow','Shapes']){await page.getByRole('button',{name,exact:true}).click();await drag(page,{x:680,y:280},{x:850,y:360})}
  await page.getByRole('button',{name:'Ellipse',exact:true}).click();await drag(page,{x:720,y:430},{x:850,y:480});
  await page.getByRole('button',{name:'Select',exact:true}).click();await page.mouse.click(720,455);await expect(page.getByRole('button',{name:'Delete selection'})).toBeVisible();await drag(page,{x:720,y:455},{x:760,y:470});await drag(page,{x:890,y:495},{x:930,y:540});await page.keyboard.press('Delete');await expect(page.getByRole('button',{name:'Delete selection'})).toHaveCount(0);
  await page.keyboard.press('Control+z');await expect(page.getByRole('button',{name:'Redo',exact:true})).toBeEnabled();
});
test('responsive chrome and help remain usable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/editor.html?demo=1');await expect(page.getByTestId('editor-canvas')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole('button',{name:'Help',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Got it'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Export',exact:true})).toBeVisible();
  const evidenceDir=process.env.SCROLLOUT_QA_EVIDENCE_DIR??path.join(os.tmpdir(),'scrollout-evidence');await fs.mkdir(evidenceDir,{recursive:true});await page.screenshot({path:path.join(evidenceDir,'editor-mobile.png')});
  await page.setViewportSize({width:1600,height:1000});await page.reload();await page.getByRole('button',{name:'Draw',exact:true}).click();await drag(page,{x:680,y:300},{x:930,y:330});await page.screenshot({path:path.join(evidenceDir,'editor-desktop.png')});
});

test('initial fit uses the real workspace and fractional layout remains stable',async({page})=>{
  await page.setViewportSize({width:1536,height:864});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/editor.html?capture=stable-viewport');
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=12;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#17212b';ctx.fillRect(0,0,12,12);const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!)));
    const open=indexedDB.open('scrollout-temporary',1),db=await new Promise<IDBDatabase>(resolve=>{open.onsuccess=()=>resolve(open.result)}),tx=db.transaction(['sessions','tiles'],'readwrite');
    tx.objectStore('sessions').put({id:'stable-viewport',status:'ready',progress:100,sourceTabId:0,sourceWindowId:0,sourceTitle:'Synthetic panel',sourceHost:'example.com',createdAt:0,editorTabIds:[],document:{width:4000,height:1113,crop:{x:0,y:0,width:4000,height:1113},annotations:[],filename:'Synthetic panel',sourceHost:'example.com',createdAt:0}});
    tx.objectStore('tiles').put({id:'stable-viewport:0',captureId:'stable-viewport',sequence:0,x:0,y:0,width:4000,height:1113,sourceX:0,sourceY:0,sourceWidth:12,sourceHeight:12,blob});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve()});db.close();
  });
  await page.reload();await expect(page.getByTestId('editor-canvas')).toBeVisible();
  await expect.poll(async()=>{
    const width=await page.locator('.base-canvas').evaluate(e=>e.getBoundingClientRect().width);
    return {shown:await page.locator('.zoom-controls span').innerText(),expected:`${Math.round(Math.min(.5,Math.max(.1,(width-96)/4000))*100)}%`};
  }).toMatchObject({shown:'31%',expected:'31%'});
  await page.locator('.editor-main').evaluate(e=>{(e as HTMLElement).style.width='calc(100% - 0.25px)';(e as HTMLElement).style.height='calc(100% - 0.25px)'});
  await page.getByRole('button',{name:'Fit',exact:true}).click();
  const observations=await page.evaluate(async()=>{
    const viewport=document.querySelector('.viewport')!,canvas=document.querySelector('.base-canvas') as HTMLCanvasElement;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const frames=[];
    for(let i=0;i<40;i++){
      await new Promise(resolve=>requestAnimationFrame(resolve));
      frames.push({width:canvas.width,height:canvas.height,scrollX:viewport.scrollLeft,scrollY:viewport.scrollTop,pixel:[...canvas.getContext('2d')!.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data]});
    }
    return {frames,canvasWidth:canvas.getBoundingClientRect().width,spaceHeight:document.querySelector('.scroll-space')!.getBoundingClientRect().height,canvasHeight:canvas.getBoundingClientRect().height,availableWidth:viewport.getBoundingClientRect().width-((viewport as HTMLElement).offsetWidth-viewport.clientWidth)};
  });
  expect(observations.canvasWidth).toBeLessThanOrEqual(observations.availableWidth);
  expect(observations.spaceHeight).toBeGreaterThanOrEqual(observations.canvasHeight);
  expect(new Set(observations.frames.map(frame=>JSON.stringify(frame))).size).toBe(1);
  expect(errors).toEqual([]);
});
test('oversized images export complete ZIP parts and explain clipboard limits',async({page})=>{
  await page.goto('/editor.html?capture=oversized-fixture');
  await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=12;const ctx=canvas.getContext('2d')!;ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,12,12);const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!)));
    const open=indexedDB.open('scrollout-temporary',1);const db=await new Promise<IDBDatabase>(resolve=>{open.onsuccess=()=>resolve(open.result)}),tx=db.transaction(['sessions','tiles'],'readwrite');
    tx.objectStore('sessions').put({id:'oversized-fixture',status:'ready',progress:100,sourceTabId:0,sourceWindowId:0,sourceTitle:'Wide image',sourceHost:'example.com',createdAt:Date.now(),editorTabIds:[],document:{width:19000,height:500,crop:{x:0,y:0,width:19000,height:500},annotations:[{id:'secret',kind:'redact',x:17000,y:100,width:200,height:200,color:'#000000',opacity:1,strokeWidth:1,fontSize:32}],filename:'Wide image',sourceHost:'example.com',createdAt:Date.now()}});
    tx.objectStore('tiles').put({id:'large-tile',captureId:'oversized-fixture',sequence:0,x:0,y:0,width:19000,height:500,sourceX:0,sourceY:0,sourceWidth:12,sourceHeight:12,blob});await new Promise<void>(resolve=>{tx.oncomplete=()=>resolve()});db.close();
  });
  await page.reload();await expect(page.getByTestId('editor-canvas')).toBeVisible();await page.getByRole('button',{name:'Copy image',exact:true}).click();await expect(page.getByText(/too large for the clipboard/)).toBeVisible();
  await page.getByRole('button',{name:'Export',exact:true}).click();const wait=page.waitForEvent('download');await page.getByRole('menuitem',{name:'PNG image'}).click();const files=unzipSync(new Uint8Array(await fs.readFile((await (await wait).path())!)));const map=JSON.parse(new TextDecoder().decode(files['parts.json']));expect(map.parts).toHaveLength(2);expect(map.parts.map((p:any)=>p.width)).toEqual([16384,2616]);
  const image=await sharp(files['Wide image-002.png']).raw().toBuffer({resolveWithObject:true});const index=(200*image.info.width+716)*image.info.channels;expect([...image.data.subarray(index,index+3)]).toEqual([0,0,0]);
});
