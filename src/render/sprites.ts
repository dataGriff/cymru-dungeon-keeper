/**
 * Rectangle-built pixel figures for every beast, used by the board and the
 * manual portrait alike. Each figure lives on a 12x14 logical grid facing
 * right; `drawBeast` scales and flips it.
 *
 * To swap in a real sprite sheet later, implement `BeastRenderer` and pass it
 * to `setBeastRenderer`. Nothing else needs to change.
 */
import type { BeastKind } from '../data/bestiary';

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
}

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

const C = {
  skin: '#d2a97c',
  skinDark: '#a57b55',
  cap: '#5c3a28',
  tunic: '#6f4a2e',
  wood: '#7a5230',
  iron: '#9ea4ad',
  ironDark: '#6b7079',
  ink: '#0b0a12',
  white: '#f4f1ea',
  whiteShade: '#cfc9bf',
  wound: '#d8303a',
  pwca: '#14121c',
  pwcaEdge: '#2b2639',
  lamp: '#ffe34a',
  green: '#3f7a3a',
  greenDark: '#2c5428',
  greenLight: '#6a9e5a',
  beaver: '#5a3a1e',
  tooth: '#f7f2e4',
  steel: '#9aa0a8',
  steelDark: '#6f757e',
  plume: '#d8232a',
  shield: '#5b4a3a',
  sack: '#8f7c58',
  sackDark: '#6b5b40',
  rope: '#4e3e26',
  beard: '#b9b2a6',
  hair: '#4b3425',
  gwyllgi: '#1b1a22',
  gwyllgiEdge: '#33313d',
  forge: '#ff7a1f',
  water: '#8fa7b8',
  waterDark: '#5d7384',
  mist: '#d9e4ea',
  fair: '#e8e2cf',
  fairGold: '#d8b85a',
  fairGreen: '#4f7f63',
} as const;

