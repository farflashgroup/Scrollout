import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const out=path.resolve('store/assets');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chromium',headless:true});
let page;
const errors=[];
async function open(){await page.goto('http://127.0.0.1:4173/editor.html?demo=1');await expect(page.getByTestId('editor-canvas')).toBeVisible();await page.evaluate(()=>document.fonts.ready);await expect(page.locator('.dimensions')).toHaveText('1,440 × 5,200 px');await page.waitForTimeout(250)}
async function position(x,y){const b=await page.locator('.viewport').boundingBox();const z=Number((await page.locator('.zoom-controls>span').textContent()).replace('%',''))/100;return{x:b.x+(b.width-1440*z)/2+x*z,y:b.y+16+y*z}}
async function drag(a,b){await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:16});await page.mouse.up()}
async function draw(name,x1,y1,x2,y2){await page.getByRole('button',{name,exact:true}).click();if(['Draw','Arrow'].includes(name))await page.getByLabel('Annotation color',{exact:true}).fill('#FF6359');await drag(await position(x1,y1),await position(x2,y2))}
let scale=1;
async function shot(name){const destination=scale===1?path.join(out,name):path.join('website/assets',name.replace('1280x800',scale===2?'2560x1600':'640x400'));await page.screenshot({path:destination,animations:'disabled'})}
try{
for(scale of [1,.5,2]){
 page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:scale});page.on('pageerror',e=>errors.push(e.message));
 await open();await shot('01-full-page-editor-1280x800.png');
 await draw('Highlight',400,464,1040,464);
 await draw('Draw',430,385,1000,385);
 await draw('Arrow',1190,620,1110,470);
 await page.getByRole('button',{name:'Text',exact:true}).click();const p=await position(235,640);await page.mouse.click(p.x,p.y);await page.getByLabel('Annotation text').fill('Keep the good ideas.');await page.getByLabel('Annotation text').press('Enter');
 await page.getByRole('button',{name:'Select',exact:true}).click();await shot('02-annotate-1280x800.png');
 await draw('Crop',85,230,1350,1110);await expect(page.getByRole('button',{name:'Apply crop'})).toBeVisible();await shot('03-crop-1280x800.png');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Export',exact:true}).click();await expect(page.getByRole('menu')).toBeVisible();await shot('05-export-1280x800.png');
 await open();await draw('Redact',420,275,680,375);await expect(page.getByText('Solid black · fully opaque')).toBeVisible();await shot('04-redact-1280x800.png');
 await page.close();
}
 if(errors.length)throw new Error(errors.join('\n'));
 for(const name of (await fs.readdir(out)).filter(n=>/^\d/.test(n)))await fs.copyFile(path.join(out,name),path.join('website/assets',name));
 console.log('Five 1280×800 store screenshots and five website previews at 640×400 / 2560×1600 captured from the real editor. No page errors.');
}finally{await browser.close()}
