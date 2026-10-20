import { scrollPositions } from '../shared/geometry';
import type { CaptureMessage, PageMetrics } from '../shared/types';

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
  function prepare(id:string) {
    const savedX=scrollX,savedY=scrollY,initial=metrics();const changes:{element:HTMLElement;property:string;value:string;priority:string}[]=[];
    let expectedX=savedX,expectedY=savedY;
    function sameViewport(){const now=metrics();return now.viewportWidth===initial.viewportWidth&&now.viewportHeight===initial.viewportHeight&&now.pixelRatio===initial.pixelRatio}
    const fixed:HTMLElement[]=[];
    function set(element:HTMLElement,property:string,value:string){changes.push({element,property,value:element.style.getPropertyValue(property),priority:element.style.getPropertyPriority(property)});element.style.setProperty(property,value,'important')}
    const style=document.createElement('style');style.textContent='html,body,* {scroll-behavior:auto!important;scroll-snap-type:none!important;animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}';document.documentElement.append(style);
    for(const element of document.querySelectorAll<HTMLElement>('body *')){
      const position=getComputedStyle(element).position;
      if(position==='sticky'){set(element,'position','relative');set(element,'top','auto');set(element,'bottom','auto');set(element,'left','auto');set(element,'right','auto')}
      else if(position==='fixed')fixed.push(element);
    }
    let restored=false;let watchdog:ReturnType<typeof setInterval>|undefined;
    function abort(reason:string){if(running?.id===id){running.abort=true;running.reason=reason;restore()}}
    function onWheel(event:Event){if(event.cancelable)event.preventDefault();abort('Capture cancelled because you scrolled the page. Click Scrollout to try again.')}
    function onScroll(){if(!sameViewport()){onResize();return}if(Math.abs(scrollX-expectedX)>2||Math.abs(scrollY-expectedY)>2)abort('Capture cancelled because the page scrolled unexpectedly. Click Scrollout to try again.')}
    function onKey(event:KeyboardEvent){if(event.key==='Escape')abort('Capture cancelled.');else if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','PageDown','PageUp','Home','End',' '].includes(event.key)&&!['INPUT','TEXTAREA'].includes((event.target as HTMLElement)?.tagName))onWheel(event)}
    function onResize(){abort('The browser viewport changed during capture. Click Scrollout to try again.')}
    function onPageHide(){abort('Capture cancelled because the page navigated. Try again on the new page.')}
    function restore(){
      if(restored)return;restored=true;if(watchdog)clearInterval(watchdog);
      removeEventListener('wheel',onWheel,true);removeEventListener('touchstart',onWheel,true);removeEventListener('scroll',onScroll,true);removeEventListener('keydown',onKey,true);removeEventListener('resize',onResize);removeEventListener('pagehide',onPageHide);
      for(const change of changes.reverse())if(change.value)change.element.style.setProperty(change.property,change.value,change.priority);else change.element.style.removeProperty(change.property);
      // Keep auto scrolling for restoration, then remove our temporary style.
      scrollTo({left:savedX,top:savedY,behavior:'instant'});style.remove();
    }
    running={id,abort:false,reason:'Capture cancelled.',restore};
    addEventListener('wheel',onWheel,{capture:true,passive:false});addEventListener('touchstart',onWheel,{capture:true,passive:false});addEventListener('scroll',onScroll,true);addEventListener('keydown',onKey,true);addEventListener('resize',onResize);addEventListener('pagehide',onPageHide);
    watchdog=setInterval(()=>{void send({type:'HEARTBEAT',id}).then(response=>{if(!response?.ok)abort('Capture was interrupted. Click Scrollout to try again.')}).catch(()=>abort('Scrollout stopped responding during capture. Try again.'))},3000);
    function position(x:number,y:number){expectedX=x;expectedY=y;scrollTo({left:x,top:y,behavior:'instant'})}
    return {initial,fixed,set,restore,position,sameViewport};
  }
  async function run(id:string) {
    const {initial,fixed,set,restore,position,sameViewport}=prepare(id);
    try {
      const xs=scrollPositions(initial.width,initial.contentWidth),ys=scrollPositions(initial.height,initial.contentHeight),total=xs.length*ys.length;
      let sequence=0;
      for(const y of ys)for(const x of xs){
        if(running?.abort)throw new Error(running.reason);
        if(sequence===1)fixed.forEach(element=>set(element,'visibility','hidden'));
        position(x,y);await frame();await frame();
        // Bounded settling allows native lazy images without extending infinite feeds.
        const visibleImages=Array.from(document.images).filter(image=>{const r=image.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth});
        await Promise.race([Promise.all([document.fonts.ready,...visibleImages.map(image=>image.complete?Promise.resolve():new Promise(resolve=>{image.addEventListener('load',resolve,{once:true});image.addEventListener('error',resolve,{once:true})}))]),delay(1500)]);
        await delay(100);await frame();
        if(running?.abort)throw new Error(running.reason);
        if(!sameViewport())throw new Error('The browser viewport changed during capture. Try again.');
        if(Math.abs(scrollX-x)>2||Math.abs(scrollY-y)>2)throw new Error('The page changed its scroll position or size during capture. Try again.');
        const response=await sendTile({type:'TILE',id,sequence,total,x:scrollX,y:scrollY,metrics:initial});
        if(!response?.ok)throw new Error(response?.error||'Capture was interrupted.');sequence++;
      }
      restore();if(running?.abort)throw new Error(running.reason);
      const done=await send({type:'DONE',id});if(!done?.ok)throw new Error(done?.error||'Capture did not finish.');
    }catch(error){restore();await send({type:'FAILED',id,reason:error instanceof Error?error.message:'Capture failed.'}).catch(()=>{})}
    finally{restore();if(running?.id===id)running=undefined}
  }
  chrome.runtime.onMessage.addListener((msg,_sender,respond)=>{
    if(msg.type==='START'){
      if(running){respond({ok:false,error:'A capture is already running.'});return}
      respond({ok:true});void run(msg.id);
    }else if(msg.type==='CAPTURE_CHECK'){respond({ok:!!running&&running.id===msg.id&&!running.abort})}
    else if(msg.type==='STOP'&&running&&running.id===msg.id){running.abort=true;running.reason=msg.reason;running.restore();respond({ok:true})}
  });
}
