import { newerVersion, PENDING_UPDATE } from '../shared/updates';

export function registerBrowserUpdates(exclusive:(operation:()=>Promise<void>)=>Promise<unknown>=operation=>operation()) {
  let checking:Promise<unknown>|undefined;
  const applyWhenIdle=()=>checking??=exclusive(async()=>{
    try{
      const pending=(await chrome.storage.local.get(PENDING_UPDATE))[PENDING_UPDATE];
      if(typeof pending!=='string'||!newerVersion(pending,chrome.runtime.getManifest().version))return;
      if((await chrome.storage.session.get('activeCapture')).activeCapture)return;
      // Never reload an editor or a running capture to install an update.
      const contexts=await chrome.runtime.getContexts({contextTypes:['TAB','POPUP','SIDE_PANEL','OFFSCREEN_DOCUMENT']});
      if(!contexts.length)chrome.runtime.reload();
    }catch{/* A failed idle check must defer an update, never discard work. */}
  }).finally(()=>{checking=undefined});
  chrome.runtime.onUpdateAvailable.addListener(({version})=>{
    if(newerVersion(version,chrome.runtime.getManifest().version))void chrome.storage.local.set({[PENDING_UPDATE]:version}).then(applyWhenIdle).catch(()=>{});
  });
  chrome.runtime.onInstalled.addListener(()=>{void (async()=>{
    const pending=(await chrome.storage.local.get(PENDING_UPDATE))[PENDING_UPDATE];
    if(typeof pending!=='string'||!newerVersion(pending,chrome.runtime.getManifest().version))await chrome.storage.local.remove(PENDING_UPDATE);
  })().catch(()=>{})});
  chrome.tabs.onRemoved.addListener(()=>{void applyWhenIdle()});
  chrome.tabs.onUpdated.addListener((_id,change)=>{if(change.url||change.status==='complete')void applyWhenIdle()});
  void applyWhenIdle();
}
