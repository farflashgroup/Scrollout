import fs from 'node:fs/promises';
import sharp from 'sharp';
import { create } from 'fontkit';
import { zipSync } from 'fflate';
import { createHash } from 'node:crypto';

const out = 'website/assets/press';
await fs.mkdir(out, { recursive: true });
const font = create(await fs.readFile('node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2'));
const inner = s => s.replace(/^.*?<svg[^>]*>/s, '').replace(/<\/svg>\s*$/, '');
const logo = inner(await fs.readFile('public/brand/lockup.svg', 'utf8'));
const shot = (await fs.readFile('store/assets/02-annotate-1280x800.png')).toString('base64');
function text(value, x, y, size, color = '#17212B') {
  let advance = 0;
  const scale = size / font.unitsPerEm;
  const run = font.layout(value);
  return `<g fill="${color}">` + run.glyphs.map((glyph, i) => {
    const pos = run.positions[i];
    const path = `<path transform="translate(${x + (advance + pos.xOffset) * scale} ${y - pos.yOffset * scale}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
    advance += pos.xAdvance;
    return path;
  }).join('') + '</g>';
}
const screenshot = (x, y, width) => `<rect x="${x - 12}" y="${y - 12}" width="${width + 24}" height="${width * 5 / 8 + 24}" rx="14" fill="#FFFFFF" stroke="#C9DCD5"/><image x="${x}" y="${y}" width="${width}" height="${width * 5 / 8}" href="data:image/png;base64,${shot}"/>`;
const artwork = [
  ['launch-landscape', 1200, 630, `<svg x="64" y="44" width="310" height="86" viewBox="-7 -7 440 122">${logo}</svg>${text('Capture the whole', 64, 235, 46)}${text('page. Make it yours.', 64, 295, 46)}<path d="M67 330H277" stroke="#FF6359" stroke-width="8" stroke-linecap="round"/>${text('Free, open source,', 64, 410, 23, '#0B8F78')}${text('and completely local', 64, 446, 23, '#0B8F78')}${text('scrollout.farflash.com', 64, 560, 19)}${screenshot(610, 142, 526)}`],
  ['launch-square', 1080, 1080, `<svg x="64" y="44" width="350" height="97" viewBox="-7 -7 440 122">${logo}</svg>${text('Capture the whole page.', 64, 245, 58)}${text('Make it yours.', 64, 322, 58, '#0B8F78')}${text('Free, open source, and completely local', 64, 390, 24)}${screenshot(64, 448, 952)}`],
  ['launch-portrait', 1080, 1350, `<svg x="64" y="64" width="390" height="108" viewBox="-7 -7 440 122">${logo}</svg>${text('Capture the', 64, 302, 76)}${text('whole page.', 64, 397, 76)}${text('Make it yours.', 64, 492, 76, '#0B8F78')}${screenshot(64, 580, 952)}${text('Free, open source, and completely local', 64, 1254, 24)}${text('scrollout.farflash.com', 64, 1301, 20, '#0B8F78')}`]
];
const files = {};
const manifest = [];
for (const [name, width, height, content] of artwork) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#EDF4F1"/>${content}</svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  await fs.writeFile(`${out}/${name}.svg`, svg);
  await fs.writeFile(`${out}/${name}.png`, png);
  files[`artwork/${name}.svg`] = Buffer.from(svg);
  files[`artwork/${name}.png`] = png;
  manifest.push({ name: name + '.png', width, height, bytes: png.length, sha256: createHash('sha256').update(png).digest('hex') });
}
for (const name of (await fs.readdir('public/brand')).filter(n => /\.(svg|png|txt)$/.test(n))) files['brand/' + name] = await fs.readFile('public/brand/' + name);
for (const name of (await fs.readdir('store/assets')).filter(n => /^0\d.*\.png$/.test(n))) files['screenshots/' + name] = await fs.readFile('store/assets/' + name);
const notes = `Scrollout press assets\n\nPublisher: FarFlash Group Ltd.\nWebsite: https://scrollout.farflash.com\nContact: scrollout@farflash.com\nSource: https://github.com/farflashgroup/Scrollout (MIT)\n\nUse the logo unchanged with clear space of at least one-quarter of the symbol width. The teal is #0B8F78. Artwork uses the approved logo and outlined locally bundled Inter glyphs. Inter retains its SIL Open Font License. Editor screenshots were captured from Scrollout's actual interface, using illustrative Fieldnotes example content. No customer endorsement is implied.\n\nCopy: Free, open source, and completely local\nTagline: Capture the whole page. Make it yours.\n\nCapture and editing happen on your device; screenshots never upload to FarFlash. Export before closing the last temporary editor. Desktop Chrome 120+. Current installation instructions and availability: https://scrollout.farflash.com/#install\n\nDo not imply endorsement, fabricate reviews, or portray illustrative page content as customer work.\n`;
files['USAGE.txt'] = Buffer.from(notes);
files['LICENSE.txt'] = await fs.readFile('LICENSE');
await fs.writeFile(`${out}/Scrollout-press-kit.zip`, zipSync(files));
await fs.mkdir('marketing', { recursive: true });
await fs.writeFile('marketing/asset-manifest.json', JSON.stringify({ preparedOn: '2026-10-20', provenance: 'Approved unmodified SVG logo; real editor screenshot from store/assets; locally bundled Inter outlined through Fontkit; deterministic SVG and Sharp exports.', exports: manifest }, null, 2) + '\n');
console.log('Three launch artworks and public press kit generated.');
