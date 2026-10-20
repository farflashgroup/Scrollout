import type { CaptureSession, ScreenshotTile } from './types';

let connection:Promise<IDBDatabase>|undefined;
function db():Promise<IDBDatabase> {
  return connection ??= new Promise((resolve,reject)=>{
    const request=indexedDB.open('scrollout-temporary',1);
    request.onupgradeneeded=()=>{
      request.result.createObjectStore('sessions',{keyPath:'id'});
      const tiles=request.result.createObjectStore('tiles',{keyPath:'id'});
      tiles.createIndex('captureId','captureId');
    };
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result)};
    request.onerror=()=>reject(request.error);
  });
}
function result<T>(request:IDBRequest<T>):Promise<T> {
  return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
}
function finished(transaction:IDBTransaction):Promise<void> {
  return new Promise((resolve,reject)=>{transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error??new Error('Storage transaction aborted.'))});
}
export async function getSession(id:string):Promise<CaptureSession|undefined> {
  return result((await db()).transaction('sessions').objectStore('sessions').get(id));
}
export async function allSessions():Promise<CaptureSession[]> {
  return result((await db()).transaction('sessions').objectStore('sessions').getAll());
}
export async function putSession(value:CaptureSession) {
  const tx=(await db()).transaction('sessions','readwrite');const done=finished(tx);tx.objectStore('sessions').put(value);await done;
}
export async function updateSession(id:string,update:(s:CaptureSession)=>CaptureSession):Promise<void> {
  const tx=(await db()).transaction('sessions','readwrite');const done=finished(tx);const store=tx.objectStore('sessions');
  const request=store.get(id);request.onsuccess=()=>{if(request.result)store.put(update(request.result))};await done;
}
export async function putTile(value:ScreenshotTile) {
  const tx=(await db()).transaction('tiles','readwrite');const done=finished(tx);tx.objectStore('tiles').put(value);await done;
}
export async function getTiles(id:string):Promise<ScreenshotTile[]> {
  const values=await result<ScreenshotTile[]>((await db()).transaction('tiles').objectStore('tiles').index('captureId').getAll(id));
  return values.sort((a,b)=>a.sequence-b.sequence);
}
export async function deleteSession(id:string) {
  const tx=(await db()).transaction(['sessions','tiles'],'readwrite');const done=finished(tx);
  tx.objectStore('sessions').delete(id);
  const cursor=tx.objectStore('tiles').index('captureId').openCursor(IDBKeyRange.only(id));
  cursor.onsuccess=()=>{if(cursor.result){cursor.result.delete();cursor.result.continue()}};await done;
}
export async function clearSessions() {
  const tx=(await db()).transaction(['sessions','tiles'],'readwrite');const done=finished(tx);tx.objectStore('sessions').clear();tx.objectStore('tiles').clear();await done;
}
