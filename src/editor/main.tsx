import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles.css';
import { App } from './App';
import { isExtension } from '../shared/types';
import { isEditorUrl } from '../shared/messages';

// Register before React mounts, so navigation cleanup can identify a reloaded
// editor without adding permission to read every browser tab's URL.
if(isExtension())chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type==='EDITOR_CHECK'&&sender.id===chrome.runtime.id)respond({ok:typeof message.id==='string'&&isEditorUrl(location.href,message.id,chrome.runtime.getURL('editor.html'))});
});

createRoot(document.getElementById('root')!).render(<App/>);
