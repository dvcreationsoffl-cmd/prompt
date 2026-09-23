import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';

const outDir = path.resolve('Frontend', 'icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Generate icon.svg
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <linearGradient id="capGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.45" />
    </filter>
  </defs>

  <!-- Background Canvas -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />

  <!-- Inner Badge / Shield Ring -->
  <circle cx="256" cy="256" r="190" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="4" stroke-dasharray="8 8" />

  <!-- Graduation Cap & Scroll Graphic -->
  <g filter="url(#shadow)" transform="translate(256, 256)">
    <!-- Mortarboard Top Rhombus -->
    <path d="M 0 -72 L 144 -12 L 0 48 L -144 -12 Z" fill="url(#capGrad)" stroke="#ffffff" stroke-width="6" stroke-linejoin="round" />
    
    <!-- Cap Under Skull Arc -->
    <path d="M -80 14 C -80 76, 80 76, 80 14" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" />
    <path d="M -80 14 L -80 50 C -80 94, 80 94, 80 50 L 80 14 Z" fill="#065f46" opacity="0.85" />
    
    <!-- Tassel Ribbon & Drop -->
    <path d="M 0 -12 L -116 28 L -116 92" fill="none" stroke="#fcd34d" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="-116" cy="98" r="8" fill="#fbbf24" />
    
    <!-- Star/Pinnacle Dot -->
    <circle cx="0" cy="-12" r="7" fill="#ffffff" />
  </g>
  
  <!-- Subtitle Tag -->
  <text x="256" y="420" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="800" fill="#a7f3d0" letter-spacing="4" text-anchor="middle">CAMPUSCONNECT</text>
</svg>`;

fs.writeFileSync(path.join(outDir, 'icon.svg'), svgContent, 'utf8');
console.log('Created Frontend/icons/icon.svg');

// 2. Programmatic PNG generator
function generateIconPNG(size, isMaskable = false) {
  const png = new PNG({ width: size, height: size });
  const scale = size / 512;

  // Background gradient: from #0f172a (15, 23, 42) to #047857 (4, 120, 87)
  const r1 = 15, g1 = 23, b1 = 42;
  const r2 = 4, g2 = 120, b2 = 87;

  // If maskable, no rounded corner clipping (full-bleed background for Android safe-zone)
  const cornerRadius = isMaskable ? 0 : size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;

      // Check rounded corner clip if not maskable
      let inside = true;
      if (!isMaskable) {
        let dx = 0, dy = 0;
        if (x < cornerRadius) dx = cornerRadius - x;
        else if (x > size - cornerRadius) dx = x - (size - cornerRadius);
        if (y < cornerRadius) dy = cornerRadius - y;
        else if (y > size - cornerRadius) dy = y - (size - cornerRadius);

        if (dx > 0 && dy > 0) {
          if (dx * dx + dy * dy > cornerRadius * cornerRadius) {
            inside = false;
          }
        }
      }

      if (!inside) {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
        continue;
      }

      // Background gradient
      const t = (x + y) / (size * 2);
      const bgR = Math.round(r1 + (r2 - r1) * t);
      const bgG = Math.round(g1 + (g2 - g1) * t);
      const bgB = Math.round(b1 + (b2 - b1) * t);

      png.data[idx] = bgR;
      png.data[idx + 1] = bgG;
      png.data[idx + 2] = bgB;
      png.data[idx + 3] = 255;
    }
  }

  // Draw Icon Centerpiece (Mortarboard Cap)
  // Maskable icons get a scale factor of 0.75 to sit comfortably inside the central 80% safe zone
  const safeScale = isMaskable ? 0.75 : 0.88;
  const cx = size / 2;
  const cy = isMaskable ? size / 2 : size * 0.48;

  // Mortarboard rhombus vertices relative to center
  const rw = 144 * scale * safeScale;
  const rh1 = 72 * scale * safeScale;
  const rh2 = 48 * scale * safeScale;

  // Draw Rhombus: Top (cx, cy - rh1), Right (cx + rw, cy - 12*scale*safeScale), Bottom (cx, cy + rh2), Left (cx - rw, cy - 12*scale*safeScale)
  const topY = cy - rh1;
  const rightX = cx + rw;
  const rightY = cy - 12 * scale * safeScale;
  const botY = cy + rh2;
  const leftX = cx - rw;
  const leftY = cy - 12 * scale * safeScale;

  // Fill rhombus with vibrant emerald (#10b981 to #34d399)
  const minY = Math.floor(topY);
  const maxY = Math.ceil(botY);

  for (let y = minY; y <= maxY; y++) {
    if (y < 0 || y >= size) continue;

    // Calculate left and right bounds for this scanline
    let xL, xR;
    if (y < rightY) {
      // Top half
      const tY = (y - topY) / (rightY - topY);
      xL = cx - rw * tY;
      xR = cx + rw * tY;
    } else {
      // Bottom half
      const tY = (y - rightY) / (botY - rightY);
      xL = leftX + (cx - leftX) * tY;
      xR = rightX + (cx - rightX) * tY;
    }

    const minX = Math.floor(Math.min(xL, xR));
    const maxX = Math.ceil(Math.max(xL, xR));

    for (let x = minX; x <= maxX; x++) {
      if (x < 0 || x >= size) continue;
      const idx = (size * y + x) << 2;

      // Emerald fill
      const gradT = (x - leftX) / (2 * rw);
      const fR = Math.round(16 + (52 - 16) * gradT);
      const fG = Math.round(185 + (211 - 185) * gradT);
      const fB = Math.round(129 + (153 - 129) * gradT);

      png.data[idx] = fR;
      png.data[idx + 1] = fG;
      png.data[idx + 2] = fB;
      png.data[idx + 3] = 255;
    }
  }

  // Draw Cap Skull / Arch Underneath
  const skullW = 80 * scale * safeScale;
  const skullTop = cy + 14 * scale * safeScale;
  const skullBot = cy + 62 * scale * safeScale;

  for (let y = Math.floor(skullTop); y <= Math.ceil(skullBot); y++) {
    if (y < 0 || y >= size) continue;
    for (let x = Math.floor(cx - skullW); x <= Math.ceil(cx + skullW); x++) {
      if (x < 0 || x >= size) continue;
      const dx = (x - cx) / skullW;
      const dy = (y - skullTop) / (skullBot - skullTop);
      if (dx * dx + (dy * 0.7) * (dy * 0.7) <= 0.9) {
        const idx = (size * y + x) << 2;
        // Deep emerald #065f46
        png.data[idx] = 6;
        png.data[idx + 1] = 95;
        png.data[idx + 2] = 70;
        png.data[idx + 3] = 255;
      }
    }
  }

  // Draw Tassel (gold/yellow string and ball)
  const tasselX = leftX + 24 * scale * safeScale;
  const tasselY = cy + 50 * scale * safeScale;
  const tasselR = 9 * scale * safeScale;

  for (let y = Math.floor(tasselY - tasselR); y <= Math.ceil(tasselY + tasselR); y++) {
    if (y < 0 || y >= size) continue;
    for (let x = Math.floor(tasselX - tasselR); x <= Math.ceil(tasselX + tasselR); x++) {
      if (x < 0 || x >= size) continue;
      const d = Math.hypot(x - tasselX, y - tasselY);
      if (d <= tasselR) {
        const idx = (size * y + x) << 2;
        png.data[idx] = 251; // #fbbf24
        png.data[idx + 1] = 191;
        png.data[idx + 2] = 36;
        png.data[idx + 3] = 255;
      }
    }
  }

  // Draw Center Button
  const btnR = 7 * scale * safeScale;
  for (let y = Math.floor(cy - btnR - 12 * scale * safeScale); y <= Math.ceil(cy + btnR - 12 * scale * safeScale); y++) {
    if (y < 0 || y >= size) continue;
    for (let x = Math.floor(cx - btnR); x <= Math.ceil(cx + btnR); x++) {
      if (x < 0 || x >= size) continue;
      const d = Math.hypot(x - cx, y - (cy - 12 * scale * safeScale));
      if (d <= btnR) {
        const idx = (size * y + x) << 2;
        png.data[idx] = 255;
        png.data[idx + 1] = 255;
        png.data[idx + 2] = 255;
        png.data[idx + 3] = 255;
      }
    }
  }

  return png;
}

// Generate all required sizes
const iconsToGenerate = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
];

for (const item of iconsToGenerate) {
  const p = generateIconPNG(item.size, item.maskable);
  const buffer = PNG.sync.write(p);
  fs.writeFileSync(path.join(outDir, item.file), buffer);
  console.log(`Generated Frontend/icons/${item.file} (${item.size}x${item.size})`);
}
