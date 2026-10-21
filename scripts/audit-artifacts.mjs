import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { unzipSync } from 'fflate';

const permissions=['activeTab','scripting','storage','clipboardWrite'];
const releaseUrl='https://scrollout.farflash.com/releases.json';
const storeUrl='https://chromewebstore.google.com/detail/scrollout/ajlhmigmaeodaedpgjmngkchnjoenmkm';
let inspected=0;
function inspect(files,label) {
  const manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));
  assert.equal(manifest.manifest_version,3,label);
  assert.deepEqual(manifest.permissions,permissions,label);
  for(const field of ['host_permissions','optional_host_permissions','externally_connectable','web_accessible_resources','content_scripts'])assert.equal(manifest[field],undefined,`${label}: ${field}`);
  const csp=manifest.content_security_policy.extension_pages;
  const directives=new Map(csp.split(';').filter(s=>s.trim()).map(s=>{const [name,...values]=s.trim().split(/\s+/);return [name,values]}));
  for(const [directive,values] of [['default-src',["'self'"]],['script-src',["'self'"]],['object-src',["'none'"]],['frame-src',["'none'"]],['base-uri',["'none'"]],['form-action',["'none'"]]])assert.deepEqual(directives.get(directive),values,`${label}: ${directive}`);
  assert.ok(directives.has('connect-src'),`${label}: network policy missing`);
  assert.ok(directives.get('connect-src').every(s=>s==="'self'"||s===releaseUrl),`${label}: unexpected network destination`);
  assert.ok(!/unsafe-eval|https?:/.test(directives.get('script-src').join(' ')),`${label}: remote executable code`);
  for(const [name,bytes] of Object.entries(files)) {
    assert.ok(!name.startsWith('/')&&!name.includes('\\')&&!name.split('/').includes('..'),`${label}: unsafe archive path`);
    assert.ok(!/(^|\/)(\.env(?:\.|$)|\.git\/|node_modules\/)|\.(map|pem|key|p12|pfx)$/.test(name),`${label}: private/development file ${name}`);
    if(/\.(js|html)$/.test(name))assert.ok(!/@vite\/client|react-refresh|localhost:4173|127\.0\.0\.1:4173|\beval\s*\(|new Function\s*\(/.test(new TextDecoder().decode(bytes)),`${label}: development or dynamic-code artifact ${name}`);
  }
  inspected++;console.log(`${label}: restricted permissions, CSP, code and archive checks passed`);
}
async function collect(dir,prefix='',files={}) {
  for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
    assert.ok(!entry.isSymbolicLink(),`Unexpected symlink: ${entry.name}`);
    const name=prefix+entry.name;
    if(entry.isDirectory())await collect(path.join(dir,entry.name),name+'/',files);
    else files[name]=new Uint8Array(await fs.readFile(path.join(dir,entry.name)));
  }
  return files;
}
inspect(await collect('dist'),'verification build');
for(const name of (await fs.readdir('website/downloads')).filter(n=>/^Scrollout-[\d.]+\.zip$/.test(n))) {
  const bytes=await fs.readFile(path.join('website/downloads',name));
  assert.ok(bytes.length<10*1024*1024,'Unexpected extension package size');
  inspect(unzipSync(bytes),name);
}
const release=JSON.parse(await fs.readFile('website/releases.json','utf8'));
const bytes=await fs.readFile(`website/downloads/Scrollout-${release.version}.zip`);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),release.sha256,'Public ZIP checksum');
assert.equal(release.storeUrl,storeUrl,'Public store destination');
console.log(`${inspected} extension artifacts passed; published download metadata matches the ZIP.`);
