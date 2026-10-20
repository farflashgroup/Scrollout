import type { Annotation, PageMetrics, Point, Rect } from './types';
export const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export function captureScale(width:number,height:number,metrics:Pick<PageMetrics,'viewportWidth'|'viewportHeight'|'pixelRatio'>) {
  const ratio=metrics.pixelRatio,tolerance=Math.max(1,(ratio??1)/2)+.000001;
  // innerWidth/innerHeight are rounded CSS pixels. Prefer a matching native
  // scale within that rounding margin, avoiding accumulated stretch at zoom.
  // CDP/emulated displays can disagree with captureVisibleTab; retain its scale.
  if(ratio&&Math.abs(width-metrics.viewportWidth*ratio)<=tolerance&&Math.abs(height-metrics.viewportHeight*ratio)<=tolerance)return {x:ratio,y:ratio};
  return {x:width/metrics.viewportWidth,y:height/metrics.viewportHeight};
}
export function scrollPositions(length:number,viewport:number):number[] {
  if(viewport<=0||length<=0)throw new Error('Invalid page dimensions.');
  const max=Math.max(0,length-viewport);const points=[0];
  for(let p=viewport;p<max;p+=viewport)points.push(p);
  if(max>0&&points.at(-1)!==max)points.push(max);return points;
}
export function normalizeRect(a:Point,b:Point):Rect {
  return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};
}
export function intersect(a:Rect,b:Rect):Rect {
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);
  return {x,y,width:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-x),height:Math.max(0,Math.min(a.y+a.height,b.y+b.height)-y)};
}
export function bounds(a:Annotation):Rect {
  if(a.points?.length){let x=Infinity,y=Infinity,right=-Infinity,bottom=-Infinity;for(const p of a.points){x=Math.min(x,p.x);y=Math.min(y,p.y);right=Math.max(right,p.x);bottom=Math.max(bottom,p.y)}return {x,y,width:right-x,height:bottom-y}}
  return a;
}
export function translate(a:Annotation,dx:number,dy:number):Annotation {
  return {...a,x:a.x+dx,y:a.y+dy,points:a.points?.map(p=>({x:p.x+dx,y:p.y+dy}))};
}
export function resizeAnnotation(a:Annotation,newBounds:Rect):Annotation {
  const old=bounds(a),sx=newBounds.width/Math.max(1,old.width),sy=newBounds.height/Math.max(1,old.height);
  return {...a,...newBounds,fontSize:a.kind==='text'?Math.max(8,a.fontSize*sy):a.fontSize,points:a.points?.map(p=>({x:newBounds.x+(p.x-old.x)*sx,y:newBounds.y+(p.y-old.y)*sy}))};
}
function segmentDistance(p:Point,a:Point,b:Point) {
  const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
  return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);
}
export function hitTest(a:Annotation,p:Point,tolerance:number):boolean {
  const r=bounds(a),pad=tolerance+a.strokeWidth/2;
  if(p.x<r.x-pad||p.x>r.x+r.width+pad||p.y<r.y-pad||p.y>r.y+r.height+pad)return false;
  if(a.points){if(a.points.length===1)return Math.hypot(p.x-a.points[0].x,p.y-a.points[0].y)<=pad;return a.points.slice(1).some((q,i)=>segmentDistance(p,a.points![i],q)<=pad)}
  if(a.kind==='ellipse') {const nx=(p.x-r.x-r.width/2)/(r.width/2||1),ny=(p.y-r.y-r.height/2)/(r.height/2||1);return Math.abs(Math.sqrt(nx*nx+ny*ny)-1)*Math.min(r.width,r.height)/2<=pad}
  if(a.kind==='rect')return Math.min(Math.abs(p.x-r.x),Math.abs(p.x-r.x-r.width),Math.abs(p.y-r.y),Math.abs(p.y-r.y-r.height))<=pad;
  return true;
}
export const MAX_EDGE=16384;
export const MAX_PIXELS=32_000_000;
export const canSingleImage=(width:number,height:number)=>width>0&&height>0&&width<=MAX_EDGE&&height<=MAX_EDGE&&width*height<=MAX_PIXELS;
export function exportParts(rect:Rect):Rect[] {
  const width=Math.min(MAX_EDGE,rect.width),height=Math.min(MAX_EDGE,Math.floor(MAX_PIXELS/width));const parts:Rect[]=[];
  for(let y=0;y<rect.height;y+=height)for(let x=0;x<rect.width;x+=width)parts.push({x:rect.x+x,y:rect.y+y,width:Math.min(width,rect.width-x),height:Math.min(height,rect.height-y)});return parts;
}
