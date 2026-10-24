#!/usr/bin/env node
/**
 * The box. Front, back and spine as SVG (vector, so any dpi), rasterised to
 * 300 dpi PNG and gathered into a PDF when a Chromium is available through
 * Playwright (local dev; CI skips the raster step). A 3D mock of the box is
 * composed from the same faces for the store page.
 *
 *   node --experimental-strip-types scripts/build-box.mjs   # or: task box
 *
 * The front art is also copied to public/box-front.svg for the title screen.
 */
import { writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { figureRuns, loadFigures } from './lib/figures.mjs';
import { paletteOf, pixelMap } from './lib/pixels.mjs';
import { FACES } from '../src/design/fonts.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const out = join(root, 'docs', 'box');
mkdirSync(out, { recursive: true });
const figures = loadFigures();

// Big-box proportions: 7.5 x 9.5 in; spine 1.5 in. 300 dpi.
const DPI = 300;
const W = 7.5 * DPI;
const H = 9.5 * DPI;
const SPINE = 1.5 * DPI;

// The faces from art/fonts, embedded (Latin only) so each SVG renders the same anywhere, offline.
const FONTS = FACES.flatMap((face) =>
  face.files
    .filter((f) => !f.file.includes('-ext-'))
    .map((f) => {
      const data = readFileSync(join(root, 'art', 'fonts', f.dir ?? face.dir, f.file)).toString('base64');
      return `@font-face{font-family:'${face.family}';font-style:${f.style};font-weight:400;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
    }),
).join('');
const display = "'Metamorphous', 'Palatino Linotype', Georgia, serif";
const body = "'IM Fell English', 'Palatino Linotype', Georgia, serif";
const mono = "'VT323', 'Courier New', monospace";

/** Draw a figure from art/figures.json (outlined) as SVG rects, scaled, with its feet at (cx, baseY). */
function figure(kind, cx, baseY, px, flip = false, opacity = 1) {
  const x0 = cx - (figures.width / 2) * px;
  const y0 = baseY - figures.height * px;
  const rects = figureRuns(figures, kind)
    .map(([x, y, w, h, c]) => {
      const fx = flip ? figures.width - x - w : x;
      // A hair of overlap so the runs never show seams when rasterised.
      return `<rect x="${(x0 + fx * px).toFixed(1)}" y="${(y0 + y * px).toFixed(1)}" width="${(w * px + 0.6).toFixed(1)}" height="${(h * px + 0.6).toFixed(1)}" fill="${c}"/>`;
    })
    .join('');
  return opacity < 1 ? `<g opacity="${opacity}">${rects}</g>` : rects;
}

/** A pixel map (rows of palette keys) as SVG rects. */
function pixels(rows, pal, x0, y0, px) {
  const out = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      out.push(`<rect x="${(x0 + x * px).toFixed(1)}" y="${(y0 + y * px).toFixed(1)}" width="${(px + 0.6).toFixed(1)}" height="${(px + 0.6).toFixed(1)}" fill="${pal[ch]}"/>`);
    }
  });
  return out.join('');
}

/** Stable pseudo-random, so the box is the same box every build. */
const rnd = (i, salt = 0) => {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** The cave mouth: stepped pixel rock closing in from the top and sides. */
function caveArch(u) {
  const cols = Math.ceil(W / u);
  const rows = Math.ceil(H / u);
  const out = [];
  for (let c = 0; c < cols; c++) {
    const t = c / (cols - 1);
    // Thick at the sides, thin over the middle, ragged everywhere.
    const edge = Math.pow(Math.abs(t - 0.5) * 2, 2.6);
    const depth = Math.round(rows * (0.06 + edge * 0.55) + rnd(c, 1) * 3 + (rnd(Math.floor(c / 3), 2) - 0.5) * 4);
    for (let r = 0; r < depth; r++) {
      const shade = r === depth - 1 ? '#3a2e48' : r === depth - 2 ? '#271f33' : rnd(c * 97 + r, 3) < 0.5 ? '#120d1a' : '#16111e';
      out.push(`<rect x="${c * u}" y="${r * u}" width="${u + 0.6}" height="${u + 0.6}" fill="${shade}"/>`);
    }
    // And up from the floor at the far edges.
    const rise = Math.round(rows * Math.max(0, edge - 0.55) * 0.9 + rnd(c, 4) * 2);
    for (let r = 0; r < rise; r++) {
      const y = rows - 1 - r;
      out.push(`<rect x="${c * u}" y="${y * u}" width="${u + 0.6}" height="${u + 0.6}" fill="${r === rise - 1 ? '#2d243a' : '#120d1a'}"/>`);
    }
  }
  return out.join('');
}

/** Flagstones, receding: rows of pixel bricks that shrink toward the back. */
function flagstones(u, top) {
  const out = [];
  let y = top;
  let row = 0;
  while (y < H) {
    const h = Math.round(u * (2 + row * 0.9));
    const w = h * 2;
    const off = (row % 2) * (w / 2);
    for (let x = -off; x < W; x += w) {
      const shade = ['#2a2133', '#2e2437', '#31273b', '#28202f'][Math.floor(rnd(row * 131 + Math.round(x), 5) * 4)];
      out.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w - u * 0.5).toFixed(1)}" height="${(h - u * 0.5).toFixed(1)}" fill="${shade}"/>`);
      out.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(w - u * 0.5).toFixed(1)}" height="${(u * 0.5).toFixed(1)}" fill="#3a2f45"/>`);
    }
    y += h;
    row++;
  }
  return out.join('');
}

