import {afterEach,describe,expect,it,vi} from 'vitest';
import {decodeScreenshot} from '../src/shared/png';
import {TileCache} from '../src/editor/renderer';
import type {ScreenshotTile} from '../src/shared/types';

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7X8AAAAASUVORK5CYII=';
afterEach(()=>vi.unstubAllGlobals());
describe('capture processing',()=>{
  it('reads native PNG dimensions without decompressing the image and preserves all bytes',async()=>{
    const bitmap=vi.fn();vi.stubGlobal('createImageBitmap',bitmap);
    const screenshot=decodeScreenshot(png);
    expect([screenshot.width,screenshot.height,screenshot.blob.type]).toEqual([1,1,'image/png']);
    expect(new Uint8Array(await screenshot.blob.arrayBuffer())).toEqual(Uint8Array.from(atob(png.split(',')[1]),c=>c.charCodeAt(0)));
    expect(bitmap).not.toHaveBeenCalled();
  });
  it('rejects malformed headers and impossible PNG dimensions before processing a tile',()=>{
    for(const data of ['data:image/jpeg;base64,AA==','data:image/png;base64,AA==','data:image/png;base64,%%%'])expect(()=>decodeScreenshot(data)).toThrow();
    const bytes=Uint8Array.from(atob(png.split(',')[1]),c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
    for(const [offset,value] of [[8,12],[12,0],[16,0],[20,0x80000000]]){const original=view.getUint32(offset);view.setUint32(offset,value);expect(()=>decodeScreenshot('data:image/png;base64,'+btoa(String.fromCharCode(...bytes)))).toThrow();view.setUint32(offset,original)}
  });
  it('decodes one native bitmap for shared panel fragments and keeps different captures separate',async()=>{
    const close=vi.fn(),decode=vi.fn(async()=>({width:100,height:100,close}));vi.stubGlobal('createImageBitmap',decode);
    const cache=new TileCache(),tile={id:'fragment-header',captureId:'capture',bitmapId:'capture:0',sequence:0,x:0,y:0,width:100,height:100,sourceX:0,sourceY:0,sourceWidth:100,sourceHeight:100,blob:new Blob()} satisfies ScreenshotTile;
    const [header,panel]=await Promise.all([cache.load(tile),cache.load({...tile,id:'fragment-panel',sequence:1})]);
    expect(header).toBe(panel);expect(decode).toHaveBeenCalledTimes(1);
    await cache.load({...tile,id:'other',bitmapId:'other:0'});expect(decode).toHaveBeenCalledTimes(2);
    cache.clear();expect(close).toHaveBeenCalledTimes(2);
  });
});
