import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { chromium } from '@playwright/test';

// Read-only probes are deliberately limited to Scrollout's own public site.
const origin='https://scrollout.farflash.com';
const evidence=process.env.SCROLLOUT_QA_EVIDENCE_DIR||path.join(os.tmpdir(),'scrollout-security');
await fs.mkdir(evidence,{recursive:true});
let checks=0;
function check(ok,message){assert.ok(ok,message);checks++}
const request=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(15000)});
const transport=[];
for(const version of ['TLSv1','TLSv1.1','TLSv1.2','TLSv1.3']) {
  const result=await new Promise(resolve=>{
    const socket=tls.connect({host:'scrollout.farflash.com',port:443,servername:'scrollout.farflash.com',minVersion:version,maxVersion:version,rejectUnauthorized:true,...(['TLSv1','TLSv1.1'].includes(version)?{ciphers:'DEFAULT:@SECLEVEL=0'}:{})},()=>{
      const certificate=socket.getPeerCertificate();resolve({requested:version,accepted:true,authorized:socket.authorized,cipher:socket.getCipher().standardName,expires:certificate.valid_to});socket.end();
    });
    socket.setTimeout(10000,()=>socket.destroy(Error('timeout')));
    socket.on('error',error=>resolve({requested:version,accepted:false,error:error.code||error.message}));
  });
  transport.push(result);
  if(version==='TLSv1'||version==='TLSv1.1')check(!result.accepted&&result.error==='ERR_SSL_TLSV1_ALERT_PROTOCOL_VERSION',`${version}: expected a server protocol-version rejection`);
  else check(result.accepted&&result.authorized,`${version}: certificate or connection failure`);
}
const insecure=await request('http://scrollout.farflash.com/',{redirect:'manual'});
check(insecure.status===308&&insecure.headers.get('location')===origin+'/','HTTP must redirect to HTTPS');
for(const route of ['/','/privacy/','/support/','/guides/','/press/']) {
  const response=await request(origin+route);check(response.status===200,route);
  for(const [name,value] of [['x-content-type-options','nosniff'],['x-frame-options','DENY']])check(response.headers.get(name)===value,`${route}: ${name}`);
  check(Number(response.headers.get('strict-transport-security')?.match(/max-age=(\d+)/)?.[1])>=31536000,`${route}: HSTS`);
  const csp=response.headers.get('content-security-policy')||'';
  for(const directive of ["script-src 'self'","connect-src 'none'","object-src 'none'","base-uri 'none'","form-action 'none'","frame-ancestors 'none'"])check(csp.includes(directive),`${route}: ${directive}`);
  check(!/unsafe-inline|unsafe-eval/.test(csp),`${route}: permissive CSP`);
  check(!response.headers.has('set-cookie'),`${route}: unexpected cookies`);
}
for(const route of ['/.env','/.git/config','/package.json','/vercel.json','/store/START-HERE.html','/site-config.json','/privacy/content.json','/src/extension/background.ts','/node_modules/vite/package.json','/phpinfo.php','/api/health'])check([403,404].includes((await request(origin+route)).status),`Private or nonexistent endpoint exposed: ${route}`);
const alias=await request('https://scrollout-five.vercel.app/privacy/?security-check=1',{redirect:'manual'});
check(alias.status===308&&alias.headers.get('location')===origin+'/privacy/?security-check=1','Public alias must redirect with path and query');
const releaseResponse=await request(origin+'/releases.json');const release=await releaseResponse.json();
check(releaseResponse.headers.get('cache-control')?.includes('no-store'),'Release metadata must not be cached');
check(releaseResponse.headers.get('access-control-allow-origin')==='*','Public release metadata CORS');
check(JSON.stringify(release)===JSON.stringify(JSON.parse(await fs.readFile('website/releases.json','utf8'))),'Live release metadata differs from reviewed source');
const zip=Buffer.from(await (await request(`${origin}/downloads/Scrollout-${release.version}.zip`)).arrayBuffer());
check(crypto.createHash('sha256').update(zip).digest('hex')===release.sha256,'Live ZIP checksum mismatch');
const browser=await chromium.launch({channel:'chromium',headless:true});
try {
  for(const width of [390,1440]) {
    const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
    const external=[],errors=[];
    await page.route('**/*',route=>{if(new URL(route.request().url()).origin===origin)return route.continue();external.push(route.request().url());return route.abort()});
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);check((await page.title()).includes('Scrollout'),'Page identity');
    check(await page.getByRole('heading',{level:1}).isVisible(),'Meaningful page rendered');
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}px`);
    await page.getByRole('button',{name:'Redact',exact:true}).click();
    check((await page.locator('#tool-preview').getAttribute('src')).includes('redact'),'Tool preview responds');
    await page.getByRole('link',{name:/^Get Scrollout for Chrome/}).click();await page.locator('#install').scrollIntoViewIfNeeded();
    check(await page.getByRole('link',{name:/^Add Scrollout to Chrome/}).getAttribute('href')===release.storeUrl,'Installation destination');
    await page.screenshot({path:path.join(evidence,`secure-site-${width}.png`)});
    await page.evaluate(()=>{
      window.__securityViolations=[];
      document.addEventListener('securitypolicyviolation',event=>window.__securityViolations.push(event.effectiveDirective));
      const script=document.createElement('script');script.textContent='window.__securityInjected=true';document.body.append(script);
      const image=document.createElement('img');image.src='https://example.invalid/scrollout-security-canary';document.body.append(image);
      void fetch('https://example.invalid/scrollout-security-canary').catch(()=>{});
    });
    for(let attempt=0;attempt<30;attempt++){if((await page.evaluate(()=>window.__securityViolations.length))>=3)break;await new Promise(resolve=>setTimeout(resolve,50))}
    const violations=await page.evaluate(()=>window.__securityViolations);
    for(const directive of ['script-src-elem','img-src','connect-src'])check(violations.includes(directive),`${directive} was not blocked`);
    check(await page.evaluate(()=>window.__securityInjected===undefined),'Inline script executed');
    check(!external.length,`Unexpected external requests: ${external.join(', ')}`);
    check(!errors.length,`Runtime errors: ${errors.join(', ')}`);await page.close();
  }
} finally {await browser.close()}
const result={checkedAt:new Date().toISOString(),origin,node:process.version,checks,transport,viewports:[390,1440],browserFallback:'Browser plugin not available; regular Playwright used for owned-site validation.'};
await fs.writeFile(path.join(evidence,'live-security.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
