import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AUTO_CHECK, CHECK_INTERVAL, downloadUrl, fetchRelease, installKind, newerVersion, parseRelease, PENDING_UPDATE, UPDATE_CACHE, validVersion } from '../shared/updates';
import type { InstallKind, ReleaseCache, ReleaseInfo } from '../shared/updates';
import { isExtension } from '../shared/types';
import { version as buildVersion } from '../../package.json';

interface UpdateState {
  version:string;kind:InstallKind;automatic:boolean;release?:ReleaseInfo;pending?:string;
  busy:boolean;status:string;check:(manual?:boolean)=>Promise<void>;setAutomatic:(value:boolean)=>void;
}
const Updates=createContext<UpdateState|null>(null);
function useUpdates(){return useContext(Updates)!}
function cacheRelease(value:unknown):ReleaseInfo|undefined {
  if(!value||typeof value!=='object')return;
  try{return parseRelease({schemaVersion:1,...value})}catch{return}
}
export function UpdatesProvider({children}:{children:ReactNode}) {
  const extension=isExtension(),version=extension?chrome.runtime.getManifest().version:buildVersion;
  const [kind,setKind]=useState<InstallKind>('unknown'),[automatic,setAutomaticState]=useState(extension),[release,setRelease]=useState<ReleaseInfo>(),[pending,setPending]=useState<string>(),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
  const cache=useRef<ReleaseCache>({attemptedAt:0}),inFlight=useRef<Promise<void>|null>(null),mounted=useRef(false),auto=useRef(extension),installedKind=useRef<InstallKind>('unknown');
  const check=useCallback(async(manual=false)=>{
    if(!extension){setStatus('Update checks are available in the installed extension.');return}
    if(inFlight.current)return inFlight.current;
    const task=(async()=>{
      setBusy(true);setStatus('Checking for updates…');
      try{
        cache.current={...cache.current,attemptedAt:Date.now()};
        await chrome.storage.local.set({[UPDATE_CACHE]:cache.current});
        const found=await fetchRelease();
        cache.current={attemptedAt:Date.now(),checkedAt:Date.now(),release:found};
        await chrome.storage.local.set({[UPDATE_CACHE]:cache.current});
        let message='Release information checked just now.';
        if(manual&&(installedKind.current==='browser'||installedKind.current==='managed')&&found.storeVersion&&newerVersion(found.storeVersion,version)){
          let timer:ReturnType<typeof setTimeout>|undefined;
          try{
            const result=await Promise.race([chrome.runtime.requestUpdateCheck(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),10000)})]);
            if(result?.status==='update_available'&&validVersion(result.version)&&newerVersion(result.version,version)){
              await chrome.storage.local.set({[PENDING_UPDATE]:result.version});message='Chrome has downloaded an update. Export your work, then close all Scrollout editors to install it.';
            }else message=result?.status==='throttled'?'Chrome is limiting update checks. It will check again automatically.':result?'Chrome has not downloaded a newer store version yet. It will check again automatically.':'Chrome is still checking. You can keep editing.';
          }catch{message='Release information checked. Chrome could not complete its update check; try again from chrome://extensions.'}
          finally{if(timer)clearTimeout(timer)}
        }
        if(mounted.current){setRelease(found);setStatus(message)}
      }catch{if(mounted.current)setStatus('Could not check for updates. Your editor still works offline. Try again later.')}
      finally{if(mounted.current)setBusy(false)}
    })();
    inFlight.current=task;try{await task}finally{inFlight.current=null}
  },[extension,version]);
  useEffect(()=>{
    mounted.current=true;
    if(!extension)return()=>{mounted.current=false};
    let initialized=false;
    const refresh=async()=>{
      try{
        const saved=await chrome.storage.local.get([AUTO_CHECK,UPDATE_CACHE,PENDING_UPDATE]);if(!mounted.current)return;
        auto.current=saved[AUTO_CHECK]!==false;setAutomaticState(auto.current);
        const prior=saved[UPDATE_CACHE] as ReleaseCache|undefined;
        cache.current={attemptedAt:Number.isFinite(prior?.attemptedAt)&&prior!.attemptedAt<=Date.now()?prior!.attemptedAt:0,release:cacheRelease(prior?.release)};
        setRelease(cache.current.release);
        setPending(validVersion(saved[PENDING_UPDATE])?saved[PENDING_UPDATE]:undefined);
        if(initialized&&auto.current&&Date.now()-cache.current.attemptedAt>=CHECK_INTERVAL)void check();
        return true;
      }catch{if(mounted.current)setStatus('Local update settings could not be read. Use Check for updates to try again.');return false}
    };
    void (async()=>{
      try{const self=await chrome.management.getSelf();if(mounted.current){installedKind.current=installKind(self.installType,self.updateUrl||chrome.runtime.getManifest().update_url);setKind(installedKind.current)}}catch{/* Keep conservative manual guidance when Chrome cannot identify the install. */}
      const loaded=await refresh();initialized=true;
      if(loaded&&mounted.current&&auto.current&&Date.now()-cache.current.attemptedAt>=CHECK_INTERVAL)void check();
    })();
    const changed=(_changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local')void refresh()};
    chrome.storage.onChanged.addListener(changed);
    const onFocus=()=>{void refresh()};window.addEventListener('focus',onFocus);
    const timer=setInterval(onFocus,CHECK_INTERVAL);
    return()=>{mounted.current=false;clearInterval(timer);window.removeEventListener('focus',onFocus);chrome.storage.onChanged.removeListener(changed)};
  },[extension,check]);
  const setAutomatic=(value:boolean)=>{
    if(!extension)return;auto.current=value;setAutomaticState(value);
    void chrome.storage.local.set({[AUTO_CHECK]:value}).then(()=>{if(value&&Date.now()-cache.current.attemptedAt>=CHECK_INTERVAL)void check()}).catch(()=>setStatus('Could not save the update setting.'));
  };
  return <Updates.Provider value={{version,kind,automatic,release,pending,busy,status,check,setAutomatic}}>{children}</Updates.Provider>;
}
function available(state:UpdateState):string|undefined {
  const candidate=state.kind==='unpacked'||state.kind==='unknown'?state.release?.version:state.pending??state.release?.storeVersion;
  return candidate&&newerVersion(candidate,state.version)?candidate:undefined;
}
export function UpdateNotice({openHelp}:{openHelp:()=>void}) {
  const state=useUpdates(),version=available(state),[dismissed,setDismissed]=useState<string>();
  if(!version||version===dismissed)return null;
  return <aside className="update-notice" aria-label="Update available"><span role="status">Scrollout {version} is available.</span><button onClick={openHelp}>Update details</button><button aria-label="Dismiss update notice" onClick={()=>setDismissed(version)}>×</button></aside>;
}
export function UpdatesPanel() {
  const state=useUpdates(),latest=available(state),manual=state.kind==='unpacked'||state.kind==='unknown';
  return <section className="updates-panel" aria-labelledby="updates-title">
    <h3 id="updates-title">Updates</h3><p>Installed version {state.version}{state.kind==='unpacked'?' - loaded unpacked':state.kind==='managed'?' - managed by your organization':state.kind==='browser'?' - updated by Chrome':''}.</p>
    {latest?<p className="update-available">Version {latest} is available.</p>:state.release&&manual?<p>You have the latest downloadable release.</p>:null}
    {manual?<><p>{state.kind==='unknown'?'Chrome could not confirm this copy’s update source. For a packed or third-party build, use its publisher’s signed update source or switch to the official release. If you used Load unpacked, follow these steps:':'Chrome cannot replace files in an unpacked installation. To update:'}</p><ol><li>Export your open screenshots and close all Scrollout editors.</li><li>Download the latest ZIP, extract it, and replace the files in the same folder you originally loaded.</li><li>Open <code>chrome://extensions</code> and click Reload on Scrollout’s card.</li></ol>{state.release&&<><a className="secondary-button" href={downloadUrl(state.release.version)} target="_blank" rel="noopener noreferrer">Download version {state.release.version}</a><details><summary>Verify the download</summary><p className="update-hash">SHA-256: {state.release.sha256}</p></details></>}</>:<p>Chrome installs updates from your configured update source. Export your work, then close all Scrollout editors so a ready update can install. {state.kind==='managed'?'Your organization may control the available version.':'You can also open chrome://extensions, enable Developer mode, and choose Update to ask Chrome to check.'}</p>}
    {state.release?.storeUrl&&state.release.storeVersion&&!newerVersion(state.version,state.release.storeVersion)&&manual&&<p><a href={state.release.storeUrl} target="_blank" rel="noopener noreferrer">Install from the Chrome Web Store for automatic updates</a>. Export and close your work, then remove the unpacked copy to avoid duplicate icons.</p>}
    <div className="update-controls"><button className="secondary-button" disabled={state.busy} onClick={()=>void state.check(true)}>{state.busy?'Checking…':'Check for updates'}</button><label><input type="checkbox" checked={state.automatic} disabled={!isExtension()} onChange={e=>state.setAutomatic(e.target.checked)}/> Check releases automatically</label></div>
    {state.status&&<p role="status">{state.status}</p>}
    <p className="help-limit">Automatic release checks run at most every 12 hours while Scrollout is open. They request a small public version file from scrollout.farflash.com. Screenshots, edits, page URLs, and filenames are never sent. You can turn these checks off; Chrome’s own update system is separate.</p>
  </section>;
}