/** A named map from art/pixels.json as SVG rects. */
const art = (name, x0, y0, px, opts) => pixels(pixelMap(name).rows, paletteOf(name, opts), x0, y0, px);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const publisher = (x, y, size) => `
  <g transform="translate(${x} ${y})" font-family="${display}" fill="#f1e9d8">
    <rect x="0" y="0" width="${size * 1.1}" height="${size * 1.1}" fill="none" stroke="#ff7a1f" stroke-width="${size * 0.06}"/>
    <text x="${size * 0.55}" y="${size * 0.8}" font-size="${size * 0.7}" text-anchor="middle">H</text>
    <text x="${size * 1.3}" y="${size * 0.55}" font-size="${size * 0.42}" letter-spacing="${size * 0.04}">HUNGOVERCODERS</text>
    <text x="${size * 1.3}" y="${size * 0.95}" font-size="${size * 0.28}" font-family="${body}" font-style="italic" fill="#b9b0a0">publishers of dubious software</text>
  </g>`;

const defs = `
  <defs>
    <style>${FONTS}</style>
    <radialGradient id="glow" cx="50%" cy="62%" r="55%">
      <stop offset="0%" stop-color="#5a1a24"/>
      <stop offset="45%" stop-color="#1c1026"/>
      <stop offset="100%" stop-color="#07050c"/>
    </radialGradient>
    <linearGradient id="floor" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#2b2234" stop-opacity="0"/>
      <stop offset="100%" stop-color="#2b2234"/>
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.2 0 0 0 0 0.15 0 0 0 0 0.25 0 0 0 0.18 0"/></filter>
    <filter id="blur"><feGaussianBlur stdDeviation="${DPI * 0.03}"/></filter>
  </defs>`;

