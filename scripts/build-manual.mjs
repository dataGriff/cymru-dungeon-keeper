#!/usr/bin/env node
/**
 * The printed manual and the reference card, generated from the same data
 * the game reads. No dependencies: a small PDF 1.4 writer lives in this file
 * (standard 14 fonts, no embedding). Run:
 *
 *   node --experimental-strip-types scripts/build-manual.mjs   # or: task manual
 *
 * Writes dist/manual.pdf (A5, booklet-ready) and dist/reference-card.pdf
 * (one A5 landscape page). All creature, engine, room and wave text comes
 * from src/data; only the intro and colophon are written here, once.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { BESTIARY, BESTIARY_ORDER, ENGINES, ENGINE_ORDER, MANUAL_FOOTNOTE, TRADES } from '../src/data/bestiary.ts';
import { ROOMS } from '../src/data/rooms.ts';
import { CAIRN, HERO_ROLES, SIEGE } from '../src/data/waves.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const figures = JSON.parse(readFileSync(join(root, 'art', 'figures.json'), 'utf8'));

// ---------------------------------------------------------------- PDF writer

const FONTS = {
  F1: 'Times-Roman',
  F2: 'Times-Italic',
  F3: 'Times-Bold',
  F4: 'Helvetica-Bold',
  F5: 'Courier',
};

/**
 * Advance widths (thousandths of an em) for the letters, from the standard
 * AFM metrics of the Type 1 fonts, so wrapping and the hand-set circumflex
 * land where they should. Anything not listed falls back to a sensible guess.
 */
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const table = (lower, upper, extra) => {
  const t = {};
  lower.forEach((w, i) => (t[LOWER[i]] = w));
  upper.forEach((w, i) => (t[UPPER[i]] = w));
  Object.assign(t, extra);
  return t;
};
const PUNCT_TIMES = { ' ': 250, '.': 250, ',': 250, ':': 278, ';': 278, '!': 333, '?': 444, '-': 333, '–': 500, '—': 1000, "'": 180, '’': 333, '‘': 333, '“': 444, '”': 444, '(': 333, ')': 333, '/': 278, '&': 778, '·': 250, '×': 564, '^': 469 };
const METRICS = {
  F1: table(
    [444, 500, 444, 500, 444, 333, 500, 500, 278, 278, 500, 278, 778, 500, 500, 500, 500, 333, 389, 278, 500, 500, 722, 500, 500, 444],
    [722, 667, 667, 722, 611, 556, 722, 722, 333, 389, 722, 611, 889, 722, 722, 556, 722, 667, 556, 611, 722, 722, 944, 722, 722, 611],
    PUNCT_TIMES,
  ),
  F2: table(
    [500, 500, 444, 500, 444, 278, 500, 500, 278, 278, 444, 278, 722, 500, 500, 500, 500, 389, 389, 278, 500, 444, 667, 444, 444, 389],
    [611, 611, 667, 722, 611, 611, 722, 722, 333, 444, 667, 556, 833, 667, 722, 611, 722, 611, 500, 556, 722, 611, 833, 611, 556, 556],
    PUNCT_TIMES,
  ),
  F3: table(
    [500, 556, 444, 556, 444, 333, 500, 556, 278, 333, 556, 278, 833, 556, 500, 556, 556, 444, 389, 333, 556, 500, 722, 500, 500, 444],
    [722, 667, 722, 722, 667, 611, 778, 778, 389, 500, 778, 667, 944, 722, 778, 611, 778, 722, 556, 667, 722, 722, 1000, 722, 722, 667],
    PUNCT_TIMES,
  ),
  F4: table(
    [556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500],
    [722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611],
    { ' ': 278, '.': 278, ',': 278, ':': 333, ';': 333, '-': 333, '·': 278, '’': 278, '/': 278, '&': 722, '(': 333, ')': 333 },
  ),
};
function charWidth(ch, font) {
  if (font === 'F5') return 0.6;
  const m = METRICS[font] ?? METRICS.F1;
  const base = ch === 'ŵ' ? 'w' : ch === 'Ŵ' ? 'W' : ch;
  const w = m[base];
  if (w !== undefined) return w / 1000;
  if (/[0-9]/.test(base)) return font === 'F4' ? 0.556 : 0.5;
  return 0.5;
}
const textWidth = (text, font, size) => [...text].reduce((w, ch) => w + charWidth(ch, font), 0) * size;

