// Builds the favicon set from the compass mark in the site logo.
// Run from site/: npm i --no-save sharp@0.34.5 && node scripts/build-icons.mjs. Outputs are committed, so a normal build does not need it.
import { writeFileSync } from 'node:fs';
import sharp from 'sharp';

const NAVY = '#0B1F33';
const BRASS = '#C8A24A';

// Same mark as CompassMark.astro, simplified to read at 16 px: one colour, thicker ring, wider needle.
// `scale` shrinks the mark inside the square (maskable icons need a safe zone).
function svg({ rx = 6, scale = 1 } = {}) {
  const t = `translate(16 16) scale(${scale}) translate(-16 -16)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="${rx}" fill="${NAVY}"/><g transform="${t}"><circle cx="16" cy="16" r="11.25" fill="none" stroke="${BRASS}" stroke-width="2.5"/><path d="M16 2.5 20 16 16 29.5 12 16Z" fill="${BRASS}"/><path d="M2.5 16 16 13 29.5 16 16 19Z" fill="${BRASS}" opacity="0.6"/><circle cx="16" cy="16" r="1.75" fill="${NAVY}"/></g></svg>`;
}

const out = 'public';
const png = (s, size) => sharp(Buffer.from(s), { density: 72 * (size / 32) * 4 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

writeFileSync(`${out}/favicon.svg`, svg());

const files = {};
for (const size of [16, 32, 48, 96, 192, 512]) files[size] = await png(svg(), size);
for (const size of [48, 96, 192, 512]) writeFileSync(`${out}/favicon-${size}.png`, files[size]);
// Apple applies its own rounded mask: use a square background.
writeFileSync(`${out}/apple-touch-icon.png`, await png(svg({ rx: 0 }), 180));
// Maskable: full-bleed background, mark inside the central 80% safe zone.
writeFileSync(`${out}/icon-maskable-512.png`, await png(svg({ rx: 0, scale: 0.78 }), 512));

// ICO with PNG-encoded entries (supported by every current browser and by Windows Vista onwards).
const sizes = [16, 32, 48];
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((size, i) => {
  const e = 6 + 16 * i;
  header.writeUInt8(size, e);
  header.writeUInt8(size, e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(files[size].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += files[size].length;
});
writeFileSync(`${out}/favicon.ico`, Buffer.concat([header, ...sizes.map((s) => files[s])]));

const manifest = {
  name: 'LNG Toolkit',
  short_name: 'LNG Toolkit',
  description: 'US LNG netback calculator and EU gas storage winter stress test.',
  start_url: '/',
  scope: '/',
  display: 'browser',
  background_color: '#F4F1EA',
  theme_color: NAVY,
  icons: [
    { src: '/favicon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/favicon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};
writeFileSync(`${out}/site.webmanifest`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('icons written');
