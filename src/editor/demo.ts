import type { CaptureSession, ScreenshotTile } from '../shared/types';

// A dev-only document for checking the editor. Never loaded in the extension.
export async function demo():Promise<{session:CaptureSession;tiles:ScreenshotTile[]}> {
  await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=1440;canvas.height=5200;const ctx=canvas.getContext('2d')!;
  ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,1440,5200);ctx.fillStyle='#17212B';ctx.font='600 30px "Inter Variable"';ctx.fillText('FIELDNOTES',104,100);ctx.font='400 22px "Inter Variable"';ctx.fillText('Articles      About',1060,100);
  ctx.textAlign='center';ctx.font='700 88px "Inter Variable"';ctx.fillText('Small details.',720,360);ctx.fillText('Better products.',720,460);ctx.fillStyle='#66707B';ctx.font='400 30px "Inter Variable"';ctx.fillText('Thoughts on design, work, and the little things',720,550);ctx.fillText('that make a big difference.',720,596);
  // Real editorial content, intentionally distinct from the concept's example photo.
  ctx.textAlign='left';ctx.fillStyle='#EDF2F5';ctx.fillRect(104,680,1232,620);ctx.strokeStyle='#0B8F78';ctx.lineWidth=12;ctx.beginPath();ctx.moveTo(320,1050);ctx.bezierCurveTo(480,740,700,1270,1100,880);ctx.stroke();ctx.fillStyle='#0B8F78';ctx.font='600 60px "Inter Variable"';ctx.fillText('Make room for good ideas.',220,850);ctx.font='400 30px "Inter Variable"';ctx.fillText('An exercise in noticing what matters.',220,925);
  const sections=['A little clarity goes a long way.','Start with what matters.','Give your work some space.','Make it yours.'];
  sections.forEach((title,i)=>{const y=1460+i*850;ctx.fillStyle='#17212B';ctx.font='700 48px "Inter Variable"';ctx.fillText(title,104,y);ctx.fillStyle='#66707B';ctx.font='400 30px "Inter Variable"';['Good products start with a clear understanding of what people','need. Design is not about adding more. It is about removing what','gets in the way.','', 'In a noisy world, clarity is a competitive advantage. The simpler','something feels, the harder it often was to make.'].forEach((line,j)=>ctx.fillText(line,104,y+80+j*48));ctx.fillStyle=i%2?'#DBEEE9':'#EDF2F5';ctx.fillRect(104,y+440,1232,260)});
  const blob=await new Promise<Blob>(resolve=>canvas.toBlob(b=>resolve(b!),'image/png'));
  const id='development-preview',createdAt=Date.now();return {session:{id,status:'ready',progress:100,sourceTitle:'Design notes',sourceHost:'example.com',sourceTabId:0,sourceWindowId:0,createdAt,editorTabIds:[],document:{width:1440,height:5200,crop:{x:0,y:0,width:1440,height:5200},annotations:[],filename:'Design notes',sourceHost:'example.com',createdAt}},tiles:[{id:'demo:0',captureId:id,sequence:0,x:0,y:0,width:1440,height:5200,sourceX:0,sourceY:0,sourceWidth:1440,sourceHeight:5200,blob}]};
}
