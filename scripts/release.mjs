#!/usr/bin/env node
/**
 * Build the web bundle, zip it, gather the downloads, and push to itch.io
 * with butler when it is on PATH and ITCH_USER / ITCH_GAME are set.
 * Otherwise it prints the exact butler commands to run.
 *
 *   node scripts/release.mjs      # or: task release
 */
import { execSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const out = join(root, 'release');
const downloads = join(out, 'downloads');
const zipPath = join(out, 'annwn-web.zip');

const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' });
const has = (bin) => spawnSync(process.platform === 'win32' ? 'where' : 'which', [bin], { stdio: 'ignore' }).status === 0;

console.log('== building the web bundle');
run('npm run build');
if (!existsSync(join(dist, 'index.html'))) throw new Error('dist/index.html is missing after the build');

rmSync(out, { recursive: true, force: true });
mkdirSync(downloads, { recursive: true });

// ---- zip ----
console.log('== zipping dist/');
if (has('zip')) {
  execSync(`zip -qr "${zipPath}" .`, { cwd: dist, stdio: 'inherit' });
} else {
  writeZip(zipPath, dist);
}
console.log(`   ${relative(root, zipPath)} (${Math.round(statSync(zipPath).size / 1024)} KB)`);

// ---- downloads ----
console.log('== gathering downloads');
const wanted = [
  ['docs/box/front.png', 'box-front.png'],
  ['docs/box/back.png', 'box-back.png'],
  ['docs/box/box-3d.png', 'box-3d.png'],
  ['dist/manual.pdf', 'manual.pdf'],
  ['dist/reference-card.pdf', 'reference-card.pdf'],
];
const gathered = [];
for (const [src, name] of wanted) {
  const p = join(root, src);
  if (!existsSync(p)) {
    console.log(`   (skipped ${src}: not built; run task box / task manual)`);
    continue;
  }
  copyFileSync(p, join(downloads, name));
  gathered.push(name);
}
console.log(`   ${gathered.length ? gathered.join(', ') : 'nothing'} -> release/downloads/`);

// ---- butler ----
const user = process.env.ITCH_USER;
const game = process.env.ITCH_GAME;
const target = `${user ?? '<ITCH_USER>'}/${game ?? '<ITCH_GAME>'}`;
const cmds = [`butler push release/annwn-web.zip ${target}:html5`, `butler push release/downloads ${target}:downloads`];
if (has('butler') && user && game) {
  console.log('== pushing with butler');
  for (const c of cmds) run(c);
  console.log('== done');
} else {
  console.log('== butler not run' + (has('butler') ? ' (set ITCH_USER and ITCH_GAME)' : ' (butler is not on PATH: https://itch.io/docs/butler/)'));
  console.log('   To upload, run:');
  for (const c of cmds) console.log(`     ${c}`);
}

// ---- a small zip writer, for machines without `zip` ----
function writeZip(targetPath, dir) {
  const files = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(dir);
  const crcTable = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c;
  }
  const crc32 = (buf) => {
    let c = -1;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const parts = [];
  const central = [];
  let offset = 0;
  const dosTime = 0x0000;
  const dosDate = 0x5821; // 2024-01-01, good enough for an archive
  for (const file of files) {
    const name = Buffer.from(relative(dir, file).split('\\').join('/'), 'utf8');
    const data = readFileSync(file);
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(dosTime, 12);
    entry.writeUInt16LE(dosDate, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt16LE(0, 30);
    entry.writeUInt16LE(0, 32);
    entry.writeUInt16LE(0, 34);
    entry.writeUInt16LE(0, 36);
    entry.writeUInt32LE(0, 38);
    entry.writeUInt32LE(offset, 42);
    parts.push(local, name, packed);
    central.push(entry, name);
    offset += local.length + name.length + packed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  writeFileSync(targetPath, Buffer.concat([...parts, centralBuf, end]));
}
