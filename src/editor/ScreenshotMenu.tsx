import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clipboard } from 'lucide-react';
import type { Point } from '../shared/types';

export function ScreenshotMenu({point,onClose,onCopy}:{point:Point;onClose:(restoreFocus?:boolean)=>void;onCopy:()=>void}) {
  const ref=useRef<HTMLDivElement>(null),[position,setPosition]=useState(point);
  useLayoutEffect(()=>{
    const menu=ref.current!,bounds=menu.getBoundingClientRect();
    setPosition({x:Math.max(8,Math.min(point.x,innerWidth-bounds.width-8)),y:Math.max(8,Math.min(point.y,innerHeight-bounds.height-8))});
    menu.querySelector('button')?.focus({preventScroll:true});
  },[point]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))onClose()};
    const dismiss=()=>onClose();
    document.addEventListener('pointerdown',outside,true);document.addEventListener('scroll',dismiss,true);window.addEventListener('resize',dismiss);window.addEventListener('blur',dismiss);
    return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('scroll',dismiss,true);window.removeEventListener('resize',dismiss);window.removeEventListener('blur',dismiss)};
  },[onClose]);
  return createPortal(<div ref={ref} className="screenshot-menu" role="menu" aria-label="Screenshot actions" style={{left:position.x,top:position.y}} onKeyDown={event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();onClose(true)}
    else if(event.key==='Tab')onClose();
    else if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();ref.current?.querySelector('button')?.focus()}
  }}><button role="menuitem" onClick={()=>{onClose(true);onCopy()}}><Clipboard size={18}/><span>Copy image</span></button></div>,document.body);
}
