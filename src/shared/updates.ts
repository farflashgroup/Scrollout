export const RELEASE_URL='https://scrollout.farflash.com/releases.json';
export const STORE_URL='https://chromewebstore.google.com/detail/scrollout/ajlhmigmaeodaedpgjmngkchnjoenmkm';
export const CHECK_INTERVAL=12*60*60*1000;
export const UPDATE_CACHE='releaseCheck';
export const AUTO_CHECK='automaticUpdateChecks';
export const PENDING_UPDATE='pendingBrowserUpdate';

export interface ReleaseInfo {version:string;sha256:string;storeVersion:string|null;storeUrl:string|null}
export interface ReleaseCache {attemptedAt:number;checkedAt?:number;release?:ReleaseInfo}
export type InstallKind='unpacked'|'browser'|'managed'|'unknown';

export function validVersion(value:unknown):value is string {
  return typeof value==='string'&&/^(0|[1-9]\d{0,4})(\.(0|[1-9]\d{0,4})){0,3}$/.test(value)
    &&value.split('.').every(n=>Number(n)<=65535)&&value.split('.').some(n=>Number(n)>0);
}
export function newerVersion(candidate:string,current:string):boolean {
  if(!validVersion(candidate)||!validVersion(current))return false;
  const a=candidate.split('.').map(Number),b=current.split('.').map(Number);
  for(let i=0;i<4;i++)if((a[i]??0)!==(b[i]??0))return (a[i]??0)>(b[i]??0);
  return false;
}
export function parseRelease(value:unknown):ReleaseInfo {
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid release information.');
  const r=value as Record<string,unknown>;
  if(r.schemaVersion!==1||!validVersion(r.version)||typeof r.sha256!=='string'||!/^\b[a-f0-9]{64}$/.test(r.sha256))throw Error('Invalid release information.');
  if(r.storeVersion!==null&&(!validVersion(r.storeVersion)||r.storeUrl!==STORE_URL))throw Error('Invalid store release information.');
  if(r.storeVersion===null&&r.storeUrl!==null)throw Error('Invalid store release information.');
  return {version:r.version,sha256:r.sha256,storeVersion:r.storeVersion as string|null,storeUrl:r.storeUrl as string|null};
}
export function downloadUrl(version:string):string {
  if(!validVersion(version))throw Error('Invalid version.');
  return `https://scrollout.farflash.com/downloads/Scrollout-${version}.zip`;
}
export function installKind(type:string|undefined,updateUrl:string|undefined):InstallKind {
  if(type==='development')return 'unpacked';
  if(type==='admin')return 'managed';
  if(updateUrl)return 'browser';
  return 'unknown';
}
export async function fetchRelease():Promise<ReleaseInfo> {
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
  try{
    // One fixed public data file. Never include capture data, a version query,
    // cookies, credentials, or a referrer; never download or execute code here.
    const response=await fetch(RELEASE_URL,{method:'GET',credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',signal:controller.signal});
    if(!response.ok||!response.headers.get('content-type')?.includes('application/json')||!response.body)throw Error('Release check unavailable.');
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192)throw Error('Release information is too large.');chunks.push(value)}}
    finally{await reader.cancel().catch(()=>{})}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    return parseRelease(JSON.parse(new TextDecoder().decode(bytes)));
  }finally{clearTimeout(timer)}
}
