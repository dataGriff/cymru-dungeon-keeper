/**
 * Pixel figures for every beast, used by the board, the manual portrait and
 * the HUD alike. Each figure is 16x16 logical pixels facing right, with feet
 * on the bottom row; `drawBeast` scales, flips and tints it. The art lives in
 * art/figures.json; the game draws from the baked sheet (public/sprites.png)
 * once it has loaded and from the figure runs until then.
 *
 * To use a hand-drawn sheet, keep the layout in public/sprites.json; to use
 * something else entirely, implement `BeastRenderer` and call
 * `setBeastRenderer`.
 */
import type { BeastKind, EngineKind } from '../data/bestiary';
import { FIGURES, figureRuns } from './figures';

export interface BeastTint {
  color: string;
  /** 0..1: how much of the tint covers the figure's own colours. */
  alpha: number;
}

export interface BeastPose {
  /** Animation clock in seconds. */
  t: number;
  /** -1 faces left, 1 faces right. */
  facing: -1 | 1;
  /** Walking bobs the figure; sleeping lays it lower. */
  moving: boolean;
  sleeping: boolean;
  /** Draw as a flat ink shape: a page in the manual not yet unlocked. */
  silhouette: boolean;
  /** What the beast is doing, for sheets with action frames. */
  action: BeastAction;
  /** Washes laid over the figure, in order: a hit flash, the dark it stands in. */
  tints: BeastTint[];
}

export type BeastAction = 'idle' | 'walk' | 'attack' | 'sleep' | 'eat' | 'dead';

export interface BeastRenderer {
  /** Draw `kind` with its feet at (cx, baseY), each logical pixel `px` wide. */
  draw(ctx: CanvasRenderingContext2D, kind: BeastKind, cx: number, baseY: number, px: number, pose: BeastPose): void;
}

export const SPRITE_W = FIGURES.width;
export const SPRITE_H = FIGURES.height;
const INK = FIGURES.outline;

/** Draw from the figure runs, with the simple motions the sheet bakes into frames. */
export const pixelBeastRenderer: BeastRenderer = {
  draw(ctx, kind, cx, baseY, px, pose) {
    const bob = pose.action === 'walk' ? Math.round(Math.abs(Math.sin(pose.t * 9))) : 0;
    const lie = pose.action === 'sleep' ? 2 : 0;
    const lunge = pose.action === 'attack' ? pose.facing * px : 0;
    const x0 = cx - (SPRITE_W / 2) * px + lunge;
    const y0 = baseY - SPRITE_H * px + (lie - bob) * px;
    const layers: { color: string | null; alpha: number }[] = [
      { color: pose.silhouette ? INK : null, alpha: 1 },
      ...pose.tints.map((t) => ({ color: t.color, alpha: t.alpha })),
    ];
    for (const layer of layers) {
      if (layer.alpha <= 0) continue;
      ctx.globalAlpha = layer.alpha;
      for (const [x, y, w, h, c] of figureRuns(kind)) {
        const fx = pose.facing === 1 ? x : SPRITE_W - x - w;
        ctx.fillStyle = layer.color ?? c;
        ctx.fillRect(Math.round(x0 + fx * px), Math.round(y0 + y * px), w * px, h * px);
      }
    }
    ctx.globalAlpha = 1;
  },
};

let renderer: BeastRenderer = pixelBeastRenderer;

export function setBeastRenderer(r: BeastRenderer): void {
  renderer = r;
}

interface SheetLayout {
  scale: number;
  cellW: number;
  cellH: number;
  frames: string[];
  kinds: string[];
}

/**
 * Draws from a sprite sheet laid out as public/sprites.json describes: one
 * row per kind, one column per frame. Falls back to the figure runs for any
 * kind the sheet lacks. Silhouettes and tints mask a frame to one colour on a
 * scratch canvas.
 */
export function createSheetRenderer(image: HTMLImageElement, layout: SheetLayout): BeastRenderer {
  const scratch = document.createElement('canvas');
  scratch.width = layout.cellW;
  scratch.height = layout.cellH;
  const sctx = scratch.getContext('2d');
  const frameIndex = (name: string): number => Math.max(0, layout.frames.indexOf(name));
  return {
    draw(ctx, kind, cx, baseY, px, pose) {
      const row = layout.kinds.indexOf(kind);
      if (row < 0 || !sctx) {
        pixelBeastRenderer.draw(ctx, kind, cx, baseY, px, pose);
        return;
      }
      let frame: string = pose.action;
      if (pose.action === 'walk') frame = `walk${1 + (Math.floor(pose.t * 8) % 4)}`;
      const col = frameIndex(frame);
      const sx = col * layout.cellW;
      const sy = row * layout.cellH;
      const w = SPRITE_W * px;
      const h = SPRITE_H * px;
      const x = Math.round(cx - w / 2);
      const y = Math.round(baseY - h);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      if (pose.facing === -1) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
      } else ctx.translate(x, y);
      /** The frame masked to one colour, drawn at `alpha`. */
      const wash = (color: string, alpha: number): void => {
        sctx.clearRect(0, 0, layout.cellW, layout.cellH);
        sctx.drawImage(image, sx, sy, layout.cellW, layout.cellH, 0, 0, layout.cellW, layout.cellH);
        sctx.globalCompositeOperation = 'source-in';
        sctx.fillStyle = color;
        sctx.fillRect(0, 0, layout.cellW, layout.cellH);
        sctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        ctx.drawImage(scratch, 0, 0, w, h);
        ctx.globalAlpha = 1;
      };
      if (pose.silhouette) wash(INK, 1);
      else ctx.drawImage(image, sx, sy, layout.cellW, layout.cellH, 0, 0, w, h);
      for (const t of pose.tints) if (t.alpha > 0.01) wash(t.color, Math.min(1, t.alpha));
      ctx.restore();
    },
  };
}

