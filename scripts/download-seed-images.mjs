import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const source = readFileSync('backend/prisma/seed-products.ts', 'utf8');
const ids = [...new Set([...source.matchAll(/image: '(photo-[^']+)'/g)].map(match => match[1]))];
const directory = 'backend/prisma/seed-assets';
mkdirSync(directory, { recursive: true });
for (const id of ids) {
  const path = `${directory}/${id}.jpg`;
  if (existsSync(path)) continue;
  let saved = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=85`, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const metadata = await sharp(bytes).metadata();
      if (!metadata.width || !metadata.height) throw new Error('Invalid image');
      writeFileSync(path, bytes);
      console.log(`Saved ${id}: ${bytes.length} bytes`);
      saved = true; break;
    } catch (error) { if (attempt === 2) console.error(`${id}: ${error.message}`); }
  }
  if (!saved) process.exitCode = 1;
}
