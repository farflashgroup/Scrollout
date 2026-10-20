import { allSessions, clearSessions, deleteSession, getSession, putSession, putTile, updateSession } from '../shared/db';
import type { ActiveCapture, CaptureMessage, CaptureSession, PageMetrics } from '../shared/types';
import { isEditorSender, isEditorUrl, isWorkerMessage, workerMessageTypes } from '../shared/messages';
import { captureScale } from '../shared/geometry';

const ready=(async()=>{
  const {browserSessionToken}=await chrome.storage.session.get('browserSessionToken');
  if(!browserSessionToken){await clearSessions();await chrome.storage.session.set({browserSessionToken:crypto.randomUUID()})}
  const tabs=await chrome.tabs.query({});const liveTabs=new Map(tabs.map(t=>[t.id,t]));
  const editorOwners:Record<string,number[]>={};
  for(const session of await allSessions()){
    const checks=await Promise.all(session.editorTabIds.map(async id=>{
      const tab=liveTabs.get(id);if(!tab)return false;
      if(tab.url!==undefined)return isEditorUrl(tab.url,session.id,chrome.runtime.getURL('editor.html'));
      return tab.status==='loading'||tab.discarded||await probeEditor(id,session.id);
    }));
    const owners=session.editorTabIds.filter((_id,index)=>checks[index]);
    if(session.editorTabIds.length&&!owners.length)await expireOrphan(session.id);
    else if(owners.length){
      editorOwners[session.id]=owners;
      if(owners.length!==session.editorTabIds.length)await updateSession(session.id,s=>({...s,editorTabIds:owners}));
    }
  }
  const activeCapture=(await chrome.storage.session.get('activeCapture')).activeCapture as ActiveCapture|undefined;
  if(activeCapture&&!await getSession(activeCapture.id))await expireOrphan(activeCapture.id);
  await chrome.storage.session.set({editorOwners});
})();
async function expireOrphan(id:string) {
  const activeCapture=(await chrome.storage.session.get('activeCapture')).activeCapture as ActiveCapture|undefined;
  if(activeCapture?.id===id){
    await chrome.storage.session.remove('activeCapture');
    const reason='Capture was interrupted because its editor is no longer available. Click Scrollout to try again.';
    await chrome.tabs.sendMessage(activeCapture.tabId,{type:'STOP',id,reason}).catch(()=>{});
    await Promise.allSettled([chrome.action.setBadgeText({tabId:activeCapture.tabId,text:'!'}),chrome.action.setTitle({tabId:activeCapture.tabId,title:reason})]);
  }
  await deleteSession(id);
}
async function active():Promise<ActiveCapture|undefined>{await ready;return (await chrome.storage.session.get('activeCapture')).activeCapture as ActiveCapture|undefined}
const saveActive=(value:ActiveCapture)=>chrome.storage.session.set({activeCapture:value});
// Serialize worker mutations so an old tile cannot overwrite a newer capture
// or cancel it when its screenshot API call returns after the user switches.
let mutations:Promise<unknown>=Promise.resolve();
function serialize<T>(operation:()=>Promise<T>):Promise<T> {
  const result=mutations.then(operation);mutations=result.then(()=>{},()=>{});return result;
}
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
function message(error:unknown){return error instanceof Error?error.message:String(error)}
async function probeEditor(tabId:number,id:string,type='EDITOR_CHECK',documentId?:string):Promise<boolean> {
  // Without the broad tabs permission Chrome hides even editor tab URLs.
  // A top-frame identity response preserves reloads while detecting navigation.
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([
    chrome.tabs.sendMessage(tabId,{type,id},{frameId:0,...(documentId?{documentId}:{})}).then(response=>response?.ok===true).catch(()=>false),
    new Promise<boolean>(resolve=>{timer=setTimeout(()=>resolve(false),2000)}),
  ])}finally{if(timer)clearTimeout(timer)}
}
// Session metadata expires with Chrome; the IDB mirror lets a restarted worker
// reconcile ownership with live tabs without retaining a browser-long library.
async function syncOwners(id:string) {
  const session=await getSession(id),stored=await chrome.storage.session.get('editorOwners');
  const editorOwners:Record<string,number[]>={...(stored.editorOwners??{})};
  if(session?.editorTabIds.length)editorOwners[id]=session.editorTabIds;
  else delete editorOwners[id];
  await chrome.storage.session.set({editorOwners});
}
async function releaseOwner(session:CaptureSession,tabId:number) {
  const owners=session.editorTabIds.filter(id=>id!==tabId);
  if(!owners.length){
    if((await active())?.id===session.id)await cancel('Capture cancelled because its editor was closed.');
    await deleteSession(session.id);
  }else await updateSession(session.id,s=>({...s,editorTabIds:owners}));
  await syncOwners(session.id);
}
async function notify(id:string) {
  await chrome.runtime.sendMessage({type:'SESSION_CHANGED',id}).catch(()=>{});
}
async function cancel(reason:string,activateEditor=false) {
  const capture=await active();if(!capture)return;
  // Clearing first makes late tile replies and watchdog heartbeats harmless.
  await chrome.storage.session.remove('activeCapture');
  await chrome.tabs.sendMessage(capture.tabId,{type:'STOP',id:capture.id,reason}).catch(()=>{});
  await updateSession(capture.id,s=>({...s,status:'error',message:reason}));
  await chrome.action.setBadgeText({tabId:capture.tabId,text:'!'}).catch(()=>{});
  await chrome.action.setTitle({tabId:capture.tabId,title:reason}).catch(()=>{});
  await notify(capture.id);
  if(activateEditor){const session=await getSession(capture.id);if(session?.editorTabIds[0])await chrome.tabs.update(session.editorTabIds[0],{active:true}).catch(()=>{})}
}
export function start(tab:chrome.tabs.Tab) {return serialize(async()=>{
  try{await startInternal(tab)}catch(error){
    const reason=`Could not start capture: ${message(error)}`;
    if((await active().catch(()=>undefined))?.tabId===tab.id)await cancel(reason,true).catch(()=>{});
    if(tab.id!==undefined)await Promise.allSettled([chrome.action.setBadgeText({tabId:tab.id,text:'!'}),chrome.action.setBadgeBackgroundColor({tabId:tab.id,color:'#FF6359'}),chrome.action.setTitle({tabId:tab.id,title:reason})]);
    console.error('Scrollout capture:',error);
  }
})}
async function startInternal(tab:chrome.tabs.Tab) {
  await ready;if(!tab.id||tab.windowId===undefined)return;
  const previous=await active();if(previous){await cancel('Capture cancelled. Click Scrollout on the page to try again.');if(previous.tabId===tab.id)return}
  const id=crypto.randomUUID(),sourceTabId=tab.id;
  let sourceHost='';try{sourceHost=new URL(tab.url??'').hostname}catch{}
  const session:CaptureSession={id,status:'capturing',progress:0,sourceTabId,sourceWindowId:tab.windowId,sourceTitle:tab.title||'Screenshot',sourceHost,createdAt:Date.now(),editorTabIds:[]};
  await putSession(session);
  const {lastScreenshotAt}=await chrome.storage.session.get('lastScreenshotAt');
  await saveActive({id,tabId:sourceTabId,windowId:tab.windowId,lastCaptureAt:Number(lastScreenshotAt)||0,completed:0,total:1});
  try {
    const editor=await chrome.tabs.create({url:chrome.runtime.getURL(`editor.html?capture=${id}`),active:false,windowId:tab.windowId,openerTabId:sourceTabId});
    if(editor.id)await updateSession(id,s=>({...s,editorTabIds:[...new Set([...s.editorTabIds,editor.id!])]}));
    await syncOwners(id);
    await chrome.action.setBadgeBackgroundColor({tabId:sourceTabId,color:'#0B8F78'});
    await chrome.action.setBadgeText({tabId:sourceTabId,text:'…'});
    await chrome.action.setTitle({tabId:sourceTabId,title:'Capturing full page… Click again to cancel.'});
    const [injected]=await chrome.scripting.executeScript({target:{tabId:sourceTabId},files:['content.js']});
    const capture=await active();if(capture?.id!==id)return;
    await saveActive({...capture,documentId:injected?.documentId});
    const response=await chrome.tabs.sendMessage(sourceTabId,{type:'START',id});
    if(!response?.ok)throw new Error(response?.error||'Could not start capture.');
  }catch(error){
    const text=message(error);
    await cancel(/Cannot access|extensions gallery|not allowed|Missing host|cannot be scripted/i.test(text)?'This page does not allow full-page capture. Try a regular website instead.':`Capture failed: ${text}`,true);
  }
}
async function captureTile(msg:Extract<CaptureMessage,{type:'TILE'}>,sender:chrome.runtime.MessageSender) {
  let job=await active();if(!job||job.id!==msg.id||sender.tab?.id!==job.tabId||sender.frameId!==0)throw new Error('Capture is no longer active.');
  if(msg.sequence<job.completed)return {ok:true};
  if(msg.sequence!==job.completed)throw new Error('Capture sequence was interrupted.');
  const m:PageMetrics=msg.metrics;
  if(![m.width,m.height,m.viewportWidth,m.viewportHeight,m.contentWidth,m.contentHeight].every(n=>Number.isFinite(n)&&n>0))throw new Error('Invalid page dimensions.');
  if(job.metrics&&(m.viewportWidth!==job.metrics.viewportWidth||m.viewportHeight!==job.metrics.viewportHeight))throw new Error('The browser viewport changed during capture. Try again.');
  const current=await chrome.tabs.query({active:true,windowId:job.windowId});
  if(current[0]?.id!==job.tabId)throw new Error('Capture cancelled because you changed tabs.');
  await sleep(Math.max(0,550-(Date.now()-job.lastCaptureAt)));
  const check=await active();if(check?.id!==job.id)throw new Error('Capture cancelled.');
  const before=await chrome.tabs.query({active:true,windowId:job.windowId});
  if(before[0]?.id!==job.tabId)throw new Error('Capture cancelled because you changed tabs.');
  const timestamp=Date.now();
  // Quota timestamp is persisted before the expensive call, including failures.
  job={...job,lastCaptureAt:timestamp};await chrome.storage.session.set({activeCapture:job,lastScreenshotAt:timestamp});
  let data:string;
  try{data=await chrome.tabs.captureVisibleTab(job.windowId,{format:'png'})}catch(error){
    const now=await chrome.tabs.query({active:true,windowId:job.windowId});
    if(now[0]?.id!==job.tabId)throw new Error('Capture cancelled because you changed tabs.');
    if(/Cannot access|Missing host|activeTab permission|not been invoked/i.test(message(error)))throw new Error('Capture cancelled because the page navigated or access to it changed. Try again.');
    throw error;
  }
  const after=await chrome.tabs.query({active:true,windowId:job.windowId});
  if(after[0]?.id!==job.tabId||(await active())?.id!==job.id)throw new Error('Capture cancelled because you changed tabs.');
  const bytes=Uint8Array.from(atob(data.slice(data.indexOf(',')+1)),char=>char.charCodeAt(0));
  const blob=new Blob([bytes],{type:'image/png'});const bitmap=await createImageBitmap(blob);
  const {x:sx,y:sy}=captureScale(bitmap.width,bitmap.height,m);bitmap.close();
  if(job.scaleX&&Math.abs(sx-job.scaleX)>.001||job.scaleY&&Math.abs(sy-job.scaleY)>.001)throw new Error('The browser viewport or zoom changed during capture. Try again.');
  const width=Math.round(m.width*sx),height=Math.round(m.height*sy),x=Math.round(msg.x*sx),y=Math.round(msg.y*sy);
  const tileWidth=Math.min(Math.round(m.contentWidth*sx),width-x),tileHeight=Math.min(Math.round(m.contentHeight*sy),height-y);
  if(tileWidth<=0||tileHeight<=0)throw new Error('The page changed size during capture.');
  await putTile({id:`${job.id}:${msg.sequence}`,captureId:job.id,sequence:msg.sequence,x,y,width:tileWidth,height:tileHeight,sourceX:0,sourceY:0,sourceWidth:tileWidth,sourceHeight:tileHeight,blob});
  if((await active())?.id!==job.id){if(!await getSession(job.id))await deleteSession(job.id);throw new Error('Capture cancelled.');}
  job={...job,metrics:m,scaleX:sx,scaleY:sy,completed:msg.sequence+1,total:msg.total};await saveActive(job);
  const progress=Math.round(job.completed/job.total*100);
  await updateSession(job.id,s=>({...s,progress,document:s.document??{width,height,crop:{x:0,y:0,width,height},annotations:[],filename:s.sourceTitle,sourceHost:s.sourceHost,createdAt:s.createdAt}}));
  await chrome.action.setBadgeText({tabId:job.tabId,text:`${progress}%`});await notify(job.id);return {ok:true};
}
async function handle(msg:CaptureMessage,sender:chrome.runtime.MessageSender) {
  await ready;
  if(sender.id!==chrome.runtime.id)return {ok:false,error:'This sender is not allowed.'};
  if(msg.type==='OWN'){
    if(!isEditorSender(sender,msg.id,chrome.runtime.getURL('editor.html'),chrome.runtime.id))return {ok:false,error:'This editor does not own the requested capture.'};
    await updateSession(msg.id,s=>({...s,editorTabIds:[...new Set([...s.editorTabIds,sender.tab!.id!])]}));
    await syncOwners(msg.id);
    return {ok:true};
  }
  const job=await active();
  if(msg.type==='HEARTBEAT')return {ok:job?.id===msg.id&&sender.tab?.id===job.tabId&&sender.frameId===0};
  if(msg.type==='CANCEL'){
    if(!isEditorSender(sender,msg.id,chrome.runtime.getURL('editor.html'),chrome.runtime.id))return {ok:false,error:'This editor does not own the requested capture.'};
    const session=await getSession(msg.id);
    if(job?.id===msg.id&&sender.tab?.id&&session?.editorTabIds.includes(sender.tab.id))await cancel('Capture cancelled. Click Scrollout on the page to try again.');
    return {ok:true};
  }
  if(!job||job.id!==msg.id||sender.tab?.id!==job.tabId||sender.frameId!==0||job.documentId&&sender.documentId!==job.documentId)return {ok:false,error:'Capture is no longer active.'};
  if(msg.type==='TILE')return captureTile(msg,sender);
  if(msg.type==='FAILED'){await cancel(msg.reason,true);return {ok:true}}
  if(msg.type==='DONE'){
    if(job.completed!==job.total||!job.completed)throw new Error('Capture ended before every tile was saved.');
    await chrome.storage.session.remove('activeCapture');
    await updateSession(msg.id,s=>({...s,status:'ready',progress:100}));
    await chrome.action.setBadgeText({tabId:job.tabId,text:''});await chrome.action.setTitle({tabId:job.tabId,title:'Scrollout: capture full page (click again to cancel)'});await notify(job.id);
    const session=await getSession(job.id);if(session?.editorTabIds[0])await chrome.tabs.update(session.editorTabIds[0],{active:true});return {ok:true};
  }
  return {ok:false};
}
chrome.action.onClicked.addListener(tab=>{void start(tab).catch(error=>console.error('Scrollout capture:',error))});
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{
  if(!msg||typeof msg.type!=='string'||!workerMessageTypes.includes(msg.type))return;
  if(!isWorkerMessage(msg)){respond({ok:false,error:'Invalid capture message.'});return}
  void serialize(async()=>{try{return await handle(msg,sender)}catch(error){if(msg.type==='TILE'&&(await active())?.id===msg.id)await cancel(message(error),true);return {ok:false,error:message(error)}}}).then(respond).catch(error=>respond({ok:false,error:message(error)}));return true;
});
chrome.tabs.onActivated.addListener(info=>{void serialize(async()=>{const job=await active();if(job&&job.windowId===info.windowId&&job.tabId!==info.tabId)await cancel('Capture cancelled because you changed tabs. Click Scrollout on the page to try again.')})});
chrome.tabs.onUpdated.addListener((tabId,change,tab)=>{
  if(change.status||change.url)void serialize(async()=>{
    const job=await active();
    // Resource loading and late initial-load events can report "loading" too.
    // Confirm that the original document still owns its running content script.
    if(job?.tabId===tabId&&(change.url||!await probeEditor(tabId,job.id,'CAPTURE_CHECK',job.documentId)))await cancel('Capture cancelled because the page navigated. Try again on the new page.');
    if(change.status==='complete'||change.url)for(const session of await allSessions())if(session.editorTabIds.includes(tabId)){
      const stillOwned=tab.url!==undefined?isEditorUrl(tab.url,session.id,chrome.runtime.getURL('editor.html')):await probeEditor(tabId,session.id);
      if(!stillOwned)await releaseOwner(session,tabId);
    }
  }).catch(error=>console.error('Scrollout navigation cleanup:',error));
});
chrome.tabs.onRemoved.addListener(tabId=>{
  void serialize(async()=>{
    const job=await active();if(job?.tabId===tabId)await cancel('The source tab was closed before capture finished.');
    for(const session of await allSessions())if(session.editorTabIds.includes(tabId))await releaseOwner(session,tabId);
  }).catch(error=>console.error('Scrollout cleanup:',error));
});
