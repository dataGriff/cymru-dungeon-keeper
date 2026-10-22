import { describe, expect, it } from 'vitest';
import { crispSize, fitBoard, fixedBoard } from './scale';

const BOARD = 672; // 24 tiles of 28 canvas pixels: 336 art pixels

const whole = (n: number): boolean => Math.abs(n - Math.round(n)) < 1e-9;

describe('pixel-perfect board sizing', () => {
  it('fits the largest whole number of device pixels per art pixel, at every width from 360 to 2560', () => {
    for (const dpr of [1, 1.25, 1.5, 2, 3]) {
      for (let screen = 360; screen <= 2560; screen += 8) {
        const available = Math.min(screen, 1140) - 20;
        const { k, width } = fitBoard(BOARD, available, dpr);
        expect(whole((width * dpr) / 336), `${screen}px @${dpr}`).toBe(true);
        if (336 / dpr <= available) expect(width).toBeLessThanOrEqual(available + 1e-9);
        // One more step would not fit.
        expect((336 * (k + 1)) / dpr).toBeGreaterThan(available);
      }
    }
  });

  it('shows the board 1:1 on a desktop column and at half size on a narrow phone at 2x', () => {
    expect(fitBoard(BOARD, 672, 1)).toEqual({ k: 2, width: 672 });
    expect(fitBoard(BOARD, 340, 2)).toEqual({ k: 2, width: 336 });
    expect(fitBoard(BOARD, 340, 1)).toEqual({ k: 1, width: 336 });
  });

  it('never goes below one device pixel per art pixel', () => {
    expect(fitBoard(BOARD, 100, 1).k).toBe(1);
  });

  it('snaps a chosen scale to whole device pixels', () => {
    expect(fixedBoard(BOARD, 2, 1)).toEqual({ k: 4, width: 1344 });
    expect(whole((fixedBoard(BOARD, 1, 1.25).width * 1.25) / 336)).toBe(true);
  });

  it('sizes icons and portraits on whole device pixels', () => {
    expect(crispSize(112, 7, 112, 1)).toBe(112);
    expect(whole((crispSize(24, 2, 24, 1.5) * 1.5) / 12)).toBe(true);
  });
});
