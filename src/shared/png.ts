// captureVisibleTab returns a PNG data URL. Its IHDR contains the native bitmap
// dimensions, so the worker need not decompress every screenshot just to size it.
export function decodeScreenshot(data:string):{blob:Blob;width:number;height:number} {
  const prefix='data:image/png;base64,';
  if(!data.startsWith(prefix))throw new Error('Chrome returned an invalid screenshot. Try capturing again.');
  const binary=atob(data.slice(prefix.length)),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  const view=new DataView(bytes.buffer);
  if(bytes.length<33||view.getUint32(0)!==0x89504e47||view.getUint32(4)!==0x0d0a1a0a||view.getUint32(8)!==13||view.getUint32(12)!==0x49484452)throw new Error('Chrome returned an invalid PNG header. Try capturing again.');
  const width=view.getUint32(16),height=view.getUint32(20);
  if(!width||!height||width>0x7fffffff||height>0x7fffffff)throw new Error('Chrome returned invalid screenshot dimensions. Try capturing again.');
  return {blob:new Blob([bytes],{type:'image/png'}),width,height};
}
