import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, Circle, Clipboard, Crop, Download, HelpCircle, Highlighter, LoaderCircle, Minus, MousePointer2, Pencil, Plus, Redo2, ShieldCheck, Square, Trash2, Type, Undo2, X } from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import { getSession, getTiles, updateSession } from '../shared/db';
import { clamp, intersect } from '../shared/geometry';
import { isExtension } from '../shared/types';
import type { Annotation, CaptureSession, EditorDocument, Rect, ScreenshotTile, Tool } from '../shared/types';
import { copyImage, exportImage } from './export';
import type { ExportFormat } from './export';
import { useDocument } from './useDocument';
import { Viewer } from './Viewer';
import type { PaintStyle } from './Viewer';
import { UpdateNotice, UpdatesPanel } from './Updates';

const swatches=['#17212B','#287DFF','#10A943','#FFC83D','#995BFF'];
const RedactIcon=forwardRef<SVGSVGElement,LucideProps>(({size=24,...props},ref)=><svg ref={ref} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}><path d="M3 4h18v10H3z" fill="currentColor"/><path d="M3 17h18M3 20h18" stroke="currentColor" strokeWidth="1.5"/></svg>);
const ShapesIcon=forwardRef<SVGSVGElement,LucideProps>(({size=24,strokeWidth=1.8,...props},ref)=><svg ref={ref} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" aria-hidden="true" {...props}><path d="M10 18H3V3h15v7"/><circle cx="16" cy="16" r="6"/></svg>);
const tools:{id:Tool;label:string;icon:LucideIcon;shortcut:string}[]=[{id:'select',label:'Select',icon:MousePointer2,shortcut:'V'},{id:'crop',label:'Crop',icon:Crop,shortcut:'C'},{id:'draw',label:'Draw',icon:Pencil,shortcut:'D'},{id:'highlight',label:'Highlight',icon:Highlighter,shortcut:'H'},{id:'arrow',label:'Arrow',icon:ArrowUpRight,shortcut:'A'},{id:'rect',label:'Shapes',icon:ShapesIcon,shortcut:'S'},{id:'text',label:'Text',icon:Type,shortcut:'T'},{id:'redact',label:'Redact',icon:RedactIcon,shortcut:'R'}];
function Brand(){return <div className="brand"><img src="./brand/mark.svg" alt=""/><span>Scrollout</span></div>}
function Help({close}:{close:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>dialog.close()},[]);
  return <dialog ref={ref} className="help-dialog" onCancel={close} onClick={event=>{if(event.target===event.currentTarget)close()}}>
    <button className="icon-button dialog-close" aria-label="Close help" onClick={close}><X size={20}/></button><Brand/>
    <h2>Capture the whole page.<br/>Make it yours.</h2>
    <p>Click the Scrollout icon on a website. Keep the page active while it scrolls, then edit the screenshot here. Click the icon again or press Esc on the source page to cancel.</p>
    <div className="help-columns"><div><h3>Make an edit</h3><p>Choose a tool and drag on the screenshot. Select an annotation to move it; drag its bottom-right handle to resize. Double-click text to edit it.</p><p>For crop, drag an area and choose Apply crop. Every edit can be undone.</p></div><div><h3>Keyboard shortcuts</h3><p><kbd>V</kbd> Select · <kbd>C</kbd> Crop · <kbd>D</kbd> Draw<br/><kbd>H</kbd> Highlight · <kbd>A</kbd> Arrow · <kbd>S</kbd> Shapes<br/><kbd>T</kbd> Text · <kbd>R</kbd> Redact</p><p><kbd>Ctrl / ⌘ Z</kbd> Undo<br/><kbd>Ctrl / ⌘ Shift Z</kbd> Redo<br/><kbd>Delete</kbd> Remove selection · <kbd>Esc</kbd> Cancel</p></div></div>
    <p className="privacy-note"><ShieldCheck size={20}/> Everything stays on your device. Closing or leaving the last editor for this capture deletes its temporary screenshot and edits. Download anything you want to keep.</p>
    <p className="help-limit">Scrollout captures the initial page length. Independently scrolling panels and frames retain their visible contents. Very large PNG/JPEG exports arrive as numbered parts in a ZIP; PDFs use A4 pages.</p>
    <UpdatesPanel/>
    <button className="primary-button" onClick={close}>Got it</button>
  </dialog>;
}
function Empty({session}:{session:CaptureSession|null}) {
  return <div className="empty-state"><img src="./brand/mark.svg" alt=""/>{session?.status==='capturing'?<><LoaderCircle className="spin" size={26}/><h1>Capturing your page…</h1><p>Keep the source page active. Your editor will open when the screenshot is ready.</p><progress max={100} value={session.progress}/><span>{session.progress}%</span></>:session?.status==='error'?<><h1>We couldn’t finish this capture</h1><p>{session.message}</p><p>Click Scrollout on the source page to try again.</p></>:<><h1>Capture your first page</h1><p>Open a website and click the Scrollout extension icon.<br/>Your full-page screenshot will open here, ready to edit.</p><span className="empty-privacy"><ShieldCheck size={18}/> Free tools. Screenshots stay on your device.</span></>}</div>;
}
export function App() {
  const id=new URLSearchParams(location.search).get('capture');
  const [session,setSession]=useState<CaptureSession|null>(null),[tiles,setTiles]=useState<ScreenshotTile[]>([]),[help,setHelp]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    let live=true,loaded=false,initialized=false;
    async function load(){
      if(!id||!initialized)return;try{const found=await getSession(id);if(!live)return;if(!found){setError('This temporary capture has expired. Click Scrollout on a website to take a new screenshot.');return}setSession(found);if(found.status==='ready'&&!loaded){const images=await getTiles(id);if(live){loaded=true;setTiles(images)}}}catch(e){if(live)setError(e instanceof Error?e.message:'Could not open the screenshot.')}
    }
    if(import.meta.env.DEV&&!isExtension()&&new URLSearchParams(location.search).has('demo')){void import('./demo').then(m=>m.demo()).then(data=>{if(live){setSession(data.session);setTiles(data.tiles)}})}
    else {void (async()=>{
      try{
        // Let the worker clear expired sessions before reading any image data.
        if(id&&isExtension()){
          const response=await chrome.runtime.sendMessage({type:'OWN',id});
          if(!response?.ok)throw new Error(response?.error||'Could not open the temporary session.');
        }
        initialized=true;await load();
      }catch(e){if(live)setError(e instanceof Error?e.message:'Could not open the temporary session.')}
    })()}
    const timer=id?setInterval(()=>{if(!loaded)void load()},500):undefined;
    return()=>{live=false;if(timer)clearInterval(timer)};
  },[id]);
  if(session?.status==='ready'&&session.document&&tiles.length)return <Editor initial={session.document} tiles={tiles} captureId={session.id}/>;
  return <div className="app-shell"><header className="app-header"><Brand/><button className="secondary-button" onClick={()=>setHelp(true)}><HelpCircle size={18}/>Help</button></header><main className="waiting-workspace">{error?<div className="empty-state"><h1>This capture is no longer available</h1><p>{error}</p></div>:<Empty session={session}/>}</main><footer className="status-bar"><span>Scrollout</span><span>Screenshots stay on your device</span><span>Every tool is free</span></footer><UpdateNotice openHelp={()=>setHelp(true)}/>{help&&<Help close={()=>setHelp(false)}/>}</div>;
}
function Editor({initial,tiles,captureId}:{initial:EditorDocument;tiles:ScreenshotTile[];captureId:string}) {
  const {doc,commit,undo,redo,canUndo,canRedo}=useDocument(initial);
  const [tool,setTool]=useState<Tool>('select'),[style,setStyle]=useState<PaintStyle>({color:'#FF6359',strokeWidth:4,opacity:1,fontSize:32}),[selected,setSelected]=useState<string|null>(null),[crop,setCrop]=useState<Rect|null>(null),[zoom,setZoom]=useState(.5),[help,setHelp]=useState(false),[menu,setMenu]=useState(false),[busy,setBusy]=useState(false),[toast,setToast]=useState<{text:string;error:boolean}|null>(null),[progress,setProgress]=useState('');
  const editorRef=useRef<HTMLDivElement>(null),exportRef=useRef<HTMLDivElement>(null);
  const active=tool==='select'?doc.annotations.find(a=>a.id===selected):undefined,paint=active??style,redact=tool==='redact'||active?.kind==='redact';
  const changeTool=useCallback((next:Tool)=>{setTool(next);setCrop(null);setSelected(null);if(next==='highlight')setStyle(old=>({...old,color:'#FFC83D',strokeWidth:24,opacity:.35}));else if(next==='draw'||next==='arrow'||next==='rect'||next==='ellipse')setStyle(old=>({...old,strokeWidth:4,opacity:1}))},[]);
  const removeSelected=useCallback(()=>{if(selected){commit({...doc,annotations:doc.annotations.filter(a=>a.id!==selected)});setSelected(null)}},[doc,selected,commit]);
  const applyCrop=useCallback(()=>{if(crop&&crop.width>=1&&crop.height>=1){const rounded=intersect({x:Math.round(crop.x),y:Math.round(crop.y),width:Math.max(1,Math.round(crop.width)),height:Math.max(1,Math.round(crop.height))},doc.crop);commit({...doc,crop:rounded});setCrop(null);setTool('select');setSelected(null)}},[crop,doc,commit]);
  useEffect(()=>{if(!isExtension())return;const timer=setTimeout(()=>{void updateSession(captureId,s=>({...s,document:doc})).catch(()=>setToast({text:'Could not save this temporary session. Export your screenshot before reloading.',error:true}))},250);return()=>clearTimeout(timer)},[doc,captureId]);
  useEffect(()=>{document.title=`${doc.filename} — Scrollout`},[doc.filename]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),toast.error?9000:3500);return()=>clearTimeout(timer)},[toast]);
  useEffect(()=>{if(!menu)return;const handler=(event:MouseEvent)=>{if(!exportRef.current?.contains(event.target as Node))setMenu(false)};document.addEventListener('mousedown',handler);return()=>document.removeEventListener('mousedown',handler)},[menu]);
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(['INPUT','TEXTAREA','SELECT'].includes((event.target as HTMLElement)?.tagName)||help||busy)return;
      const key=event.key.toLowerCase();if((event.ctrlKey||event.metaKey)&&key==='z'){event.preventDefault();if(event.shiftKey)redo();else undo();setSelected(null);setCrop(null);return}
      if((event.ctrlKey||event.metaKey)&&key==='y'){event.preventDefault();redo();return}
      if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();removeSelected();return}
      if(event.key==='Escape'){setCrop(null);setSelected(null);setMenu(false);if(tool==='crop')changeTool('select');return}
      if(event.key==='Enter'&&crop){applyCrop();return}
      if(!event.ctrlKey&&!event.metaKey&&!event.altKey){const next=tools.find(t=>t.shortcut.toLowerCase()===key);if(next)changeTool(next.id)}
    };document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);
  },[help,busy,undo,redo,removeSelected,crop,applyCrop,changeTool,tool]);
  function updatePaint(patch:Partial<PaintStyle>){if(active)commit({...doc,annotations:doc.annotations.map(a=>a.id===active.id?{...a,...patch}:a)});else setStyle(old=>({...old,...patch}))}
  async function doExport(format:ExportFormat) {
    setMenu(false);setBusy(true);try{await exportImage(doc,tiles,format,setProgress);setToast({text:'Your screenshot is ready to download.',error:false})}catch(e){setToast({text:e instanceof Error?e.message:'Export failed. Please try again.',error:true})}finally{setBusy(false);setProgress('')}
  }
  async function doCopy(){setBusy(true);setProgress('Copying image…');try{await copyImage(doc,tiles);setToast({text:'Image copied to your clipboard.',error:false})}catch(e){setToast({text:e instanceof Error?e.message:'Clipboard access was denied. Use Export instead.',error:true})}finally{setBusy(false);setProgress('')}}
  function fit(){const element=editorRef.current?.querySelector('.viewport') as HTMLElement;if(element)setZoom(clamp((element.clientWidth-96)/doc.crop.width,.1,1))}
  return <div className="app-shell" ref={editorRef}>
    <header className="app-header"><Brand/><div className="document-title"><input aria-label="Screenshot filename" value={doc.filename} maxLength={120} onChange={event=>commit({...doc,filename:event.target.value})}/><span>{doc.sourceHost?`Captured from ${doc.sourceHost}`:'Local screenshot'}</span></div><div className="header-actions"><button className="history-button" aria-label="Undo" title="Undo (Ctrl/⌘ Z)" disabled={!canUndo||busy} onClick={()=>{undo();setSelected(null);setCrop(null)}}><Undo2/><span>Undo</span></button><button className="history-button" aria-label="Redo" title="Redo (Ctrl/⌘ Shift Z)" disabled={!canRedo||busy} onClick={()=>{redo();setSelected(null);setCrop(null)}}><Redo2/><span>Redo</span></button><button className="secondary-button copy-button" aria-label="Copy image" disabled={busy} onClick={()=>void doCopy()}><Clipboard size={18}/><span>Copy image</span></button><div className="export-container" ref={exportRef}><button className="primary-button export-button" disabled={busy} aria-haspopup="menu" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{busy?<LoaderCircle className="spin" size={18}/>:null}Export<ChevronDown size={18}/></button>{menu&&<div className="export-menu" role="menu">{(['png','jpeg','pdf'] as ExportFormat[]).map(format=><button role="menuitem" key={format} onClick={()=>void doExport(format)}><Download size={18}/><span>{format==='png'?'PNG image':format==='jpeg'?'JPEG image':'PDF document'}<small>{format==='png'?'Full quality · transparent-safe':format==='jpeg'?'Smaller file · 92% quality':'Paginated A4 pages'}</small></span></button>)}<p>All formats. Always free.</p></div>}</div></div></header>
    <div className="editor-layout"><aside className="tool-rail"><h2>Tools</h2><nav aria-label="Editing tools">{tools.map(({id,label,icon:Icon,shortcut})=>{const current=id==='rect'?(tool==='rect'||tool==='ellipse'):tool===id;return <button key={id} className={`tool-button ${current?'active':''}`} aria-label={label} aria-pressed={current} disabled={busy} title={`${label} (${shortcut})`} onClick={()=>changeTool(id)}><Icon size={24} strokeWidth={1.8}/><span>{label}</span></button>})}</nav><button className="help-button" aria-label="Help" onClick={()=>setHelp(true)}><HelpCircle size={22}/><span>Help</span></button></aside>
    <main className="editor-main"><div className="context-bar" aria-label="Tool properties">
      {tool==='crop'?<><span className="context-hint">Drag to select an area</span><button className="primary-button small" disabled={!crop||crop.width<1||crop.height<1} onClick={applyCrop}><Check size={16}/>Apply crop</button><button className="secondary-button small" onClick={()=>{setCrop(null);changeTool('select')}}>Cancel</button></>:<>
        <div className={`color-controls ${redact?'muted':''}`}><label className="color-picker" title="Choose annotation color"><input type="color" aria-label="Annotation color" value={redact?'#000000':paint.color} disabled={redact||busy} onChange={event=>updatePaint({color:event.target.value})}/></label><div className="swatches">{swatches.map(color=><button key={color} aria-label={`Use color ${color}`} aria-pressed={paint.color===color} className={`swatch ${paint.color===color?'chosen':''}`} style={{background:color}} disabled={redact||busy} onClick={()=>updatePaint({color})}/>)}</div></div>
        <div className="property-group"><label htmlFor="stroke-width">{tool==='text'||active?.kind==='text'?'Size':'Width'}</label><div className="number-control"><input id="stroke-width" aria-label={tool==='text'||active?.kind==='text'?'Text size':'Stroke width'} type="number" min={tool==='text'?8:1} max={240} value={tool==='text'||active?.kind==='text'?paint.fontSize:paint.strokeWidth} disabled={redact||busy} onChange={event=>{const value=clamp(Number(event.target.value),1,240);updatePaint(tool==='text'||active?.kind==='text'?{fontSize:value}:{strokeWidth:value})}}/><span>px</span></div></div>
        <div className="property-group"><label htmlFor="opacity">Opacity</label><select id="opacity" aria-label="Annotation opacity" disabled={redact||busy} value={redact?100:Math.round(paint.opacity*100)} onChange={event=>updatePaint({opacity:Number(event.target.value)/100})}>{Array.from(new Set([10,25,35,50,75,100,Math.round(paint.opacity*100)])).sort((a,b)=>a-b).map(value=><option key={value} value={value}>{value}%</option>)}</select></div>
        {(tool==='rect'||tool==='ellipse')&&<div className="shape-options"><button className={`icon-button ${tool==='rect'?'selected':''}`} aria-label="Rectangle" aria-pressed={tool==='rect'} onClick={()=>setTool('rect')}><Square size={20}/></button><button className={`icon-button ${tool==='ellipse'?'selected':''}`} aria-label="Ellipse" aria-pressed={tool==='ellipse'} onClick={()=>setTool('ellipse')}><Circle size={20}/></button></div>}
        {active&&<button className="icon-button delete-button" title="Delete selection" aria-label="Delete selection" onClick={removeSelected}><Trash2 size={18}/></button>}
        {redact&&<span className="redact-hint">Solid black · fully opaque</span>}
      </>}
    </div><Viewer doc={doc} tiles={tiles} tool={tool} style={style} zoom={zoom} selected={selected} onSelect={setSelected} onCommit={commit} crop={crop} onCrop={setCrop} onFitZoom={setZoom} disabled={busy}/></main></div>
    <footer className="status-bar"><span className="dimensions">{doc.crop.width.toLocaleString()} × {doc.crop.height.toLocaleString()} px</span><span className="status-message" aria-live="polite">{progress||'Screenshots stay on your device'}</span><div className="zoom-controls"><button className="icon-button" aria-label="Zoom out" onClick={()=>setZoom(z=>clamp(z/1.25,.1,4))}><Minus size={20}/></button><span>{Math.round(zoom*100)}%</span><button className="icon-button" aria-label="Zoom in" onClick={()=>setZoom(z=>clamp(z*1.25,.1,4))}><Plus size={20}/></button><button className="secondary-button fit-button" onClick={fit}>Fit</button></div></footer>
    {toast&&<div className={`toast ${toast.error?'error':''}`} role={toast.error?'alert':'status'}>{toast.error?<HelpCircle size={19}/>:<Check size={19}/>}<span>{toast.text}</span><button className="icon-button" aria-label="Dismiss notification" onClick={()=>setToast(null)}><X size={16}/></button></div>}<UpdateNotice openHelp={()=>setHelp(true)}/>{help&&<Help close={()=>setHelp(false)}/>}
  </div>;
}
