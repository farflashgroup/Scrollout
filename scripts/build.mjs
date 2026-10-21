import fs from 'node:fs/promises';
import path from 'node:path';
import { build as viteBuild } from 'vite';
import { build as bundle } from 'esbuild';
import { zipSync } from 'fflate';

const {version}=JSON.parse(await fs.readFile('package.json','utf8'));
// Validation builds must never replace an already published version's ZIP.
const verifyOnly=process.argv.includes('--verify');
const manifest=JSON.parse(await fs.readFile('public/manifest.json','utf8'));
if(manifest.version!==version)throw new Error('Package and manifest versions must match.');

await import('./brand.mjs');
await fs.mkdir('public/licenses',{recursive:true});
for(const name of ['react','react-dom','lucide-react','fflate','pdf-lib','@fontsource-variable/inter']) {
  const dir=path.join('node_modules',name),files=await fs.readdir(dir),license=files.find(file=>/^LICENSE(?:\.txt|\.md)?$/i.test(file));
  if(license)await fs.copyFile(path.join(dir,license),path.join('public/licenses',name.replaceAll('/','-')+'.txt'));
}
await viteBuild();
await bundle({ entryPoints:['src/extension/background.ts'],outfile:'dist/background.js',bundle:true,format:'esm',target:'chrome120',minify:true });
await bundle({ entryPoints:['src/extension/content.ts'],outfile:'dist/content.js',bundle:true,format:'iife',target:'chrome120',minify:true });
for(const guide of ['INSTALL.md','BRAND.md','THIRD_PARTY_NOTICES.md','LICENSE'])await fs.copyFile(guide,path.join('dist',guide));
if(verifyOnly){console.log('Verified build ready in dist/; published archives were preserved.');process.exit(0)}
const entries={};
async function collect(dir, prefix='', target=entries) {
  for (const item of await fs.readdir(dir,{withFileTypes:true})) {
    const rel = prefix + item.name;
    if(item.isDirectory()) await collect(path.join(dir,item.name),rel+'/',target);
    else target[rel]=new Uint8Array(await fs.readFile(path.join(dir,item.name)));
  }
}
await collect('dist');
await fs.mkdir('release',{recursive:true});
await fs.writeFile(`release/Scrollout-${version}.zip`,zipSync(entries,{level:6}));
const sourceEntries={};
for(const dir of ['src','public','scripts','tests','store','website'])await collect(dir,dir+'/',sourceEntries);
for(const file of ['package.json','package-lock.json','editor.html','tsconfig.json','vite.config.ts','playwright.config.ts','.gitignore','README.md','INSTALL.md','BRAND.md','THIRD_PARTY_NOTICES.md','LICENSE','CONTRIBUTING.md','SECURITY.md'])sourceEntries[file]=new Uint8Array(await fs.readFile(file));
await fs.writeFile(`release/Scrollout-${version}-source.zip`,zipSync(sourceEntries,{level:6}));
console.log(`Ready: dist/, release/Scrollout-${version}.zip, and release/Scrollout-${version}-source.zip`);
