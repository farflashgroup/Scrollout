import { zipSync, strToU8 } from 'fflate';
import { canSingleImage, exportParts } from '../shared/geometry';
import type { EditorDocument, Rect, ScreenshotTile } from '../shared/types';
import { renderRegion, TileCache } from './renderer';

export type ExportFormat='png'|'jpeg'|'pdf';
export function safeFilename(name:string) {return name.replace(/[<>:"/\\|?*\x00-\x1F]/g,'').trim().replace(/[. ]+$/,'').slice(0,120)||'Scrollout screenshot'}
function canvasBlob(canvas:HTMLCanvasElement,type:string,quality?:number):Promise<Blob> {
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('The browser could not allocate this image. Try a smaller crop or PDF export.')),type,quality));
}
export async function flatten(region:Rect,doc:EditorDocument,tiles:ScreenshotTile[],cache:TileCache,format:ExportFormat='png',scale=1):Promise<Blob> {
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(region.width*scale));canvas.height=Math.max(1,Math.ceil(region.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas rendering is unavailable.');
  await document.fonts.ready;await renderRegion(ctx,region,tiles,doc.annotations,cache,scale);
  const blob=await canvasBlob(canvas,format==='jpeg'?'image/jpeg':'image/png',.92);canvas.width=canvas.height=1;return blob;
}
export function download(blob:Blob,name:string) {
  const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export async function exportImage(doc:EditorDocument,tiles:ScreenshotTile[],format:ExportFormat,progress:(value:string)=>void) {
  const cache=new TileCache(),name=safeFilename(doc.filename);
  try {
    if(format==='pdf') {
      const { PDFDocument } = await import('pdf-lib');
      const pdf=await PDFDocument.create();const pageWidth=595.28,pageHeight=841.89,scale=Math.min(2*pageWidth/doc.crop.width,1),stripHeight=Math.max(1,Math.floor(pageHeight/pageWidth*doc.crop.width));
      const count=Math.ceil(doc.crop.height/stripHeight);
      for(let i=0;i<count;i++){progress(`Preparing PDF page ${i+1} of ${count}…`);const region={...doc.crop,y:doc.crop.y+i*stripHeight,height:Math.min(stripHeight,doc.crop.height-i*stripHeight)};const blob=await flatten(region,doc,tiles,cache,'png',scale),image=await pdf.embedPng(await blob.arrayBuffer()),page=pdf.addPage([pageWidth,pageHeight]),height=region.height/doc.crop.width*pageWidth;page.drawImage(image,{x:0,y:pageHeight-height,width:pageWidth,height})}
      pdf.setTitle(name);pdf.setCreator('Scrollout');const bytes=await pdf.save();download(new Blob([bytes as BlobPart],{type:'application/pdf'}),`${name}.pdf`);
    }else if(canSingleImage(doc.crop.width,doc.crop.height)){progress('Preparing image…');download(await flatten(doc.crop,doc,tiles,cache,format),`${name}.${format==='jpeg'?'jpg':'png'}`)}
  else {
      const parts=exportParts(doc.crop),files:Record<string,Uint8Array>={};
      for(let i=0;i<parts.length;i++){progress(`Preparing image part ${i+1} of ${parts.length}…`);files[`${name}-${String(i+1).padStart(3,'0')}.${format==='jpeg'?'jpg':'png'}`]=new Uint8Array(await (await flatten(parts[i],doc,tiles,cache,format)).arrayBuffer())}
      files['parts.json']=strToU8(JSON.stringify({width:doc.crop.width,height:doc.crop.height,parts:parts.map((r,i)=>({part:i+1,x:r.x-doc.crop.x,y:r.y-doc.crop.y,width:r.width,height:r.height}))},null,2));
      progress('Packing image parts…');download(new Blob([zipSync(files,{level:0}) as BlobPart],{type:'application/zip'}),`${name}-parts.zip`);
    }
  }finally{cache.clear()}
}
export async function copyImage(doc:EditorDocument,tiles:ScreenshotTile[]) {
  if(!canSingleImage(doc.crop.width,doc.crop.height))throw new Error('This screenshot is too large for the clipboard. Export PNG parts or a PDF instead.');
  const cache=new TileCache();try{const blob=await flatten(doc.crop,doc,tiles,cache);await navigator.clipboard.write([new ClipboardItem({'image/png':blob})])}finally{cache.clear()}
}
