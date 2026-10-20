/**
 * Rectangle-built pixel figures for every beast, used by the board and the
 * manual portrait alike. Each figure lives on a 12x14 logical grid facing
 * right; `drawBeast` scales and flips it.
 *
 * To swap in a real sprite sheet later, implement `BeastRenderer` and pass it
 * to `setBeastRenderer`. Nothing else needs to change.
 */
import type { BeastKind, EngineKind } from '../data/bestiary';
import figuresJson from '../../art/figures.json';

export interface BeastPose {
  /** Animation clock in seconds. */
  t: number;
  /** -1 faces left, 1 faces right. */
  facing: -1 | 1;
  /** Walking bobs the figure; sleeping lays it lower. */
  moving: boolean;
  sleeping: boolean;
  /** Draw as a flat black shape: a page in the manual not yet unlocked. */
  silhouette: boolean;
  /** What the beast is doing, for sheets with action frames. */
  action: BeastAction;
}

export type BeastAction = 'idle' | 'walk' | 'attack' | 'sleep' | 'eat' | 'dead';

export interface BeastRenderer {
  /** Draw `kind` with its feet at (cx, baseY), each logical pixel `px` wide. */
  draw(ctx: CanvasRenderingContext2D, kind: BeastKind, cx: number, baseY: number, px: number, pose: BeastPose): void;
}

export const SPRITE_W = 12;
export const SPRITE_H = 14;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  c: string;
}

const r = (x: number, y: number, w: number, h: number, c: string): Rect => ({ x, y, w, h, c });

/** The editable source: palette and rectangle figures. `task sprites` renders it to public/sprites.png. */
const SOURCE = figuresJson as unknown as {
  width: number;
  height: number;
  frames: string[];
  palette: Record<string, string>;
  figures: Record<string, [number, number, number, number, string][]>;
};
const C = SOURCE.palette as Record<string, string> & { ink: string };

const FIGURES: Record<BeastKind, readonly Rect[]> = Object.fromEntries(
  Object.entries(SOURCE.figures).map(([kind, rects]) => [kind, rects.map(([x, y, w, h, c]) => r(x, y, w, h, C[c] ?? '#ff00ff'))]),
) as unknown as Record<BeastKind, readonly Rect[]>;

export const pixelBeastRenderer: BeastRenderer = {
  draw(ctx, kind, cx, baseY, px, pose) {
    const bob = pose.action === 'walk' ? Math.round(Math.abs(Math.sin(pose.t * 9))) : 0;
    const lie = pose.action === 'sleep' ? 2 : 0;
    const lunge = pose.action === 'attack' ? pose.facing * px : 0;
    const x0 = cx - (SPRITE_W / 2) * px + lunge;
    const y0 = baseY - SPRITE_H * px + (bob + lie) * px;
    for (const q of FIGURES[kind]) {
      const fx = pose.facing === 1 ? q.x : SPRITE_W - q.x - q.w;
      ctx.fillStyle = pose.silhouette ? C.ink : q.c;
      ctx.fillRect(Math.round(x0 + fx * px), Math.round(y0 + q.y * px), q.w * px, q.h * px);
    }
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
 * row per kind, one column per frame. Falls back to the rectangle figures
 * for any kind the sheet lacks. Silhouettes are made by masking a frame to
 * ink on a scratch canvas.
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
      if (pose.silhouette) {
        sctx.clearRect(0, 0, layout.cellW, layout.cellH);
        sctx.drawImage(image, sx, sy, layout.cellW, layout.cellH, 0, 0, layout.cellW, layout.cellH);
        sctx.globalCompositeOperation = 'source-in';
        sctx.fillStyle = C.ink;
        sctx.fillRect(0, 0, layout.cellW, layout.cellH);
        sctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(scratch, 0, 0, w, h);
      } else {
        ctx.drawImage(image, sx, sy, layout.cellW, layout.cellH, 0, 0, w, h);
      }
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
  });
}

/** Engines of the Hall, drawn on a 12x12 logical grid at `px` per pixel, centred at (cx, cy). */
export function drawEngine(ctx: CanvasRenderingContext2D, kind: EngineKind, cx: number, cy: number, px: number, built = true): void {
  const x0 = cx - 6 * px;
  const y0 = cy - 6 * px;
  const rect = (x: number, y: number, w: number, h: number, c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x0 + x * px), Math.round(y0 + y * px), w * px, h * px);
  };
  ctx.globalAlpha = built ? 1 : 0.55;
  if (kind === 'pit') {
    rect(1, 3, 10, 7, '#0b0a12');
    rect(2, 2, 8, 1, '#3a2f22');
    rect(1, 10, 10, 1, '#3a2f22');
    for (let i = 0; i < 4; i++) rect(2 + i * 2, 4, 1, 5, '#5a4a3a');
  } else if (kind === 'boulder') {
    rect(3, 1, 6, 10, '#5b5560');
    rect(1, 3, 10, 6, '#5b5560');
    rect(4, 2, 3, 3, '#7a7480');
    rect(2, 8, 7, 2, '#3b3640');
  } else {
    rect(1, 5, 10, 2, '#9ea4ad');
    rect(1, 3, 2, 6, '#9ea4ad');
    rect(9, 3, 2, 6, '#9ea4ad');
    rect(5, 4, 2, 4, '#6b7079');
    rect(3, 2, 1, 1, '#c9d3e8');
    rect(8, 9, 1, 1, '#c9d3e8');
  }
  ctx.globalAlpha = 1;
}
