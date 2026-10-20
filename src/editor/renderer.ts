import { exportParts, intersect } from '../shared/geometry';
import type { Annotation, Rect, ScreenshotTile } from '../shared/types';

export class TileCache {
  private cache=new Map<string,ImageBitmap>();
  private pending=new Map<string,Promise<ImageBitmap>>();
  private bytes=0;
  private disposed=false;
  async load(tile:ScreenshotTile):Promise<ImageBitmap> {
    if(this.disposed)throw new Error('Rendering cancelled.');
    const found=this.cache.get(tile.id);if(found){this.cache.delete(tile.id);this.cache.set(tile.id,found);return found}
    let pending=this.pending.get(tile.id);
    if(!pending){pending=createImageBitmap(tile.blob).then(image=>{this.pending.delete(tile.id);if(this.disposed){image.close();throw new Error('Rendering cancelled.')}this.cache.set(tile.id,image);this.bytes+=image.width*image.height*4;while(this.cache.size>1&&(this.cache.size>12||this.bytes>96*1024*1024)){const key=this.cache.keys().next().value!;if(key!==tile.id){const old=this.cache.get(key)!;this.bytes-=old.width*old.height*4;old.close();this.cache.delete(key)}else break}return image});this.pending.set(tile.id,pending)}
    return pending;
  }
  clear(){this.disposed=true;this.cache.forEach(image=>image.close());this.cache.clear();this.bytes=0}
}
export function drawAnnotation(ctx:CanvasRenderingContext2D,a:Annotation) {
  ctx.save();ctx.globalAlpha=a.kind==='redact'?1:a.opacity;ctx.strokeStyle=a.color;ctx.fillStyle=a.kind==='redact'?'#000000':a.color;ctx.lineWidth=a.strokeWidth;ctx.lineCap='round';ctx.lineJoin='round';
  if(a.kind==='redact'){
    // Cover every touched output pixel, including fractional coordinates and
    // downscaled PDFs. Antialiased mask edges can retain the underlying secret.
    const transform=ctx.getTransform(),corners=[{x:a.x,y:a.y},{x:a.x+a.width,y:a.y},{x:a.x,y:a.y+a.height},{x:a.x+a.width,y:a.y+a.height}].map(p=>transform.transformPoint(p));
    const left=Math.floor(Math.min(...corners.map(p=>p.x))),top=Math.floor(Math.min(...corners.map(p=>p.y))),right=Math.ceil(Math.max(...corners.map(p=>p.x))),bottom=Math.ceil(Math.max(...corners.map(p=>p.y)));
    ctx.setTransform(1,0,0,1,0,0);ctx.fillRect(left,top,right-left,bottom-top);
  }
  else if(a.kind==='text'){ctx.font=`500 ${a.fontSize}px "Inter Variable", sans-serif`;ctx.textBaseline='top';(a.text??'').split('\n').forEach((line,i)=>ctx.fillText(line,a.x,a.y+i*a.fontSize*1.25))}
  else if(a.points?.length){
    if(a.kind==='highlight')ctx.lineCap='butt';
    ctx.beginPath();const first=a.points[0];ctx.moveTo(first.x,first.y);a.points.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
    if(a.points.length===1){ctx.lineTo(first.x+.01,first.y+.01)}ctx.stroke();
    if(a.kind==='arrow'&&a.points.length>1){const end=a.points.at(-1)!,before=a.points[0],angle=Math.atan2(end.y-before.y,end.x-before.x),size=Math.max(12,a.strokeWidth*4);ctx.beginPath();ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-size*Math.cos(angle-.45),end.y-size*Math.sin(angle-.45));ctx.moveTo(end.x,end.y);ctx.lineTo(end.x-size*Math.cos(angle+.45),end.y-size*Math.sin(angle+.45));ctx.stroke()}
  } else if(a.kind==='ellipse'){ctx.beginPath();ctx.ellipse(a.x+a.width/2,a.y+a.height/2,Math.max(.1,a.width/2),Math.max(.1,a.height/2),0,0,Math.PI*2);ctx.stroke()}
  else {ctx.strokeRect(a.x,a.y,a.width,a.height)}
  ctx.restore();
}
function drawRedactedTile(ctx:CanvasRenderingContext2D,bitmap:ImageBitmap,tile:ScreenshotTile,clip:Rect,redactions:Annotation[]) {
  const sx=tile.sourceWidth/tile.width,sy=tile.sourceHeight/tile.height;
  const source={x:Math.floor(tile.sourceX),y:Math.floor(tile.sourceY),width:Math.ceil(tile.sourceX+tile.sourceWidth)-Math.floor(tile.sourceX),height:Math.ceil(tile.sourceY+tile.sourceHeight)-Math.floor(tile.sourceY)};
  // Remove secrets at the original bitmap's pixel grid BEFORE any resampling.
  // Chrome 120's downsampling filter can otherwise blend covered pixels beyond
  // an output-space mask. Bound temporary canvases just like export canvases.
  const canvas=document.createElement('canvas');ctx.save();
  try{
    ctx.beginPath();ctx.rect(clip.x,clip.y,clip.width,clip.height);ctx.clip();
    for(const part of exportParts(source)){
      const destination={x:tile.x+(part.x-tile.sourceX)/sx,y:tile.y+(part.y-tile.sourceY)/sy,width:part.width/sx,height:part.height/sy};
      const visible=intersect(destination,clip);if(!visible.width||!visible.height)continue;
      canvas.width=part.width;canvas.height=part.height;
      const mask=canvas.getContext('2d');if(!mask)throw new Error('Redaction rendering is unavailable.');
      mask.drawImage(bitmap,part.x,part.y,part.width,part.height,0,0,part.width,part.height);
      mask.setTransform(sx,0,0,sy,tile.sourceX-tile.x*sx-part.x,tile.sourceY-tile.y*sy-part.y);
      redactions.forEach(a=>drawAnnotation(mask,a));
      ctx.drawImage(canvas,0,0,part.width,part.height,destination.x,destination.y,destination.width,destination.height);
    }
  }finally{ctx.restore();canvas.width=canvas.height=1}
}
export async function renderRegion(ctx:CanvasRenderingContext2D,region:Rect,tiles:ScreenshotTile[],annotations:Annotation[],cache:TileCache,scale=1,cancelled=()=>false) {
  ctx.save();try{
    ctx.scale(scale,scale);ctx.translate(-region.x,-region.y);ctx.fillStyle='#FFFFFF';ctx.fillRect(region.x,region.y,region.width,region.height);
    const redactions=annotations.filter(a=>a.kind==='redact');
    for(const tile of tiles){
      if(cancelled())return;const clip=intersect(tile,region);if(!clip.width||!clip.height)continue;const bitmap=await cache.load(tile);if(cancelled())return;
      const masks=redactions.filter(a=>{const overlap=intersect(a,tile);return overlap.width>0&&overlap.height>0});
      if(masks.length)drawRedactedTile(ctx,bitmap,tile,clip,masks);
      else{const sx=tile.sourceWidth/tile.width,sy=tile.sourceHeight/tile.height;ctx.drawImage(bitmap,tile.sourceX+(clip.x-tile.x)*sx,tile.sourceY+(clip.y-tile.y)*sy,clip.width*sx,clip.height*sy,clip.x,clip.y,clip.width,clip.height)}
    }
    annotations.forEach(a=>drawAnnotation(ctx,a));
  }finally{ctx.restore()}
}