/** Load the sheet and switch to it; until it arrives the rectangle figures draw. */
export async function loadSpriteSheet(base = ''): Promise<boolean> {
  try {
    const layout = (await (await fetch(`${base}sprites.json`)).json()) as SheetLayout;
    const image = new Image();
    image.src = `${base}sprites.png`;
    await image.decode();
    setBeastRenderer(createSheetRenderer(image, layout));
    return true;
  } catch {
    return false;
  }
}

export function drawBeast(
  ctx: CanvasRenderingContext2D,
  kind: BeastKind,
  cx: number,
  baseY: number,
  px: number,
  pose: Partial<BeastPose> = {},
): void {
  renderer.draw(ctx, kind, cx, baseY, px, {
    t: pose.t ?? 0,
    facing: pose.facing ?? 1,
    moving: pose.moving ?? false,
    sleeping: pose.sleeping ?? false,
    silhouette: pose.silhouette ?? false,
    action: pose.action ?? (pose.sleeping ? 'sleep' : pose.moving ? 'walk' : 'idle'),
    tints: pose.tints ?? [],
  });
}

/** A pixel map (rows of palette keys, '.' transparent) drawn at `px` per pixel from its top-left. */
export function drawPixelMap(
  ctx: CanvasRenderingContext2D,
  rows: readonly string[],
  palette: Readonly<Record<string, string>>,
  x0: number,
  y0: number,
  px: number,
): void {
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x] ?? '.';
      if (ch === '.') {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      ctx.fillStyle = palette[ch] ?? '#ff00ff';
      ctx.fillRect(Math.round(x0 + x * px), Math.round(y0 + y * px), (end - x) * px, px);
      x = end;
    }
  });
}

/** Engines of the Hall: 14x14 pixel maps, one tile at 2px. */
export const ENGINE_ART: Record<EngineKind, { rows: string[]; palette: Record<string, string> }> = {
  pit: {
    palette: { e: '#2a2018', E: '#5a4630', k: '#07050c', L: '#8a6a42', l: '#5e4428' },
    rows: [
      '..............',
      '...eeeeeeee...',
      '..eEEEEEEEEe..',
      '.eEkkkkkkkkEe.',
      '.eELLLLLLLLEe.',
      '.eEklkklkkkEe.',
      '.eEkLkkkLkkEe.',
      '.eELLLLLLLLEe.',
      '.eEkkLkklkkEe.',
      '.eEkklkkLkkEe.',
      '.eELLLLLLLLEe.',
      '..eEEEEEEEEe..',
      '...eeeeeeee...',
      '..............',
    ],
  },
  boulder: {
    palette: { o: '#26222c', O: '#6b6570', H: '#a49eaa', s: '#47424f', w: '#7a5230', W: '#9a7044' },
    rows: [
      '..............',
      '.....oooo.....',
      '...ooOOOOoo...',
      '..oOHHOOOOOo..',
      '..oHHOOOOOOo..',
      '.oOHOOOOOOOOo.',
      '.oOOOOOOOOOso.',
      '.oOOOOOOOOsso.',
      '.oOOOOOOOssso.',
      '..oOOOOOssso..',
      '..ossOsssss...',
      '...oossssoo...',
      '...wWWWWWw....',
      '..............',
    ],
  },
  snare: {
    palette: { I: '#9ea4ad', i: '#6b7079', v: '#e8edf3', p: '#565b64', c: '#7a808a' },
    rows: [
      '..............',
      '..IIIIIIIIII..',
      '.IvivivivivI..',
      '.I.........I..',
      '.I...pppp..I..',
      '.IiiippppiiI..',
      '.I...pppp..I..',
      '.I.........I..',
      '.IvivivivivI..',
      '..IIIIIIIIII..',
      '.......c......',
      '......c.c.....',
      '.......c......',
      '..............',
    ],
  },
};

/** Draw an engine centred at (cx, cy); an unbuilt one is a ghost of itself. */
export function drawEngine(ctx: CanvasRenderingContext2D, kind: EngineKind, cx: number, cy: number, px: number, built = true): void {
  const art = ENGINE_ART[kind];
  ctx.globalAlpha = built ? 1 : 0.5;
  drawPixelMap(ctx, art.rows, art.palette, cx - 7 * px, cy - 7 * px, px);
  ctx.globalAlpha = 1;
}
