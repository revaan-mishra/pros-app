import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(resolve(root, 'public/licenses/asset-manifest.json'), 'utf8'));
let total = 0;
for (const asset of manifest.assets) {
  if (!asset.file.startsWith('/art/kenney/') && !asset.file.startsWith('/audio/')) throw new Error(`Unexpected asset path: ${asset.file}`);
  const file = resolve(root, 'public', `.${asset.file}`);
  const data = await readFile(file);
  const hash = createHash('sha256').update(data).digest('hex');
  if (data.length !== asset.bytes || hash !== asset.sha256) throw new Error(`Asset differs from the credited source download: ${asset.file}`);
  if (asset.license !== 'CC0-1.0' || !asset.author || !asset.source.startsWith('https://')) throw new Error(`Missing source/license: ${asset.file}`);
  total += data.length;
}
for (const file of ['public/art/arrival.webp', 'public/art/sanctuary.webp', 'public/art/archive.webp', 'public/licenses/THIRD-PARTY.txt', 'public/licenses/kenney-cartography.txt']) {
  if (!(await stat(resolve(root, file))).isFile()) throw new Error(`Missing required asset: ${file}`);
}
const originals = JSON.parse(await readFile(resolve(root, 'public/licenses/original-artwork.json'), 'utf8'));
for (const asset of originals.assets) {
  if (!/^\/art\/(home|atelier|atelier-flourish|observatory|foundry|training|citadel|sanctuary-base|olive)\.webp$/.test(asset.file)) throw new Error(`Unexpected original artwork path: ${asset.file}`);
  const data = await readFile(resolve(root, 'public', `.${asset.file}`));
  if (data.length !== asset.bytes || createHash('sha256').update(data).digest('hex') !== asset.sha256) throw new Error(`Original artwork integrity check failed: ${asset.file}`);
  if (!asset.prompt || !asset.focalPoint || !asset.fallback) throw new Error(`Original artwork production brief missing: ${asset.file}`);
}
console.log(`${manifest.assets.length} credited source assets verified · ${(total / 1024 / 1024).toFixed(1)} MiB · ${originals.assets.length} original artworks verified`);
