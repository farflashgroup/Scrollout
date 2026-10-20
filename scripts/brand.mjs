import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { create } from 'fontkit';

const out = path.resolve('public/brand');
await fs.mkdir(out, { recursive: true });
// Faithful, flat vector refinement of the approved paper-strip S silhouette.
const shape = 'M84 12H28C17 12 12 20 12 31V39C12 46 16 51 24 54L74 73C71 76 68 78 63 78H18C14 78 12 80 12 84V96H72C83 96 88 88 88 77V69C88 62 84 57 76 54L26 35C29 32 32 30 37 30H78C82 30 84 28 84 24Z';
const mark = color => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-7 -7 114 122"><path fill="${color}" d="${shape}"/></svg>`;
for (const [name, color] of [['mark','#0B8F78'], ['mark-white','#FFFFFF'], ['mark-black','#17212B']]) {
  await fs.writeFile(path.join(out, `${name}.svg`), mark(color));
  await sharp(Buffer.from(mark(color))).resize(512,512,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(out,`${name}.png`));
}
for (const size of [16,32,48,128]) {
  await sharp(Buffer.from(mark('#0B8F78'))).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(out,`icon-${size}.png`));
  await sharp(Buffer.from(mark('#FFFFFF'))).resize(size,size,{fit:'contain',background:{r:0,g:0,b:0,alpha:0}}).png().toFile(path.join(out,`icon-dark-${size}.png`));
}
// Outline the actual Inter glyphs so standalone artwork needs no installed fonts.
const fontDir = path.resolve('node_modules/@fontsource-variable/inter/files');
const fonts = await fs.readdir(fontDir);
const font = await fs.readFile(path.join(fontDir,fonts.find(f=>f==='inter-latin-wght-normal.woff2')));
const bold=await fs.readFile('node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2');
const face=create(bold),run=face.layout('Scrollout'),scale=62/face.unitsPerEm;
let advance=0;
const wordmark=run.glyphs.map((glyph,i)=>{
  const position=run.positions[i],x=112+(advance+position.xOffset)*scale;
  const path=`<path transform="translate(${x.toFixed(3)} ${(76-position.yOffset*scale).toFixed(3)}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
  advance+=position.xAdvance-2.2/scale;return path;
}).join('');
for (const [name, ink, teal] of [['lockup','#17212B','#0B8F78'],['lockup-white','#FFFFFF','#FFFFFF'],['lockup-black','#17212B','#17212B']]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="122" viewBox="-7 -7 440 122"><path fill="${teal}" d="${shape}"/><g fill="${ink}">${wordmark}</g></svg>`;
  await fs.writeFile(path.join(out,`${name}.svg`),svg);
  await sharp(Buffer.from(svg)).resize(1320,366).png().toFile(path.join(out,`${name}.png`));
}
await fs.copyFile('node_modules/@fontsource-variable/inter/LICENSE','public/brand/Inter-LICENSE.txt');
console.log('Brand SVGs, PNGs, and toolbar icons generated.');