const FIGURES: Record<BeastKind, readonly Rect[]> = {
  coblyn: [
    r(4, 1, 4, 1, C.cap),
    r(3, 2, 6, 1, C.cap),
    r(4, 3, 4, 3, C.skin),
    r(7, 4, 1, 1, C.ink),
    r(4, 6, 4, 4, C.tunic),
    r(4, 10, 1, 3, C.skinDark),
    r(7, 10, 1, 3, C.skinDark),
    r(9, 5, 1, 5, C.wood),
    r(8, 4, 3, 1, C.iron),
    r(2, 7, 2, 1, C.skin),
  ],
  cwn: [
    r(1, 5, 1, 2, C.white),
    r(2, 6, 8, 4, C.white),
    r(3, 9, 6, 1, C.whiteShade),
    r(8, 4, 4, 4, C.white),
    r(8, 3, 1, 2, C.wound),
    r(10, 3, 1, 2, C.wound),
    r(10, 5, 1, 1, C.wound),
    r(11, 7, 1, 1, C.ink),
    r(2, 10, 1, 3, C.white),
    r(4, 10, 1, 3, C.whiteShade),
    r(7, 10, 1, 3, C.white),
    r(9, 10, 1, 3, C.whiteShade),
  ],
  pwca: [
    r(5, 1, 3, 3, C.pwca),
    r(5, 1, 3, 1, C.pwcaEdge),
    r(5, 2, 1, 1, C.lamp),
    r(7, 2, 1, 1, C.lamp),
    r(6, 4, 1, 1, C.pwca),
    r(5, 5, 3, 5, C.pwca),
    r(5, 5, 1, 5, C.pwcaEdge),
    r(3, 5, 2, 1, C.pwca),
    r(8, 5, 2, 1, C.pwca),
    r(2, 6, 1, 3, C.pwca),
    r(10, 6, 1, 3, C.pwca),
    r(5, 10, 1, 4, C.pwca),
    r(7, 10, 1, 4, C.pwca),
  ],
  afanc: [
    r(0, 7, 2, 3, C.beaver),
    r(1, 5, 9, 5, C.green),
    r(2, 4, 7, 1, C.greenDark),
    r(2, 8, 7, 2, C.greenLight),
    r(8, 6, 4, 3, C.green),
    r(10, 7, 2, 2, C.greenDark),
    r(9, 6, 1, 1, C.lamp),
    r(10, 9, 1, 1, C.tooth),
    r(2, 10, 2, 3, C.greenDark),
    r(7, 10, 2, 3, C.greenDark),
  ],
  gwyllgi: [
    r(1, 4, 1, 2, C.gwyllgi),
    r(2, 5, 8, 5, C.gwyllgi),
    r(2, 5, 8, 1, C.gwyllgiEdge),
    r(8, 3, 4, 4, C.gwyllgi),
    r(8, 2, 1, 1, C.gwyllgi),
    r(10, 2, 1, 1, C.gwyllgi),
    r(10, 4, 1, 1, C.forge),
    r(11, 6, 1, 1, C.gwyllgiEdge),
    r(2, 10, 2, 3, C.gwyllgi),
    r(5, 10, 1, 3, C.gwyllgiEdge),
    r(7, 10, 2, 3, C.gwyllgi),
  ],
  ceffyl: [
    r(0, 6, 1, 3, C.waterDark),
    r(1, 5, 7, 4, C.water),
    r(2, 8, 5, 1, C.waterDark),
    r(7, 2, 2, 5, C.water),
    r(8, 1, 1, 1, C.water),
    r(9, 3, 3, 2, C.water),
    r(11, 4, 1, 1, C.waterDark),
    r(10, 3, 1, 1, C.ink),
    r(6, 1, 1, 4, C.mist),
    r(5, 0, 1, 2, C.mist),
    r(1, 9, 1, 4, C.water),
    r(3, 9, 1, 4, C.waterDark),
    r(5, 9, 1, 4, C.water),
    r(7, 9, 1, 4, C.waterDark),
  ],
  teg: [
    r(4, 0, 4, 1, C.fairGold),
    r(4, 1, 4, 3, C.fair),
    r(7, 2, 1, 1, C.fairGreen),
    r(3, 4, 6, 7, C.fairGreen),
    r(4, 5, 4, 5, C.fair),
    r(3, 11, 6, 1, C.fairGold),
    r(4, 12, 1, 2, C.fair),
    r(7, 12, 1, 2, C.fair),
    r(9, 5, 2, 1, C.fair),
    r(10, 2, 1, 4, C.fairGold),
    r(2, 6, 1, 2, C.fair),
  ],
  knight: [
    r(5, 0, 1, 1, C.plume),
    r(6, 0, 1, 2, C.plume),
    r(4, 2, 4, 3, C.steel),
    r(7, 3, 1, 1, C.ink),
    r(4, 5, 4, 5, C.steelDark),
    r(5, 6, 2, 3, C.steel),
    r(2, 6, 2, 3, C.shield),
    r(2, 7, 2, 1, C.plume),
    r(9, 3, 1, 6, C.iron),
    r(8, 7, 3, 1, C.ironDark),
    r(4, 10, 1, 3, C.steel),
    r(7, 10, 1, 3, C.steel),
  ],
  priest: [
    r(4, 1, 4, 1, C.hair),
    r(4, 2, 4, 3, C.skin),
    r(7, 3, 1, 1, C.ink),
    r(5, 5, 3, 1, C.beard),
    r(3, 5, 6, 7, C.sack),
    r(3, 9, 6, 1, C.rope),
    r(3, 11, 6, 1, C.sackDark),
    r(4, 12, 1, 2, C.skin),
    r(7, 12, 1, 2, C.skin),
    r(10, 1, 1, 12, C.wood),
    r(9, 2, 1, 1, C.iron),
    r(11, 3, 1, 1, C.iron),
    r(9, 4, 1, 1, C.iron),
    r(11, 5, 1, 1, C.iron),
  ],
};

export const pixelBeastRenderer: BeastRenderer = {
  draw(ctx, kind, cx, baseY, px, pose) {
    const bob = pose.moving ? Math.round(Math.abs(Math.sin(pose.t * 9))) : 0;
    const lie = pose.sleeping ? 2 : 0;
    const x0 = cx - (SPRITE_W / 2) * px;
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
  });
}
