import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const src = process.argv[2] || path.join(
  process.env.USERPROFILE || '',
  '.cursor/projects/c-Users-schee-Desktop-chantiertrack-v2/assets/c__Users_schee_AppData_Roaming_Cursor_User_workspaceStorage_21a385b5b0a323263626ecbf3b90b8dc_images_logo_jobsitepro-f4febb1d-a434-4cb8-926d-8e354b8c6c5b.png',
);

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.error('Installez sharp: npm install sharp --prefix scripts');
  process.exit(1);
}

const meta = await sharp(src).metadata();
const w = meta.width;
const h = meta.height;
const side = Math.min(w, Math.floor(h * 0.42));
const left = Math.max(0, Math.floor(w / 2 - side / 2));
const top = Math.max(0, Math.floor(h * 0.08));
const icon = sharp(src).extract({ left, top, width: side, height: side });

const bases = [
  path.join(root, 'patron'),
  path.join(root, 'employe'),
];

for (const size of [192, 512, 180]) {
  const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  const buf = await icon.clone().resize(size, size).png().toBuffer();
  for (const b of bases) {
    fs.writeFileSync(path.join(b, name), buf);
    console.log('wrote', path.join(b, name));
  }
}

const bannerBuf = await sharp(src).resize({ width: 1200 }).png().toBuffer();
for (const b of bases) {
  fs.writeFileSync(path.join(b, 'logo-banner.png'), bannerBuf);
  console.log('wrote', path.join(b, 'logo-banner.png'));
}

console.log('done', w, 'x', h);
