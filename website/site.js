const image=document.querySelector('#tool-preview');
const label=document.querySelector('#tool-label');
const descriptions={annotate:'Draw, highlight, and add a clear point of view.',crop:'Keep the part you need. Undo whenever you like.',redact:'Cover sensitive areas with fully opaque black redaction.',export:'PNG, JPEG, PDF, or clipboard. Every format is free.'};
document.querySelectorAll('[data-preview]').forEach(button=>button.addEventListener('click',()=>{
 document.querySelectorAll('[data-preview]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
 const name=button.dataset.preview;
 image.srcset=[['640x400',640],['1280x800',1280],['2560x1600',2560]].map(([size,width])=>'/assets/'+name.replace('1280x800',size)+' '+width+'w').join(', ');
 image.src='/assets/'+name;image.alt=button.dataset.alt;label.textContent=descriptions[button.dataset.tool];
}));
