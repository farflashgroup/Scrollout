import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { bounds, clamp, hitTest, intersect, normalizeRect, resizeAnnotation, translate } from '../shared/geometry';
import type { Annotation, EditorDocument, Point, Rect, ScreenshotTile, Tool } from '../shared/types';
import { drawAnnotation, renderRegion, TileCache } from './renderer';

export interface PaintStyle {color:string;strokeWidth:number;opacity:number;fontSize:number}
interface Props {
  doc:EditorDocument;tiles:ScreenshotTile[];tool:Tool;style:PaintStyle;zoom:number;
  selected:string|null;onSelect:(id:string|null)=>void;onCommit:(doc:EditorDocument)=>void;
  crop:Rect|null;onCrop:(r:Rect|null)=>void;onFitZoom:(z:number)=>void;disabled:boolean;
}
interface Gesture {start:Point;original?:Annotation;mode:'new'|'move'|'resize';draft?:Annotation;crop?:Rect}
export function Viewer(props:Props) {
  const {doc,tiles,tool,style,zoom,selected,onSelect,onCommit,crop,onCrop,disabled}=props;
  const scrollRef=useRef<HTMLDivElement>(null),base=useRef<HTMLCanvasElement>(null),overlay=useRef<HTMLCanvasElement>(null),cache=useRef(new TileCache());
  const [viewport,setViewport]=useState({width:1000,height:650}),[scroll,setScroll]=useState({x:0,y:0}),[draft,setDraft]=useState<Annotation|null>(null);
  const [editing,setEditing]=useState<{x:number;y:number;text:string;original?:Annotation}|null>(null);
  const gesture=useRef<Gesture|null>(null),drawVersion=useRef(0),lastZoom=useRef(zoom),didFit=useRef(false);
  const padding=16,spaceWidth=Math.max(viewport.width,doc.crop.width*zoom+96),paperLeft=(spaceWidth-doc.crop.width*zoom)/2;
  const region:Rect={x:doc.crop.x+(scroll.x-paperLeft)/zoom,y:doc.crop.y+(scroll.y-padding)/zoom,width:viewport.width/zoom,height:viewport.height/zoom};
  const paper={x:paperLeft-scroll.x,y:padding-scroll.y,width:doc.crop.width*zoom,height:doc.crop.height*zoom};
  useEffect(()=>{const element=scrollRef.current!;const observer=new ResizeObserver(()=>setViewport({width:element.clientWidth,height:element.clientHeight}));observer.observe(element);return()=>observer.disconnect()},[]);
  useEffect(()=>{if(viewport.width>100&&!didFit.current){didFit.current=true;props.onFitZoom(clamp((viewport.width-96)/doc.crop.width,.1,.5))}},[viewport.width,doc.crop.width,props.onFitZoom]);
  useEffect(()=>{if(zoom!==lastZoom.current){const ratio=zoom/lastZoom.current,last=scrollRef.current!;last.scrollTop=Math.max(0,(last.scrollTop+last.clientHeight/2-padding)*ratio-last.clientHeight/2+padding);last.scrollLeft=Math.max(0,(last.scrollLeft+last.clientWidth/2)*ratio-last.clientWidth/2);lastZoom.current=zoom}},[zoom]);
  useEffect(()=>()=>{drawVersion.current++;cache.current.clear()},[]);
  useEffect(()=>{const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'){gesture.current=null;setDraft(null);setEditing(null);onCrop(null)}};document.addEventListener('keydown',cancel);return()=>document.removeEventListener('keydown',cancel)},[onCrop]);
  useEffect(()=>{
    const version=++drawVersion.current,ratio=devicePixelRatio||1;
    const frame=document.createElement('canvas');frame.width=Math.ceil(viewport.width*ratio);frame.height=Math.ceil(viewport.height*ratio);const ctx=frame.getContext('2d')!;
    ctx.scale(ratio,ratio);ctx.fillStyle='#EDF2F5';ctx.fillRect(0,0,viewport.width,viewport.height);
    ctx.save();ctx.shadowColor='rgba(23,33,43,.08)';ctx.shadowBlur=12;ctx.shadowOffsetY=2;ctx.fillStyle='#fff';ctx.fillRect(paper.x,paper.y,paper.width,paper.height);ctx.restore();
    ctx.save();ctx.beginPath();ctx.rect(paper.x,paper.y,paper.width,paper.height);ctx.clip();
    void renderRegion(ctx,region,tiles,[],cache.current,zoom,()=>version!==drawVersion.current).then(()=>{
      ctx.restore();if(version!==drawVersion.current||!base.current)return;const canvas=base.current;canvas.width=frame.width;canvas.height=frame.height;canvas.getContext('2d')!.drawImage(frame,0,0);frame.width=frame.height=1;
    }).catch(error=>{if(version===drawVersion.current)console.error('Screenshot rendering:',error)});
  },[tiles,zoom,doc.crop.x,doc.crop.y,doc.crop.width,doc.crop.height,viewport.width,viewport.height,scroll.x,scroll.y]);
  useEffect(()=>{
    const canvas=overlay.current;if(!canvas)return;const ratio=devicePixelRatio||1;canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);const ctx=canvas.getContext('2d')!;
    ctx.scale(ratio,ratio);ctx.beginPath();ctx.rect(paper.x,paper.y,paper.width,paper.height);ctx.clip();ctx.scale(zoom,zoom);ctx.translate(-region.x,-region.y);
    const annotations=draft?[...doc.annotations.filter(a=>a.id!==draft.id),draft]:doc.annotations;
    annotations.forEach(a=>{if(a.id!==editing?.original?.id)drawAnnotation(ctx,a)});
    if(crop){ctx.fillStyle='rgba(23,33,43,.45)';const r=doc.crop;ctx.fillRect(r.x,r.y,r.width,crop.y-r.y);ctx.fillRect(r.x,crop.y+crop.height,r.width,r.y+r.height-crop.y-crop.height);ctx.fillRect(r.x,crop.y,crop.x-r.x,crop.height);ctx.fillRect(crop.x+crop.width,crop.y,r.x+r.width-crop.x-crop.width,crop.height);ctx.strokeStyle='#fff';ctx.lineWidth=1.5/zoom;ctx.setLineDash([6/zoom,4/zoom]);ctx.strokeRect(crop.x,crop.y,crop.width,crop.height)}
    const active=annotations.find(a=>a.id===selected);if(active&&tool==='select'&&!editing){const r=bounds(active);ctx.strokeStyle='#0B8F78';ctx.lineWidth=1.5/zoom;ctx.setLineDash([5/zoom,3/zoom]);ctx.strokeRect(r.x-3/zoom,r.y-3/zoom,r.width+6/zoom,r.height+6/zoom);ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.fillRect(r.x+r.width-4/zoom,r.y+r.height-4/zoom,8/zoom,8/zoom);ctx.strokeRect(r.x+r.width-4/zoom,r.y+r.height-4/zoom,8/zoom,8/zoom)}
  },[doc.annotations,draft,crop,selected,tool,zoom,viewport.width,viewport.height,scroll.x,scroll.y,editing]);
  useEffect(()=>{gesture.current=null;setDraft(null);if(tool!=='text')setEditing(null)},[tool]);
  function point(event:{clientX:number;clientY:number}):Point {
    const rect=scrollRef.current!.getBoundingClientRect();return {x:clamp(region.x+(event.clientX-rect.left)/zoom,doc.crop.x,doc.crop.x+doc.crop.width),y:clamp(region.y+(event.clientY-rect.top)/zoom,doc.crop.y,doc.crop.y+doc.crop.height)};
  }
  function finishText() {
    if(!editing)return;const text=editing.text.trim();if(text){const paint=editing.original??style;const context=document.createElement('canvas').getContext('2d')!;context.font=`500 ${paint.fontSize}px "Inter Variable",sans-serif`;const lines=text.split('\n'),width=Math.max(...lines.map(line=>context.measureText(line).width),1);const annotation:Annotation={...paint,id:editing.original?.id??crypto.randomUUID(),kind:'text',x:editing.x,y:editing.y,width,height:lines.length*paint.fontSize*1.25,text};onCommit({...doc,annotations:[...doc.annotations.filter(a=>a.id!==annotation.id),annotation]});onSelect(annotation.id)}setEditing(null);
  }
  function down(event:ReactPointerEvent<HTMLCanvasElement>) {
    if(disabled||event.button!==0||editing)return;const screen=scrollRef.current!.getBoundingClientRect(),sx=event.clientX-screen.left,sy=event.clientY-screen.top;
    if(sx<paper.x||sx>paper.x+paper.width||sy<paper.y||sy>paper.y+paper.height){onSelect(null);return}
    const p=point(event);event.currentTarget.setPointerCapture(event.pointerId);
    // Create the focused textarea on pointer-up, after the browser's pointer-down
    // focus action. Otherwise the same click immediately blurs the new input.
    if(tool==='text'){gesture.current={start:p,mode:'new'};return}
    if(tool==='select'){
      const old=doc.annotations.find(a=>a.id===selected),r=old?bounds(old):null;
      if(old&&r&&Math.hypot(p.x-r.x-r.width,p.y-r.y-r.height)<=12/zoom){gesture.current={start:p,original:old,mode:'resize'};return}
      const hit=[...doc.annotations].reverse().find(a=>hitTest(a,p,7/zoom));onSelect(hit?.id??null);if(hit)gesture.current={start:p,original:hit,mode:'move'};return;
    }
    if(tool==='crop'){onCrop(null);gesture.current={start:p,mode:'new'};return}
    const a:Annotation={...style,id:crypto.randomUUID(),kind:tool,x:p.x,y:p.y,width:0,height:0};
    if(['draw','highlight','arrow'].includes(tool))a.points=[p];
    if(tool==='redact'){a.color='#000000';a.opacity=1}
    gesture.current={start:p,mode:'new',draft:a};setDraft(a);
  }
  function move(event:ReactPointerEvent<HTMLCanvasElement>) {
    const g=gesture.current;if(!g)return;const p=point(event);
    if(tool==='crop'){const next=intersect(normalizeRect(g.start,p),doc.crop);g.crop=next;onCrop(next);return}
    if(g.mode==='move')g.draft=translate(g.original!,p.x-g.start.x,p.y-g.start.y);
    else if(g.mode==='resize'){const r=bounds(g.original!);g.draft=resizeAnnotation(g.original!,{x:r.x,y:r.y,width:Math.max(2,p.x-r.x),height:Math.max(2,p.y-r.y)})}
    else if(g.draft){
      if(g.draft.kind==='arrow')g.draft={...g.draft,points:[g.start,p],...normalizeRect(g.start,p)};
      else if(g.draft.points){const points=g.draft.points;const last=points.at(-1)!;if(Math.hypot(last.x-p.x,last.y-p.y)>.7)g.draft={...g.draft,points:[...points,p],...normalizeRect(g.start,p)}}
      else g.draft={...g.draft,...normalizeRect(g.start,p)};
    }
    setDraft(g.draft??null);
  }
  function up(event:ReactPointerEvent<HTMLCanvasElement>) {
    const g=gesture.current;if(!g)return;
    if(tool==='text'){gesture.current=null;setEditing({x:g.start.x,y:g.start.y,text:''});return}
    move(event);
    if(g.draft){const a=g.draft,r=bounds(a);if(a.kind==='draw'||a.kind==='highlight'||r.width>=1||r.height>=1){onCommit({...doc,annotations:[...doc.annotations.filter(old=>old.id!==a.id),a]});onSelect(a.id)}}
    gesture.current=null;setDraft(null);
  }
  function doubleClick(event:React.MouseEvent<HTMLCanvasElement>) {
    if(tool!=='select'||disabled)return;const p=point(event),hit=[...doc.annotations].reverse().find(a=>a.kind==='text'&&hitTest(a,p,5/zoom));if(hit)setEditing({x:hit.x,y:hit.y,text:hit.text??'',original:hit});
  }
  return <div className="viewport" ref={scrollRef} onScroll={event=>setScroll({x:event.currentTarget.scrollLeft,y:event.currentTarget.scrollTop})} aria-label="Screenshot workspace">
    <div className="scroll-space" style={{width:spaceWidth,height:doc.crop.height*zoom+padding*2}}>
      <div className="canvas-stack" style={{width:viewport.width,height:viewport.height}}>
        <canvas ref={base} className="base-canvas" style={{width:viewport.width,height:viewport.height}}/>
        <canvas ref={overlay} data-testid="editor-canvas" className={`paint-canvas cursor-${tool}`} style={{width:viewport.width,height:viewport.height}} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{gesture.current=null;setDraft(null)}} onDoubleClick={doubleClick} role="img" aria-label={`Screenshot of ${doc.sourceHost||doc.filename}. Active tool: ${tool}.`}/>
        {editing&&<textarea autoFocus aria-label="Annotation text" className="text-editor" value={editing.text} style={{left:(editing.x-region.x)*zoom,top:(editing.y-region.y)*zoom,color:editing.original?.color??style.color,fontSize:(editing.original?.fontSize??style.fontSize)*zoom,width:Math.max(160,Math.min(500,paper.width)),minHeight:50}} onChange={event=>setEditing({...editing,text:event.target.value})} onBlur={finishText} onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape')setEditing(null);if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();finishText()}}}/>} 
      </div>
    </div>
  </div>;
}