// ---------- front ----------
function front() {
  const u = DPI * 0.06;
  const floorTop = H * 0.66;
  const specks = Array.from({ length: 160 }, (_, i) => {
    const x = rnd(i, 7) * W;
    const y = H * 0.3 + rnd(i, 8) * H * 0.4;
    const s = u * (0.3 + rnd(i, 9) * 0.4);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${s.toFixed(1)}" height="${s.toFixed(1)}" fill="${rnd(i, 10) < 0.6 ? '#ff8a2a' : '#ffd07a'}" opacity="${(0.3 + rnd(i, 11) * 0.6).toFixed(2)}"/>`;
  }).join('');
  const heartX = W * 0.5;
  const heartY = floorTop + u * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs}
  <radialGradient id="heartglow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#ff4a4a" stop-opacity="0.75"/>
    <stop offset="35%" stop-color="#b4202c" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="#5a0f16" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="torch" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#ffb060" stop-opacity="0.55"/>
    <stop offset="100%" stop-color="#ff7a1f" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="mist" x1="0" x2="0" y1="0" y2="1">
    <stop offset="0%" stop-color="#3a2f48" stop-opacity="0"/>
    <stop offset="100%" stop-color="#3a2f48" stop-opacity="0.55"/>
  </linearGradient>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  ${flagstones(u, floorTop)}
  <rect x="0" y="${floorTop}" width="${W}" height="${H - floorTop}" fill="url(#mist)"/>
  <!-- the Heart on its dais, and the light it throws -->
  <ellipse cx="${heartX}" cy="${heartY}" rx="${DPI * 2.6}" ry="${DPI * 1.6}" fill="url(#heartglow)"/>
  ${art('tile.dais', heartX - 7 * u * 1.6, heartY - u * 3.5, u * 1.6)}
  ${art('gem.heart', heartX - 4.5 * u * 1.6, heartY - u * 7.5, u * 1.6, { variant: 'lit' })}
  <!-- the stair, and the mortals on it, torch-lit -->
  <ellipse cx="${W * 0.8}" cy="${floorTop - u * 6}" rx="${DPI * 1.1}" ry="${DPI * 0.8}" fill="url(#torch)"/>
  ${figure('knight', W * 0.8, floorTop + u * 1, u * 1.6, true)}
  ${figure('priest', W * 0.89, floorTop - u * 1, u * 1.4, true)}
  ${figure('knight', W * 0.95, floorTop - u * 3, u * 1.2, true, 0.8)}
  <!-- the cave closes in -->
  ${caveArch(u)}
  <!-- two lamp-yellow eyes in the dark, upper left -->
  ${art('eyes.pwca', W * 0.12, H * 0.42, u * 0.9)}
  ${specks}
  <!-- the pack: one hound close and huge, two behind -->
  ${figure('cwn', W * 0.13, H * 0.745, u * 1.2, false, 0.75)}
  ${figure('cwn', W * 0.66, H * 0.84, u * 1.9)}
  ${figure('cwn', W * 0.24, H * 0.975, u * 3.2)}
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
  <!-- title -->
  <text x="${W / 2}" y="${H * 0.13}" text-anchor="middle" font-family="${display}" font-size="${DPI * 0.82}" fill="#f1e9d8" style="paint-order:stroke" stroke="#07050c" stroke-width="${DPI * 0.04}">Steward</text>
  <text x="${W / 2}" y="${H * 0.21}" text-anchor="middle" font-family="${display}" font-size="${DPI * 0.5}" fill="#ff7a1f" style="paint-order:stroke" stroke="#07050c" stroke-width="${DPI * 0.03}">of Annwn</text>
  <text x="${W / 2}" y="${H * 0.265}" text-anchor="middle" font-family="${body}" font-style="italic" font-size="${DPI * 0.19}" fill="#d8cfbe" style="paint-order:stroke" stroke="#07050c" stroke-width="${DPI * 0.02}">Arawn rides with the Hunt. Keep his hall until he returns.</text>
  <!-- badge -->
  <g transform="translate(${W * 0.06} ${H * 0.9})">
    <rect width="${DPI * 1.5}" height="${DPI * 0.42}" fill="#f1e9d8"/>
    <text x="${DPI * 0.75}" y="${DPI * 0.3}" text-anchor="middle" font-family="${mono}" font-size="${DPI * 0.28}" fill="#0b0812">PC · 1 PLAYER</text>
  </g>
  ${publisher(W * 0.62, H * 0.905, DPI * 0.34)}
