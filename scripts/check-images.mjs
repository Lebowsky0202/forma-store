import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const response = await fetch('http://127.0.0.1:4000/api/products?limit=48');
if (!response.ok) throw new Error(`Products API failed: ${response.status}`);
const { items } = await response.json();
mkdirSync('.local/image-review', { recursive: true });
const results = await Promise.all(items.map(async (product, index) => {
  const source = product.images[0]?.url;
  try {
    const imageUrl = source.startsWith('/') ? `http://127.0.0.1:4000${source}` : source.replace('w=900', 'w=300');
    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imageResponse.ok) throw new Error(`HTTP ${imageResponse.status}`);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const thumbnail = await sharp(buffer).resize(200, 245, { fit: 'cover' }).toBuffer();
    const title = `${index + 1}. ${product.slug}`;
    const label = Buffer.from(`<svg width="200" height="35"><rect width="200" height="35" fill="white"/><text x="6" y="21" font-family="Arial" font-size="10">${title.replaceAll('&', '&amp;')}</text></svg>`);
    const tile = await sharp({ create: { width: 200, height: 280, channels: 3, background: 'white' } }).composite([{ input: thumbnail, top: 0, left: 0 }, { input: label, top: 245, left: 0 }]).png().toBuffer();
    return { product: product.slug, source, ok: true, tile };
  } catch (error) { return { product: product.slug, source, ok: false, error: error.message }; }
}));
const tiles = results.filter(result => result.ok);
if (tiles.length) await sharp({ create: { width: 800, height: Math.ceil(tiles.length / 4) * 280, channels: 3, background: 'white' } })
  .composite(tiles.map((result, index) => ({ input: result.tile, top: Math.floor(index / 4) * 280, left: (index % 4) * 200 })))
  .png().toFile('.local/image-review/contact-sheet.png');
const report = results.map(({ tile, ...result }) => result);
writeFileSync('.local/image-review/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (results.some(result => !result.ok)) process.exitCode = 1;
