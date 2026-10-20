import type { CaptureMessage, PageMetrics } from './types';

export type WorkerMessage = Exclude<CaptureMessage,{type:'START'|'STOP'}>;
export const workerMessageTypes=['TILE','DONE','FAILED','HEARTBEAT','OWN','CANCEL'];
const record=(value:unknown):value is Record<string,unknown>=>typeof value==='object'&&value!==null&&!Array.isArray(value);
const positive=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=Number.MAX_SAFE_INTEGER;
const position=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER;
export function isPageMetrics(value:unknown):value is PageMetrics {
  if(!record(value))return false;
  const {width,height,viewportWidth,viewportHeight,contentWidth,contentHeight}=value;
  return positive(width)&&positive(height)&&positive(viewportWidth)&&positive(viewportHeight)&&positive(contentWidth)&&positive(contentHeight)
    &&(value.pixelRatio===undefined||positive(value.pixelRatio))
    &&contentWidth<=viewportWidth&&contentHeight<=viewportHeight&&contentWidth<=width&&contentHeight<=height;
}
export function isWorkerMessage(value:unknown):value is WorkerMessage {
  if(!record(value)||typeof value.type!=='string'||!workerMessageTypes.includes(value.type)||typeof value.id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(value.id)||['__proto__','constructor','prototype'].includes(value.id))return false;
  if(value.type==='FAILED')return typeof value.reason==='string'&&value.reason.length>0&&value.reason.length<=2048;
  if(value.type!=='TILE')return true;
  return Number.isSafeInteger(value.sequence)&&Number(value.sequence)>=0&&Number.isSafeInteger(value.total)&&Number(value.total)>Number(value.sequence)
    &&position(value.x)&&position(value.y)&&isPageMetrics(value.metrics)
    &&value.x+value.metrics.contentWidth<=value.metrics.width+2&&value.y+value.metrics.contentHeight<=value.metrics.height+2;
}
export function isEditorUrl(url:string|undefined,id:string,editorUrl:string):boolean {
  if(!url)return false;
  try{
    const candidate=new URL(url),editor=new URL(editorUrl);
    return candidate.protocol===editor.protocol&&candidate.host===editor.host&&candidate.pathname===editor.pathname&&candidate.searchParams.get('capture')===id;
  }catch{return false}
}
export function isEditorSender(sender:chrome.runtime.MessageSender,id:string,editorUrl:string,extensionId:string):boolean {
  return sender.id===extensionId&&sender.frameId===0&&sender.tab?.id!==undefined&&isEditorUrl(sender.url,id,editorUrl);
}