</svg>`;
}

// ---------- back ----------
function back() {
  const shots = ['hall.png', 'fight.png', 'manual.png'];
  const shotW = (W - DPI * 1.2) / 3;
  const shotH = shotW * 0.66;
  const images = shots
    .map((f, i) => {
      const href = existsSync(join(out, 'shots', f)) ? `shots/${f}` : '';
      const x = DPI * 0.45 + i * (shotW + DPI * 0.15);
      const y = H * 0.37;
      return `<rect x="${x - 6}" y="${y - 6}" width="${shotW + 12}" height="${shotH + 12}" fill="#f1e9d8"/><image x="${x}" y="${y}" width="${shotW}" height="${shotH}" preserveAspectRatio="xMidYMid slice" href="${href}"/>`;
    })
    .join('');
  const bullets = [
    'Dig the hall out of living rock. Your Coblynau will complain, and dig.',
    'Nine denizens of Welsh myth, from the Cŵn Annwn to the Afanc, each with a page.',
    'Mortals who walk through walls if you give them no other road.',
    'An economy of carried gold, wages, and a Pwca who skims.',
    'A manual you will actually need. Keep it open. The hall does not forgive.',
  ]
    .map((b, i) => `<text x="${DPI * 0.55}" y="${H * 0.63 + i * DPI * 0.24}" font-family="${body}" font-size="${DPI * 0.155}" fill="#f1e9d8">◆  ${esc(b)}</text>`)
    .join('');
  const reqs = ['386DX or better', '4 MB RAM', 'VGA 256 colours', 'Sound Blaster or compatible', '12 MB hard disk', 'Mouse recommended. Manual required.'];
  const reqText = reqs.map((r, i) => `<text x="${DPI * 0.2}" y="${DPI * 0.4 + i * DPI * 0.17}" font-family="${mono}" font-size="${DPI * 0.145}" fill="#0b0812">${esc(r)}</text>`).join('');
  const bars = Array.from({ length: 40 }, (_, i) => `<rect x="${i * 9}" y="0" width="${2 + ((i * 7) % 4)}" height="${DPI * 0.35}" fill="#0b0812"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  ${defs}
  <rect width="${W}" height="${H}" fill="#0b0812"/>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
  <text x="${DPI * 0.45}" y="${H * 0.1}" font-family="${display}" font-size="${DPI * 0.36}" fill="#f1e9d8">Arawn is away.</text>
  <text x="${DPI * 0.45}" y="${H * 0.155}" font-family="${display}" font-size="${DPI * 0.36}" fill="#ff7a1f">The mortals have heard.</text>
  <foreignObject x="${DPI * 0.45}" y="${H * 0.19}" width="${W - DPI * 0.9}" height="${H * 0.16}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:${body};font-size:${DPI * 0.165}px;line-height:1.3;color:#b9b0a0;">You are the steward of a hall beneath a cairn, keeping it for a lord who is out with the Hunt and has not said when he will be back. The seam is rich, the Coblynau are willing, and the stair is long. Dig, build, feed what comes through the portal, and keep the Heart beating until the third wave is bones.</div>
  </foreignObject>
  ${images}
  ${bullets}
  <!-- review -->
  <text x="${W - DPI * 0.45}" y="${H * 0.835}" text-anchor="end" font-family="${body}" font-style="italic" font-size="${DPI * 0.2}" fill="#f1e9d8">“I could not tell a hound from a hound of men. Now I can.”</text>
  <text x="${W - DPI * 0.45}" y="${H * 0.865}" text-anchor="end" font-family="${mono}" font-size="${DPI * 0.16}" fill="#b9b0a0">— a steward, briefly</text>
  <!-- requirements -->
  <g transform="translate(${DPI * 0.45} ${H * 0.855})">
    <rect width="${DPI * 2.9}" height="${DPI * 1.3}" fill="#f1e9d8"/>
    <text x="${DPI * 0.2}" y="${DPI * 0.25}" font-family="${display}" font-size="${DPI * 0.15}" fill="#0b0812">MINIMUM REQUIREMENTS</text>
    ${reqText}
  </g>
  <g transform="translate(${W - DPI * 1.85} ${H * 0.935})">
    <rect x="-10" y="-10" width="${DPI * 1.4}" height="${DPI * 0.55}" fill="#f1e9d8"/>
    ${bars}
    <text x="${DPI * 0.6}" y="${DPI * 0.5}" text-anchor="middle" font-family="${mono}" font-size="${DPI * 0.11}" fill="#0b0812">5 024 1 ANNWN 0 06</text>
  </g>
  ${publisher(W - DPI * 3.6, H * 0.88, DPI * 0.26)}
</svg>`;
}

// ---------- spine ----------
function spine() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SPINE}" height="${H}" viewBox="0 0 ${SPINE} ${H}">
  ${defs}
  <rect width="${SPINE}" height="${H}" fill="#120d1c"/>
  <rect width="${SPINE}" height="${H}" filter="url(#grain)"/>
  <rect x="0" y="0" width="${SPINE}" height="${DPI * 0.12}" fill="#ff7a1f"/>
  <rect x="0" y="${H - DPI * 0.12}" width="${SPINE}" height="${DPI * 0.12}" fill="#ff7a1f"/>
  <text transform="translate(${SPINE * 0.62} ${H * 0.5}) rotate(-90)" text-anchor="middle" font-family="${display}" font-size="${DPI * 0.5}" fill="#f1e9d8">Steward of Annwn</text>
  <g transform="translate(${SPINE * 0.5 - DPI * 0.12} ${H * 0.9})">${figure('cwn', DPI * 0.12, DPI * 0.5, DPI * 0.03)}</g>
  <text transform="translate(${SPINE * 0.5} ${H * 0.06}) rotate(-90)" text-anchor="middle" font-family="${mono}" font-size="${DPI * 0.14}" fill="#b9b0a0">HUNGOVERCODERS</text>
</svg>`;
}

