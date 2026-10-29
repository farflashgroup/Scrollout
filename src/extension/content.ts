import { scrollExtent, scrollPositions } from '../shared/geometry';
import type { CaptureMessage, PageMetrics, CaptureRegion } from '../shared/types';

// Injection is idempotent; this script deliberately lives in the isolated world.
const scope=globalThis as typeof globalThis & {__scrolloutInstalled?:boolean};
if(!scope.__scrolloutInstalled){
  scope.__scrolloutInstalled=true;
  let running:{id:string;abort:boolean;reason:string;restore:()=>void}|undefined;
  const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
  const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
  function send(payload:CaptureMessage):Promise<{ok:boolean;error?:string}> {
    let timer:number|undefined;
    const deadline=new Promise<never>((_resolve,reject)=>{timer=window.setTimeout(()=>reject(new Error('The capture worker stopped responding.')),5000)});
    return Promise.race([Promise.resolve().then(()=>chrome.runtime.sendMessage(payload)),deadline]).finally(()=>clearTimeout(timer));
  }
  async function sendTile(payload:Extract<CaptureMessage,{type:'TILE'}>) {
    // A worker can die after persisting a tile but before acknowledging it.
    // Sequence IDs make one bounded retry safe, without skipping source pixels.
    for(let attempt=0;attempt<2;attempt++){
      try{return await send(payload)}catch(error){if(running?.abort)throw new Error(running.reason);if(attempt===1)throw new Error('Capture was interrupted. Click Scrollout on the page to try again.');await delay(200)}
    }
    throw new Error('Capture was interrupted.');
  }
  function metrics():PageMetrics {
    const root=document.documentElement,body=document.body;
    const visual=window.visualViewport,layoutVisual=visual&&Math.abs(visual.scale-1)<.001;
    const contentWidth=layoutVisual?visual.width:Math.min(root.clientWidth,innerWidth),contentHeight=layoutVisual?visual.height:Math.min(root.clientHeight,innerHeight);
    return {width:Math.max(root.scrollWidth,root.clientWidth,body?.scrollWidth??0,contentWidth),height:Math.max(root.scrollHeight,root.clientHeight,body?.scrollHeight??0,contentHeight),viewportWidth:Math.max(innerWidth,contentWidth),viewportHeight:Math.max(innerHeight,contentHeight),contentWidth,contentHeight,pixelRatio:devicePixelRatio};
  }
  function mainPanel(view:PageMetrics):HTMLElement|null {
    const root=document.scrollingElement;
    if(root&&(root.scrollHeight-root.clientHeight>2||root.scrollWidth-root.clientWidth>2))return null;
    let best:HTMLElement|null=null,score=0;
    for(const element of [document.body,...document.querySelectorAll('body *')]){
      if(!(element instanceof HTMLElement))continue;
      const css=getComputedStyle(element),vertical=/auto|scroll|overlay/.test(css.overflowY)&&element.scrollHeight>element.clientHeight+2,horizontal=/auto|scroll|overlay/.test(css.overflowX)&&element.scrollWidth>element.clientWidth+2;
      if(!vertical&&!horizontal)continue;
      const r=element.getBoundingClientRect(),x=r.left+element.clientLeft,y=r.top+element.clientTop;
      if(element.clientWidth<Math.min(320,view.contentWidth*.4)||element.clientHeight<Math.min(200,view.contentHeight*.4)||x<0||y<0||x+element.clientWidth>view.contentWidth+2||y+element.clientHeight>view.contentHeight+2)continue;
      const area=element.clientWidth*element.clientHeight;
      // Small sidebars, chat boxes and independently scrolling widgets should
      // not replace the page's main capture surface.
      if(area<view.contentWidth*view.contentHeight*.3)continue;
      const candidate=area*(1+Math.min(10,element.scrollHeight/element.clientHeight+element.scrollWidth/element.clientWidth)*.001);
      if(candidate>score){best=element;score=candidate}
    }
    return best;
  }
  function panelSize(panel:HTMLElement):Promise<{width:number;height:number}> {
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{observer.disconnect();reject(new Error('The scrolling panel changed before capture could start. Try again.'))},1000);
      const observer=new ResizeObserver(([entry])=>{clearTimeout(timer);observer.disconnect();const css=getComputedStyle(panel),padding=(key:string)=>Number.parseFloat(css.getPropertyValue(key))||0;resolve({width:entry.contentRect.width+padding('padding-left')+padding('padding-right'),height:entry.contentRect.height+padding('padding-top')+padding('padding-bottom')})});
      observer.observe(panel);
    });
  }
  function prepare(id:string,view:PageMetrics,panel:HTMLElement|null,size?:{width:number;height:number}) {
    const savedX=panel?.scrollLeft??scrollX,savedY=panel?.scrollTop??scrollY;
    const changes:{element:HTMLElement;property:string;value:string;priority:string}[]=[];
    const fixed:HTMLElement[]=[];
    function set(element:HTMLElement,property:string,value:string){changes.push({element,property,value:element.style.getPropertyValue(property),priority:element.style.getPropertyPriority(property)});element.style.setProperty(property,value,'important')}
    const style=document.createElement('style');style.textContent='html,body,* {scroll-behavior:auto!important;scroll-snap-type:none!important;overflow-anchor:none!important;animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';document.documentElement.append(style);
    const sticky:HTMLElement[]=[];
    for(const element of document.querySelectorAll<HTMLElement>('body *')){
      const position=getComputedStyle(element).position;
      if(position==='sticky'&&(!panel||panel.contains(element)))sticky.push(element);
      else if(position==='fixed'&&(!panel||!element.contains(panel)))fixed.push(element);
    }
    // Read positions first; interleaving sticky writes with style reads forces
    // repeated style/layout work on large documents.
    for(const element of sticky){set(element,'position','relative');set(element,'top','auto');set(element,'bottom','auto');set(element,'left','auto');set(element,'right','auto')}
    const r=panel?.getBoundingClientRect(),css=panel?getComputedStyle(panel):undefined;
    const borderX=Number.parseFloat(css?.borderLeftWidth??'0')||0,borderY=Number.parseFloat(css?.borderTopWidth??'0')||0;
    const clip=panel&&r&&size?{x:r.left+borderX,y:r.top+borderY,width:size.width,height:size.height}:undefined;
    const client={width:panel?.clientWidth,height:panel?.clientHeight};
    const surface={width:panel&&clip?scrollExtent(panel.scrollWidth,panel.clientWidth,clip.width):view.width,height:panel&&clip?scrollExtent(panel.scrollHeight,panel.clientHeight,clip.height):view.height,viewportWidth:clip?.width??view.contentWidth,viewportHeight:clip?.height??view.contentHeight};
    const initial:PageMetrics=clip?{...view,width:view.contentWidth+surface.width-clip.width,height:view.contentHeight+surface.height-clip.height}:view;
    let expectedX=savedX,expectedY=savedY,restored=false;let watchdog:ReturnType<typeof setInterval>|undefined;
    const offset=()=>({x:panel?.scrollLeft??scrollX,y:panel?.scrollTop??scrollY});
    function sameViewport(){
      const now=metrics();if(now.viewportWidth!==view.viewportWidth||now.viewportHeight!==view.viewportHeight||now.pixelRatio!==view.pixelRatio)return false;
      if(panel&&clip&&r){const next=panel.getBoundingClientRect();return panel.isConnected&&panel.clientWidth===client.width&&panel.clientHeight===client.height&&Math.abs(next.left-r.left)<.01&&Math.abs(next.top-r.top)<.01&&Math.abs(next.width-r.width)<.01&&Math.abs(next.height-r.height)<.01}
      return true;
    }
    function abort(reason:string){if(running?.id===id){running.abort=true;running.reason=reason;restore()}}
    function onWheel(event:Event){if(event.cancelable)event.preventDefault();abort('Capture cancelled because you scrolled the page. Click Scrollout to try again.')}
    function onScroll(){if(!sameViewport()){onResize();return}const p=offset();if(Math.abs(p.x-expectedX)>2||Math.abs(p.y-expectedY)>2)abort('Capture cancelled because the page scrolled unexpectedly. Click Scrollout to try again.')}
    function onKey(event:KeyboardEvent){if(event.key==='Escape')abort('Capture cancelled.');else if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','PageDown','PageUp','Home','End',' '].includes(event.key)&&!['INPUT','TEXTAREA'].includes((event.target as HTMLElement)?.tagName))onWheel(event)}
    function onResize(){abort('The browser viewport changed during capture. Click Scrollout to try again.')}
    function onPageHide(){abort('Capture cancelled because the page navigated. Try again on the new page.')}
    function restore(){
      if(restored)return;restored=true;if(watchdog)clearInterval(watchdog);
      removeEventListener('wheel',onWheel,true);removeEventListener('touchstart',onWheel,true);removeEventListener('scroll',onScroll,true);removeEventListener('keydown',onKey,true);removeEventListener('resize',onResize);removeEventListener('pagehide',onPageHide);
      for(const change of changes.reverse())if(change.value)change.element.style.setProperty(change.property,change.value,change.priority);else change.element.style.removeProperty(change.property);
      // Resolve restored sticky geometry before placing the original scroll
      // offset; pending scroll anchoring must not undo the restoration.
      (panel??document.documentElement).getBoundingClientRect();
      if(panel)panel.scrollTo({left:savedX,top:savedY,behavior:'instant'});else scrollTo({left:savedX,top:savedY,behavior:'instant'});
      style.remove();
    }
    running={id,abort:false,reason:'Capture cancelled.',restore};
    addEventListener('wheel',onWheel,{capture:true,passive:false});addEventListener('touchstart',onWheel,{capture:true,passive:false});addEventListener('scroll',onScroll,true);addEventListener('keydown',onKey,true);addEventListener('resize',onResize);addEventListener('pagehide',onPageHide);
    watchdog=setInterval(()=>{void send({type:'HEARTBEAT',id}).then(response=>{if(!response?.ok)abort('Capture was interrupted. Click Scrollout to try again.')}).catch(()=>abort('Scrollout stopped responding during capture. Try again.'))},3000);
    function position(x:number,y:number){expectedX=x;expectedY=y;if(panel)panel.scrollTo({left:x,top:y,behavior:'instant'});else scrollTo({left:x,top:y,behavior:'instant'})}
    function regions(sequence:number,x:number,y:number):CaptureRegion[]|undefined {
      if(!clip)return;
      const pieces:CaptureRegion[]=[];
      if(sequence===0){
        pieces.push({source:{x:0,y:0,width:view.contentWidth,height:clip.y+clip.height},destination:{x:0,y:0,width:view.contentWidth,height:clip.y+clip.height}});
        const footer=view.contentHeight-clip.y-clip.height;
        if(footer>0)pieces.push({source:{x:0,y:clip.y+clip.height,width:view.contentWidth,height:footer},destination:{x:0,y:clip.y+surface.height,width:view.contentWidth,height:footer}});
      }
      const width=Math.min(clip.width,surface.width-x),height=Math.min(clip.height,surface.height-y);
      pieces.push({source:{...clip,width,height},destination:{x:clip.x+x,y:clip.y+y,width,height}});
      return pieces;
    }
    return {initial,surface,fixed,set,restore,position,sameViewport,offset,regions};
  }
  async function run(id:string) {
    const startup={id,abort:false,reason:'Capture cancelled.',restore:()=>{}};running=startup;
    let prepared:ReturnType<typeof prepare>|undefined;
    try {
      const view=metrics(),panel=mainPanel(view),size=panel?await panelSize(panel):undefined;
      if(startup.abort)throw new Error(startup.reason);
      prepared=prepare(id,view,panel,size);
      const {initial,surface,fixed,set,restore,position,sameViewport,offset,regions}=prepared;
      const xs=scrollPositions(surface.width,surface.viewportWidth),ys=scrollPositions(surface.height,surface.viewportHeight),total=xs.length*ys.length;
      let sequence=0;
      for(const y of ys)for(const x of xs){
        if(running?.abort)throw new Error(running.reason);
        if(sequence===1)fixed.forEach(element=>set(element,'visibility','hidden'));
        position(x,y);await frame();await frame();
        const visibleImages=Array.from(document.images).filter(image=>{const r=image.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth});
        await Promise.race([Promise.all([document.fonts.ready,...visibleImages.map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true})}))]),delay(1500)]);
        await delay(100);await frame();
        if(running?.abort)throw new Error(running.reason);
        if(!sameViewport())throw new Error('The browser viewport changed during capture. Try again.');
        const actual=offset();
        if(Math.abs(actual.x-x)>2||Math.abs(actual.y-y)>2)throw new Error('The page changed its scroll position or size during capture. Try again.');
        const response=await sendTile({type:'TILE',id,sequence,total,x:actual.x,y:actual.y,metrics:initial,regions:regions(sequence,actual.x,actual.y)});
        if(!response?.ok)throw new Error(response?.error||'Capture was interrupted.');
        if(!sameViewport())throw new Error('The browser viewport changed during capture. Try again.');sequence++;
      }
      restore();if(running?.abort)throw new Error(running.reason);
      const done=await send({type:'DONE',id});if(!done?.ok)throw new Error(done?.error||'Capture did not finish.');
    }catch(error){prepared?.restore();await send({type:'FAILED',id,reason:error instanceof Error?error.message:'Capture failed.'}).catch(()=>{})}
    finally{prepared?.restore();if(running?.id===id)running=undefined}
  }
  chrome.runtime.onMessage.addListener((msg,_sender,respond)=>{
    if(msg.type==='START'){
      if(running){respond({ok:false,error:'A capture is already running.'});return}
      respond({ok:true});void run(msg.id);
    }else if(msg.type==='CAPTURE_CHECK'){respond({ok:!!running&&running.id===msg.id&&!running.abort})}
    else if(msg.type==='STOP'&&running&&running.id===msg.id){running.abort=true;running.reason=msg.reason;running.restore();respond({ok:true})}
  });
}
