import { describe, expect, it } from 'vitest';
import { bounds, canSingleImage, captureScale, exportParts, hitTest, intersect, normalizeRect, resizeAnnotation, scrollPositions, translate } from '../src/shared/geometry';
import { safeFilename } from '../src/editor/export';
import type { Annotation } from '../src/shared/types';

const arrow:Annotation={id:'arrow',kind:'arrow',x:10,y:20,width:100,height:100,color:'#FF6359',opacity:1,strokeWidth:4,fontSize:32,points:[{x:10,y:20},{x:110,y:120}]};
describe('full-page geometry',()=>{
  it('covers short pages and overlapping final viewports without gaps',()=>{expect(scrollPositions(500,900)).toEqual([0]);expect(scrollPositions(2500,900)).toEqual([0,900,1600]);expect(scrollPositions(2700,900)).toEqual([0,900,1800])});
  it('covers every source pixel even with fractional CSS viewport sizes',()=>{const positions=scrollPositions(3017.5,811.25);let end=0;for(const p of positions){expect(p).toBeLessThanOrEqual(end);end=p+811.25}expect(end).toBe(3017.5)});
  it('preserves native zoom through rounded viewport metrics and falls back for emulated displays',()=>{
    expect(captureScale(898,742,{viewportWidth:718,viewportHeight:594,pixelRatio:1.25})).toEqual({x:1.25,y:1.25});
    expect(captureScale(1800,1400,{viewportWidth:900,viewportHeight:700,pixelRatio:2})).toEqual({x:2,y:2});
    expect(captureScale(900,700,{viewportWidth:900,viewportHeight:700,pixelRatio:2})).toEqual({x:1,y:1});
  });
  it('normalizes reverse crops and clips them to existing crops',()=>{expect(normalizeRect({x:200,y:100},{x:20,y:40})).toEqual({x:20,y:40,width:180,height:60});expect(intersect({x:10,y:10,width:100,height:100},{x:30,y:30,width:100,height:100})).toEqual({x:30,y:30,width:80,height:80})});
  it('moves and resizes paths in original pixels without mutating history',()=>{const moved=translate(arrow,20,-10);expect(moved.points![0]).toEqual({x:30,y:10});expect(arrow.points![0]).toEqual({x:10,y:20});const resized=resizeAnnotation(arrow,{x:20,y:30,width:200,height:50});expect(resized.points!.at(-1)).toEqual({x:220,y:80});expect(bounds(resized)).toEqual({x:20,y:30,width:200,height:50})});
  it('selects diagonal paths by their stroke rather than their bounding box',()=>{expect(hitTest(arrow,{x:60,y:70},3)).toBe(true);expect(hitTest(arrow,{x:15,y:110},3)).toBe(false)});
  it('splits oversized exports with complete, nonoverlapping coverage',()=>{const crop={x:17,y:29,width:19000,height:18000};const parts=exportParts(crop);expect(parts.reduce((sum,r)=>sum+r.width*r.height,0)).toBe(crop.width*crop.height);for(const part of parts)expect(canSingleImage(part.width,part.height)).toBe(true);expect(parts[0].x).toBe(17);expect(parts[0].y).toBe(29);for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){const r=intersect(parts[i],parts[j]);expect(r.width*r.height).toBe(0)}});
  it('rejects unsafe single images and keeps filenames filesystem-safe',()=>{expect(canSingleImage(1440,5200)).toBe(true);expect(canSingleImage(1440,50000)).toBe(false);expect(canSingleImage(0,10)).toBe(false);expect(safeFilename('notes:/bad?*')).toBe('notesbad');expect(safeFilename('..')).toBe('Scrollout screenshot')});
});
