export interface Point { x:number; y:number }
export interface Rect { x:number; y:number; width:number; height:number }
export type Tool = 'select'|'crop'|'draw'|'highlight'|'arrow'|'rect'|'ellipse'|'text'|'redact';
export interface Annotation extends Rect {
  id:string;
  kind:Exclude<Tool,'select'|'crop'>;
  color:string;
  opacity:number;
  strokeWidth:number;
  fontSize:number;
  points?:Point[];
  text?:string;
}
export interface EditorDocument {
  width:number; height:number; crop:Rect; annotations:Annotation[];
  filename:string; sourceHost:string; createdAt:number;
}
export interface ScreenshotTile extends Rect {
  id:string; captureId:string; sequence:number;
  sourceX:number; sourceY:number; sourceWidth:number; sourceHeight:number;
  blob:Blob;
}
export interface CaptureSession {
  id:string; status:'capturing'|'ready'|'error'; progress:number; message?:string;
  sourceTabId:number; sourceWindowId:number; sourceTitle:string; sourceHost:string;
  createdAt:number; editorTabIds:number[]; document?:EditorDocument;
}
export interface PageMetrics {
  width:number; height:number; viewportWidth:number; viewportHeight:number;
  contentWidth:number; contentHeight:number; pixelRatio?:number;
}
export interface ActiveCapture {
  id:string; tabId:number; windowId:number; metrics?:PageMetrics;
  documentId?:string;
  lastCaptureAt:number; scaleX?:number; scaleY?:number; completed:number; total:number;
}
export type CaptureMessage =
  | {type:'START';id:string}
  | {type:'STOP';id:string;reason:string}
  | {type:'TILE';id:string;sequence:number;total:number;x:number;y:number;metrics:PageMetrics}
  | {type:'DONE';id:string}
  | {type:'FAILED';id:string;reason:string}
  | {type:'HEARTBEAT';id:string}
  | {type:'OWN';id:string}
  | {type:'CANCEL';id:string};
export const isExtension = () => typeof chrome !== 'undefined' && !!chrome.runtime?.id;