// ---------- 3D mock ----------
function mock3d(ext = 'png') {
  const fw = 720;
  const fh = fw * (H / W);
  const sw = fw * (SPINE / W) * 0.9;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1200" viewBox="0 0 1400 1200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="#1c1428"/><stop offset="100%" stop-color="#07050c"/></radialGradient>
    <linearGradient id="shade" x1="0" x2="1"><stop offset="0%" stop-color="#000" stop-opacity="0.55"/><stop offset="100%" stop-color="#000" stop-opacity="0.15"/></linearGradient>
  </defs>
  <rect width="1400" height="1200" fill="url(#bg)"/>
  <ellipse cx="760" cy="1110" rx="520" ry="46" fill="#000" opacity="0.6"/>
  <g transform="matrix(1 -0.12 0 1 360 180)">
    <image width="${fw}" height="${fh}" href="front.${ext}"/>
  </g>
  <g transform="matrix(0.55 0.32 0 1 ${360 - sw * 0.55} ${180 + 0})">
    <image width="${sw}" height="${fh}" href="spine.${ext}"/>
    <rect width="${sw}" height="${fh}" fill="url(#shade)"/>
  </g>
</svg>`;
}

const files = { 'front.svg': front(), 'back.svg': back(), 'spine.svg': spine(), 'box-3d.svg': mock3d('svg') };
for (const [name, svg] of Object.entries(files)) writeFileSync(join(out, name), svg);
mkdirSync(join(root, 'public'), { recursive: true });
copyFileSync(join(out, 'front.svg'), join(root, 'public', 'box-front.svg'));
console.log(`wrote ${Object.keys(files).join(', ')} to docs/box and public/box-front.svg`);

// ---------- raster + pdf (optional) ----------
const pwPath = process.env.PLAYWRIGHT_MODULE ?? '/opt/node-tools/node_modules/playwright/index.mjs';
if (process.argv.includes('--svg-only') || !existsSync(pwPath)) {
  console.log('no Playwright found: skipped PNG and PDF (set PLAYWRIGHT_MODULE to render)');
} else {
  const { chromium } = await import(pwPath);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const [name, w, h] of [
    ['front', W, H],
    ['back', W, H],
    ['spine', SPINE, H],
  ]) {
    await page.setViewportSize({ width: Math.round(w), height: Math.round(h) });
    await page.goto(`file://${join(out, name + '.svg')}`);
    await page.waitForTimeout(1500); // webfonts
    await page.screenshot({ path: join(out, name + '.png'), clip: { x: 0, y: 0, width: w, height: h } });
  }
  // A web-sized front for the title screen (an SVG used as <img> cannot load webfonts).
  await page.setViewportSize({ width: 750, height: 950 });
  writeFileSync(join(out, 'front-web.html'), `<html><body style="margin:0;background:#0b0812"><img src="front.png" style="width:750px;height:950px;display:block"/></body></html>`);
  await page.goto(`file://${join(out, 'front-web.html')}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(root, 'public', 'box-front.png'), clip: { x: 0, y: 0, width: 750, height: 950 } });
  // The mock uses the rasterised faces so the webfonts are baked in.
  writeFileSync(join(out, 'box-3d.svg'), mock3d('png'));
  await page.setViewportSize({ width: 1400, height: 1200 });
  await page.goto(`file://${join(out, 'box-3d.svg')}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, 'box-3d.png') });
  // PDF: front, back, spine as pages at physical size.
  const html = `<html><body style="margin:0">${['front', 'back', 'spine']
    .map((n) => `<div style="page-break-after:always;width:${n === 'spine' ? 1.5 : 7.5}in;height:9.5in"><img src="${n}.png" style="width:100%;height:100%"/></div>`)
    .join('')}</body></html>`;
  writeFileSync(join(out, 'box.html'), html);
  await page.goto(`file://${join(out, 'box.html')}`);
  await page.waitForTimeout(500);
  await page.pdf({ path: join(out, 'box.pdf'), width: '7.5in', height: '9.5in', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
  await browser.close();
  for (const tmp of ['box.html', 'front-web.html']) rmSync(join(out, tmp), { force: true });
  console.log('wrote front.png, back.png, spine.png, box-3d.png, box.pdf (300 dpi) and public/box-front.png');
}