/** WinAnsi has no w-with-circumflex; it is drawn as w plus a separate hat. */
const WINANSI = {
  '—': 0x97,
  '–': 0x96,
  '‘': 0x91,
  '’': 0x92,
  '“': 0x93,
  '”': 0x94,
  '…': 0x85,
  '·': 0xb7,
  '×': 0xd7,
};
function encode(text) {
  const bytes = [];
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    let b;
    if (cp < 128) b = cp;
    else if (WINANSI[ch] !== undefined) b = WINANSI[ch];
    else if (ch === 'ŵ') b = 'w'.charCodeAt(0);
    else if (ch === 'Ŵ') b = 'W'.charCodeAt(0);
    else if (cp <= 255) b = cp;
    else b = '?'.charCodeAt(0);
    if (b === 0x28 || b === 0x29 || b === 0x5c) bytes.push(0x5c);
    bytes.push(b);
  }
  return Buffer.from(bytes);
}

const rgb = (c) => c.map((v) => v.toFixed(3)).join(' ');

class Doc {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pages = []; // each: array of content Buffers
    this.cur = null;
  }
  newPage() {
    this.cur = [];
    this.pages.push(this.cur);
    return this.pages.length;
  }
  get pageNumber() {
    return this.pages.length;
  }
  op(s) {
    this.cur.push(Buffer.isBuffer(s) ? s : Buffer.from(s, 'latin1'));
  }
  /** Draw one line of text at baseline (x, y). Handles the circumflex on w. */
  text(x, y, str, font = 'F1', size = 10.5, color = [0.17, 0.13, 0.09]) {
    this.op(`BT /${font} ${size} Tf ${rgb(color)} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (`);
    this.op(encode(str));
    this.op(') Tj ET\n');
    let dx = 0;
    for (const ch of str) {
      const base = ch === 'ŵ' ? 'w' : ch === 'Ŵ' ? 'W' : ch;
      if (base !== ch) {
        const w = charWidth(base, font) * size;
        const hatSize = size * 0.8;
        const hx = x + dx + w / 2 - hatSize * 0.17;
        const hy = y + size * (base === 'W' ? 0.5 : 0.3);
        this.op(`BT /${font} ${hatSize} Tf ${rgb(color)} rg 1 0 0 1 ${hx.toFixed(2)} ${hy.toFixed(2)} Tm (^) Tj ET\n`);
      }
      dx += charWidth(base, font) * size;
    }
  }
  /** Text rotated 180 degrees, ending at (x, y). */
  textUpsideDown(x, y, str, font = 'F1', size = 10.5, color = [0.17, 0.13, 0.09]) {
    this.op(`BT /${font} ${size} Tf ${rgb(color)} rg -1 0 0 -1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (`);
    this.op(encode(str));
    this.op(') Tj ET\n');
  }
  rect(x, y, w, h, color) {
    this.op(`${rgb(color)} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`);
  }
  line(x1, y1, x2, y2, color = [0.4, 0.3, 0.2], width = 0.6) {
    this.op(`${rgb(color)} RG ${width} w ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`);
  }
  /** Word-wrap `str` to `maxWidth`; returns the lines. */
  wrap(str, font, size, maxWidth) {
    const lines = [];
    for (const para of str.split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (textWidth(candidate, font, size) <= maxWidth || !line) line = candidate;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  /** Draw a wrapped paragraph with its first baseline at y; returns the y below it. */
  paragraph(x, y, str, { font = 'F1', size = 10.5, width, leading = size * 1.32, color, indent = 0 } = {}) {
    for (const line of this.wrap(str, font, size, width - indent)) {
      this.text(x + indent, y, line, font, size, color);
      y -= leading;
    }
    return y;
  }
  toBuffer() {
    const objects = [];
    const add = (body) => {
      objects.push(body);
      return objects.length;
    };
    const fontIds = {};
    for (const [key, name] of Object.entries(FONTS)) {
      fontIds[key] = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
    }
    const contentIds = this.pages.map((page) => {
      const data = deflateSync(Buffer.concat(page));
      return add(
        Buffer.concat([
          Buffer.from(`<< /Length ${data.length} /Filter /FlateDecode >>\nstream\n`, 'latin1'),
          data,
          Buffer.from('\nendstream', 'latin1'),
        ]),
      );
    });
    const resources = `<< /Font << ${Object.entries(fontIds)
      .map(([k, id]) => `/${k} ${id} 0 R`)
      .join(' ')} >> >>`;
    const pagesId = objects.length + this.pages.length + 1;
    const pageIds = this.pages.map((_, i) =>
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources ${resources} /Contents ${contentIds[i]} 0 R >>`,
      ),
    );
    const pagesIdReal = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);
    if (pagesIdReal !== pagesId) throw new Error('pages object index mismatch');
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    const infoId = add(`<< /Title (Steward of Annwn: The Manual) /Producer (scripts/build-manual.mjs) /Creator (Steward of Annwn) >>`);
    const parts = [Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n', 'latin1')];
    const offsets = [];
    let length = parts[0].length;
    objects.forEach((body, i) => {
      offsets.push(length);
      const head = Buffer.from(`${i + 1} 0 obj\n`, 'latin1');
      const tail = Buffer.from('\nendobj\n', 'latin1');
      const b = Buffer.isBuffer(body) ? body : Buffer.from(body, 'latin1');
      parts.push(head, b, tail);
      length += head.length + b.length + tail.length;
    });
    const xref = [`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`];
    for (const off of offsets) xref.push(`${String(off).padStart(10, '0')} 00000 n \n`);
    parts.push(Buffer.from(xref.join(''), 'latin1'));
    parts.push(
      Buffer.from(
        `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${length}\n%%EOF\n`,
        'latin1',
      ),
    );
    return Buffer.concat(parts);
  }
}

// ---------------------------------------------------------------- the manual

const A5 = { w: 419.53, h: 595.28 };
const M = 40; // margin
const INK = [0.17, 0.13, 0.09];
const SOFT = [0.42, 0.33, 0.24];
const RULE = [0.45, 0.35, 0.22];

const doc = new Doc(A5.w, A5.h);
const sections = []; // { title, page }

function header(title) {
  const y = A5.h - M + 8;
  doc.text(M, y, 'STEWARD OF ANNWN · THE MANUAL', 'F4', 6.5, SOFT);
  const right = title.toUpperCase();
  doc.text(A5.w - M - textWidth(right, 'F4', 6.5), y, right, 'F4', 6.5, SOFT);
  doc.line(M, y - 5, A5.w - M, y - 5, RULE, 0.5);
}
function footer() {
  const n = String(doc.pageNumber);
  doc.text(A5.w / 2 - textWidth(n, 'F1', 9) / 2, M - 14, n, 'F1', 9, SOFT);
}
function page(title) {
  doc.newPage();
  header(title);
  footer();
  return A5.h - M - 22;
}
function heading(y, text, size = 20) {
  doc.text(M, y - size, text, 'F3', size, INK);
  return y - size - 20;
}
function sub(y, text) {
  doc.text(M, y - 11, text.toUpperCase(), 'F4', 8, SOFT);
  return y - 26;
}
function body(y, text, opts = {}) {
  return doc.paragraph(M, y, text, { width: A5.w - 2 * M, ...opts });
}

/** A beast portrait from the rectangle figures, px points per logical pixel. */
function portrait(kind, x, y, px) {
  const fig = figures.figures[kind];
  const h = figures.height * px;
  doc.rect(x - 4, y - 4, figures.width * px + 8, h + 8, [0.93, 0.89, 0.8]);
  for (const [rx, ry, rw, rh, c] of fig) {
    const hex = figures.palette[c] ?? '#ff00ff';
    const col = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    doc.rect(x + rx * px, y + h - (ry + rh) * px, rw * px, rh * px, col);
  }
}

const COVER_STRAP =
  'A manual for the keeping of a hall in Annwn, written for the steward who must keep it while its lord rides with the Hunt.';

const INTRO = [
  'You will have been told that this is a game. It is not; it is a post, and you have been given it because nobody else would take it. Arawn rides with the Hunt and will not be back before the mortals have heard he is gone, and they have heard already. They are on the stair.',
  'The hall below the cairn is dug by Coblynau, lit by what the Heart gives off, and defended by whatever the portal sends when it judges the rooms good enough. It judges harshly. A Lair of four and a Hatchery of two will fetch the hounds; everything better wants more, and wants paying.',
  'This manual is the only one. Keep it open. The pages on the creatures are copied from the one the Hunt left behind, and are the truth as far as it goes. The pages on the mortals are from the mortals’ own books, which is why they are so sure of themselves.',
  'When the third wave is bones on the stair you may close it. Not before.',
];

const CONTROLS = [
  ['Hand', 'G', 'Click a creature to read its page and pick it up; click a tile to send it there. Right-click lets go.'],
  ['Dig', 'D', 'Mark rock for the Coblynau. Click or drag. Right-click, or click again, to unmark.'],
  ['Lair', 'L', 'Paint onto floor. Click a Lair tile again, or right-click it, to sell for half.'],
  ['Hatchery', 'H', 'Paint onto floor. Sell the same way.'],
  ['Treasury', 'T', 'Paint onto floor. Selling a tile the vault cannot spare spills gold on the floor.'],
  ['Pool', 'P', 'Paint onto floor. For the water-beasts.'],
  ['Pit', 'I', 'Plan on floor; a Coblyn digs it. Click again to cancel before it is built.'],
  ['Boulder', 'B', 'Plan at the top of a straight corridor. Cancel the same way.'],
  ['Snare', 'S', 'Plan on floor. Cancel the same way.'],
  ['Pause', 'Space', 'The hall holds its breath. Marks and rooms may still be laid.'],
  ['Speed', '1 2 3', 'How fast the hall runs.'],
  ['Restart', 'R', 'Asks first.'],
  ['Sound', '—', 'The Sound button; the Mixer beneath the toolbar has master, ambient and effects.'],
];

/** Mirrors chooseArrival() in src/sim/game.ts. */
const ARRIVALS = [
  ['Coblyn', 'Replaced from the portal while fewer than three remain.'],
  ['Cŵn Annwn', 'Lair of 4 and Hatchery of 2. At most three.'],
  ['Pwca', 'Lair of 2 and Treasury of 2. At most two.'],
  ['Gwyllgi', 'Lair of 6 and Treasury of 3. At most two.'],
  ['Ceffyl Dŵr', 'Pool of 3 and Lair of 4. One only.'],
  ['Afanc', 'Lair of 9, Treasury of 4 and 300 gold in hand. One only.'],
  ['Tylwyth Teg emissary', 'When the vault holds 150 gold, and not twice in a row. Stays a minute.'],
];
const ARRIVAL_NOTE =
  'Room sizes are the largest contiguous region of that room, not scattered tiles. The portal checks the list every seven seconds, top to bottom, and sends the first that qualifies.';

// ---- cover
doc.newPage();
doc.rect(0, 0, A5.w, A5.h, [0.06, 0.04, 0.09]);
doc.rect(M - 8, M - 8, A5.w - 2 * M + 16, A5.h - 2 * M + 16, [0.93, 0.87, 0.74]);
doc.rect(M + 2, M + 2, A5.w - 2 * M - 4, A5.h - 2 * M - 4, [0.9, 0.84, 0.69]);
doc.line(M + 10, A5.h - M - 10, A5.w - M - 10, A5.h - M - 10, RULE, 1);
doc.line(M + 10, M + 10, A5.w - M - 10, M + 10, RULE, 1);
{
  let y = A5.h - 120;
  doc.text(M + 14, y, 'STEWARD', 'F3', 44, INK);
  y -= 44;
  doc.text(M + 14, y, 'OF ANNWN', 'F3', 44, INK);
  y -= 26;
  doc.text(M + 14, y, 'THE MANUAL', 'F4', 12, SOFT);
  portrait('cwn', A5.w / 2 - 54, y - 170, 9);
  y -= 200;
  doc.paragraph(M + 14, y, COVER_STRAP, { font: 'F2', size: 11, width: A5.w - 2 * M - 28, color: INK });
  doc.text(M + 14, M + 26, 'Hungovercoders · For one steward · Not to be lent', 'F4', 7, SOFT);
}

// ---- a word from the steward
let contentsPage;
let contentsY;
{
  let y = page('A word from the steward');
  sections.push({ title: 'A word from the steward', page: doc.pageNumber });
  y = heading(y, 'A Word from the Steward');
  for (const p of INTRO) y = body(y, p, { size: 11 }) - 6;
  y -= 10;
  y = sub(y, 'Contents');
  contentsPage = doc.pageNumber;
  contentsY = y;
}

// ---- controls
{
  let y = page('Controls');
  sections.push({ title: 'Controls', page: doc.pageNumber });
  y = heading(y, 'Controls');
  y =
    body(y, 'One tool is active at a time. The board takes a mouse or a finger; a long press is a right-click.', {
      font: 'F2',
      size: 10,
    }) - 8;
  for (const [tool, key, text] of CONTROLS) {
    doc.text(M, y - 10, tool, 'F3', 10.5, INK);
    doc.text(M + 70, y - 10, key, 'F5', 9.5, SOFT);
    y = doc.paragraph(M + 110, y - 10, text, { size: 9.5, width: A5.w - 2 * M - 110, leading: 11.5 }) - 2;
  }
}

// ---- who arrives
{
  let y = page('Who arrives');
  sections.push({ title: 'Who arrives, and when', page: doc.pageNumber });
  y = heading(y, 'Who Arrives, and When');
  y = body(y, ARRIVAL_NOTE, { font: 'F2', size: 10 }) - 10;
  for (const [who, rule] of ARRIVALS) {
    doc.text(M, y - 12, who, 'F3', 12, INK);
    y = doc.paragraph(M, y - 27, rule, { size: 10.5, width: A5.w - 2 * M }) - 8;
  }
  y -= 6;
  y = sub(y, 'Wages');
  body(
    y,
    'Every creature with a wage draws it from the Treasury on payday, every sixty seconds from the ninetieth. One missed payday makes a creature angry; a second and it leaves to find a hall that keeps its word.',
    { size: 10.5 },
  );
}

// ---- rooms
{
  let y = page('Rooms');
  sections.push({ title: 'Rooms', page: doc.pageNumber });
  y = heading(y, 'Rooms');
  y =
    body(
      y,
      'Rooms are painted onto dug floor and sold back for half. A room is a region: tiles that touch. The creatures count the largest region, and the Treasury holds more per tile the larger the room.',
      { font: 'F2', size: 10 },
    ) - 10;
  for (const room of ROOMS) {
    doc.text(M, y - 12, room.name, 'F3', 13, INK);
    doc.text(M + textWidth(room.name, 'F3', 13) + 8, y - 12, `${room.cost} gold a tile`, 'F5', 9.5, SOFT);
    y = doc.paragraph(M, y - 28, room.text, { size: 10.5, width: A5.w - 2 * M }) - 10;
  }
  y -= 6;
  y = sub(y, 'The emissary’s terms');
  for (const k of Object.keys(TRADES)) {
    doc.text(M, y - 10, `${TRADES[k].label} · ${TRADES[k].cost}g`, 'F3', 10, INK);
    y = doc.paragraph(M, y - 22, TRADES[k].text, { size: 9.5, width: A5.w - 2 * M }) - 4;
  }
}

// ---- bestiary pages
const STAT_LABEL = { hp: 'Vigour', attack: 'Blow', speed: 'Pace', wage: 'Wage', appetite: 'Appetite', allegiance: 'Allegiance' };
const APPETITE = { none: 'None', low: 'Low', high: 'High', ruinous: 'Ruinous' };
const ALLEGIANCE = { hall: 'The Hall', mortal: 'Mortal', fair: 'The Fair Folk' };
const beastPages = {};
function beastPage(kind, sectionTitle) {
  const e = BESTIARY[kind];
  let y = page(sectionTitle);
  beastPages[kind] = doc.pageNumber;
  portrait(kind, M, y - 100, 7);
  doc.text(M + 110, y - 22, e.name, 'F3', 20, INK);
  doc.paragraph(M + 110, y - 42, e.gloss, { font: 'F2', size: 11, width: A5.w - 2 * M - 110, color: SOFT });
  y -= 118;
  y = body(y, e.flavour, { size: 10.5 }) - 8;
  doc.line(M, y, A5.w - M, y, RULE, 0.5);
  y -= 4;
  const st = e.stats;
  const rows = [
    ['hp', String(st.hp)],
    ['attack', String(st.attack)],
    ['speed', st.speed.toFixed(1)],
    ['wage', st.wage === 0 ? '—' : `${st.wage}g`],
    ['appetite', APPETITE[st.appetite]],
    ['allegiance', ALLEGIANCE[st.allegiance]],
  ];
  rows.forEach(([k, v], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * ((A5.w - 2 * M) / 2);
    const yy = y - 12 - row * 15;
    doc.text(x, yy, STAT_LABEL[k].toUpperCase(), 'F4', 7, SOFT);
    doc.text(x + 70, yy, v, 'F5', 10, INK);
  });
  y -= 12 + 3 * 15;
  doc.line(M, y, A5.w - M, y, RULE, 0.5);
  y -= 6;
  y = sub(y, 'Field notes');
  for (const n of e.notes) {
    doc.text(M + 4, y - 10, '·', 'F3', 11, INK);
    y = doc.paragraph(M + 14, y - 10, n, { size: 10, width: A5.w - 2 * M - 14, leading: 12.5 }) - 2;
  }
  doc.paragraph(M, M + 18, MANUAL_FOOTNOTE, { font: 'F2', size: 7.5, width: A5.w - 2 * M, leading: 9, color: SOFT });
}
const denizens = BESTIARY_ORDER.filter((k) => BESTIARY[k].stats.allegiance !== 'mortal');
const mortals = BESTIARY_ORDER.filter((k) => BESTIARY[k].stats.allegiance === 'mortal');
sections.push({ title: 'Denizens', page: doc.pageNumber + 1 });
for (const k of denizens) beastPage(k, 'Denizens');
sections.push({ title: 'Mortals', page: doc.pageNumber + 1 });
for (const k of mortals) beastPage(k, 'Mortals');

// ---- engines of the hall
sections.push({ title: 'Engines of the Hall', page: doc.pageNumber + 1 });
{
  let y = page('Engines of the Hall');
  y = heading(y, 'Engines of the Hall');
  y =
    body(
      y,
      'Planned on floor and paid for at once; a Coblyn builds each over a few seconds. Planning on an unbuilt engine cancels it with a refund. Each works once.',
      { font: 'F2', size: 10 },
    ) - 6;
  for (const k of ENGINE_ORDER) {
    const e = ENGINES[k];
    if (y < 170) y = page('Engines of the Hall');
    doc.text(M, y - 14, e.name, 'F3', 15, INK);
    doc.paragraph(M, y - 28, e.gloss, { font: 'F2', size: 10, width: A5.w - 2 * M, color: SOFT });
    y = body(y - 42, e.flavour, { size: 10 }) - 2;
    const st = e.stats;
    const effect = k === 'boulder' ? `rolls ${st.effect} tiles` : k === 'pit' ? `slows ${st.effect}s` : `holds ${st.effect}s`;
    const dmg = k === 'snare' ? `${st.damage}/s` : `${st.damage} damage`;
    doc.text(M, y - 9, `${st.cost} GOLD  ·  ${st.build}S LABOUR  ·  ${dmg.toUpperCase()}  ·  ${effect.toUpperCase()}`, 'F4', 7, SOFT);
    y -= 14;
    for (const n of e.notes) {
      doc.text(M + 4, y - 10, '·', 'F3', 11, INK);
      y = doc.paragraph(M + 14, y - 10, n, { size: 9.5, width: A5.w - 2 * M - 14, leading: 11.5 }) - 1;
    }
    y -= 10;
  }
}

// ---- waves
const GATE_NAMES = ['west', 'east', 'third', 'fourth'];
const SHORT = {
  knight: 'Knight',
  priest: 'Priest',
  lord: 'Lord',
  levy: 'Levy',
  relic: 'Reliquary bearer',
};
function composition(w, short = false) {
  const counts = {};
  for (const h of w.heroes) counts[h] = (counts[h] ?? 0) + 1;
  return Object.entries(counts)
    .map(([k, n]) => `${n}× ${short ? SHORT[k] : BESTIARY[k].name}`)
    .join(', ');
}
sections.push({ title: 'Waves', page: doc.pageNumber + 1 });
{
  let y = page('Waves');
  y = heading(y, 'Waves');
  y =
    body(y, 'Mortals come down the stair on a clock. The hall shows you the next wave as figures above the board; this is the whole book of it.', {
      font: 'F2',
      size: 10,
    }) - 8;
  for (const sched of [CAIRN, SIEGE]) {
    y = sub(y, sched.name);
    doc.text(M, y - 9, 'WAVE', 'F4', 7, SOFT);
    doc.text(M + 40, y - 9, 'AT', 'F4', 7, SOFT);
    doc.text(M + 75, y - 9, 'GATE', 'F4', 7, SOFT);
    doc.text(M + 110, y - 9, 'WHO', 'F4', 7, SOFT);
    y -= 12;
    sched.waves.forEach((w, i) => {
      doc.text(M, y - 10, String(i + 1), 'F5', 9.5, INK);
      doc.text(M + 40, y - 10, `${w.at}s`, 'F5', 9.5, INK);
      doc.text(M + 75, y - 10, GATE_NAMES[w.gate] ?? String(w.gate), 'F5', 9.5, INK);
      y = doc.paragraph(M + 110, y - 10, composition(w), { size: 9.5, width: A5.w - 2 * M - 110, leading: 11.5 }) - 1;
    });
    y -= 8;
  }
  y = sub(y, 'What each mortal is for');
  for (const [k, role] of Object.entries(HERO_ROLES)) {
    doc.text(M, y - 10, BESTIARY[k].name, 'F3', 9.5, INK);
    y = doc.paragraph(M + 110, y - 10, role, { size: 9.5, width: A5.w - 2 * M - 110, leading: 11.5 }) - 1;
  }
}

// ---- notes
sections.push({ title: 'Notes', page: doc.pageNumber + 1 });
{
  let y = page('Notes');
  y = heading(y, 'Notes');
  y =
    body(y, 'For the steward’s own hand: which corridor the knight took, which seed the Afanc liked, what the Pwca stole.', {
      font: 'F2',
      size: 10,
    }) - 10;
  while (y > M + 30) {
    doc.line(M, y, A5.w - M, y, [0.6, 0.5, 0.38], 0.4);
    y -= 18;
  }
}

// ---- the question, and the colophon
sections.push({ title: 'A question, and a colophon', page: doc.pageNumber + 1 });
{
  // Computed from the Afanc page as actually laid out above: page number and the third word of its first paragraph.
  const askKind = 'afanc';
  const askPage = beastPages[askKind];
  const words = BESTIARY[askKind].flavour.split(/\s+/).map((w) => w.replace(/[^\wŵŴ'-]/g, ''));
  // The first substantial word after the opening two, so the answer is not "a".
  let askIndex = words.findIndex((w, i) => i >= 2 && w.length >= 5);
  if (askIndex < 0) askIndex = 2;
  const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
  const answer = words[askIndex];
  let y = page('Colophon');
  y = heading(y, 'A Question Before You Begin');
  y =
    body(
      y,
      `To prove this manual is yours and not a borrowed one: what is the ${ORDINAL[askIndex] ?? `${askIndex + 1}th`} word of the first paragraph on page ${askPage}? The hall will not ask. The hall has other ways of knowing.`,
      { size: 11 },
    ) - 6;
  y = body(y, 'Write the answer below, in ink, and never on the Treasury wall.', { font: 'F2', size: 10 }) - 20;
  doc.line(M, y, A5.w - M, y, RULE, 0.6);
  y -= 50;
  y = sub(y, 'Colophon');
  y =
    body(
      y,
      'Set from the same data the game reads: every creature, engine, room and wave in this book is the one in the hall, and changing one changes the other. The type is Times and Helvetica because the printer had nothing else; the Welsh circumflex is set by hand, which is also how the Coblynau set type.',
      { size: 9.5 },
    ) - 6;
  body(
    y,
    'Made by Hungovercoders with Claude Code. Steward of Annwn is a work of affection for Dungeon Keeper and for the Mabinogion, and claims no part of either.',
    { size: 9.5 },
  );
  doc.textUpsideDown(A5.w - M, M + 40, `The answer is “${answer}”. You looked.`, 'F2', 8, SOFT);
}

// ---- contents, now that every page number is known
{
  const saved = doc.cur;
  doc.cur = doc.pages[contentsPage - 1];
  let y = contentsY;
  for (const s of sections) {
    doc.text(M, y - 10, s.title, 'F1', 10, INK);
    const n = String(s.page);
    doc.text(A5.w - M - textWidth(n, 'F5', 10), y - 10, n, 'F5', 10, INK);
    y -= 13;
  }
  doc.cur = saved;
}

mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist', 'manual.pdf'), doc.toBuffer());
console.log(`wrote dist/manual.pdf (${doc.pageNumber} pages)`);

// ---------------------------------------------------------------- reference card

const card = new Doc(A5.h, A5.w);
card.newPage();
{
  const W = A5.h;
  const H = A5.w;
  card.rect(0, 0, W, H, [0.93, 0.88, 0.76]);
  card.rect(10, 10, W - 20, H - 20, [0.96, 0.92, 0.82]);
  card.text(20, H - 30, 'STEWARD OF ANNWN', 'F3', 18, INK);
  card.text(20 + textWidth('STEWARD OF ANNWN', 'F3', 18) + 10, H - 30, 'Reference card. Keep it under the keyboard.', 'F2', 9, SOFT);
  card.line(20, H - 38, W - 20, H - 38, RULE, 0.8);
  const colW = (W - 40) / 3;
  const cols = [20, 20 + colW, 20 + colW * 2];
  const top = H - 52;
  // Column 1: tools
  let y = top;
  card.text(cols[0], y, 'TOOLS AND KEYS', 'F4', 7.5, SOFT);
  y -= 12;
  for (const [tool, key, text] of CONTROLS) {
    card.text(cols[0], y, key, 'F5', 8, INK);
    card.text(cols[0] + 34, y, tool, 'F3', 8, INK);
    const short = `${text.split('.')[0]}.`;
    y = card.paragraph(cols[0] + 34, y - 9, short, { size: 6.8, width: colW - 44, leading: 8 }) - 1;
  }
  // Column 2: rooms, engines, trades
  y = top;
  card.text(cols[1], y, 'ROOMS', 'F4', 7.5, SOFT);
  y -= 12;
  for (const r of ROOMS) {
    card.text(cols[1], y, `${r.cost}g`, 'F5', 8, INK);
    card.text(cols[1] + 34, y, r.name, 'F3', 8, INK);
    y -= 11;
  }
  y =
    card.paragraph(
      cols[1],
      y,
      'A room is a region of touching tiles; the largest counts. Treasury: 50g a tile, more in rooms of four or more. Sell for half.',
      { size: 6.8, width: colW - 12, leading: 8 },
    ) - 8;
  card.text(cols[1], y, 'ENGINES OF THE HALL', 'F4', 7.5, SOFT);
  y -= 12;
  for (const k of ENGINE_ORDER) {
    const e = ENGINES[k];
    card.text(cols[1], y, `${e.stats.cost}g`, 'F5', 8, INK);
    card.text(cols[1] + 34, y, e.name, 'F3', 8, INK);
    y -= 9;
    const line =
      k === 'boulder'
        ? `${e.stats.damage} damage, rolls ${e.stats.effect} tiles down a straight corridor`
        : k === 'pit'
          ? `${e.stats.damage} damage and slows for ${e.stats.effect}s`
          : `holds ${e.stats.effect}s, ${e.stats.damage}/s; offends the Fair Folk`;
    y = card.paragraph(cols[1] + 34, y, `${line}. ${e.stats.build}s of a Coblyn’s time. One use.`, { size: 6.8, width: colW - 44, leading: 8 }) - 2;
  }
  y -= 6;
  card.text(cols[1], y, 'THE EMISSARY’S TERMS', 'F4', 7.5, SOFT);
  y -= 12;
  for (const k of Object.keys(TRADES)) {
    card.text(cols[1], y, `${TRADES[k].cost}g`, 'F5', 8, INK);
    y = card.paragraph(cols[1] + 34, y, `${TRADES[k].label}: ${TRADES[k].text}`, { size: 6.8, width: colW - 44, leading: 8 }) - 2;
  }
  // Column 3: arrivals, waves
  y = top;
  card.text(cols[2], y, 'WHO ARRIVES', 'F4', 7.5, SOFT);
  y -= 12;
  for (const [who, rule] of ARRIVALS) {
    card.text(cols[2], y, who, 'F3', 8, INK);
    y = card.paragraph(cols[2], y - 9, rule, { size: 6.8, width: colW - 12, leading: 8 }) - 1;
  }
  y =
    card.paragraph(cols[2], y - 2, 'Checked every 7s, top to bottom. Payday every 60s from 90s; twice unpaid and a creature leaves.', {
      size: 6.8,
      width: colW - 12,
      leading: 8,
      font: 'F2',
    }) - 8;
  card.text(cols[2], y, 'WAVES', 'F4', 7.5, SOFT);
  y -= 12;
  for (const sched of [CAIRN, SIEGE]) {
    card.text(cols[2], y, sched.name, 'F3', 8, INK);
    y -= 9;
    for (const w of sched.waves) {
      y = card.paragraph(cols[2], y, `${w.at}s: ${composition(w, true)}`, { size: 6.8, width: colW - 12, leading: 8 }) - 1;
    }
    y -= 4;
  }
  card.text(
    20,
    18,
    'Win: the last wave cleared with no mortal in the hall. Lose: the Heart (100) at nothing. Heroes tunnel rock at a quarter speed; give them a corridor you chose.',
    'F2',
    7,
    SOFT,
  );
}
writeFileSync(join(root, 'dist', 'reference-card.pdf'), card.toBuffer());
console.log('wrote dist/reference-card.pdf (1 page)');
