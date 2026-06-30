import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public', { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#5a63d8"/>
  <rect x="146" y="146" width="220" height="220" rx="46" fill="#ffffff"/>
  <path d="M196 262 L238 304 L322 212" fill="none" stroke="#5a63d8" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const buf = Buffer.from(svg);

await sharp(buf).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(buf).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(buf).resize(180, 180).png().toFile('public/apple-touch-icon.png');

console.log('icons generated');
