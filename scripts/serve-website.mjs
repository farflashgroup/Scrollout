import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('website');
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.zip':'application/zip','.json':'application/json','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
const config=JSON.parse(await fs.readFile(path.join(root,'vercel.json'),'utf8'));
const headers=Object.fromEntries(config.headers[0].headers.map(h=>[h.key,h.value]));
http.createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1:4174').pathname);let file=path.resolve(root,'.'+pathname);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);return res.end()};let stat=await fs.stat(file).catch(()=>null);if(stat?.isDirectory()){if(!pathname.endsWith('/')){res.writeHead(308,{Location:pathname+'/'});return res.end()};file=path.join(file,'index.html')}const data=await fs.readFile(file);res.writeHead(200,{...headers,'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)}catch{res.writeHead(404);res.end('Page not found')}}).listen(4174,'127.0.0.1',()=>console.log('Scrollout website: http://127.0.0.1:4174/'));
