import type * as PIXI from 'pixi.js-legacy';

/**
 * Converts a Pixi affine `Matrix(a,b,c,d,tx,ty)` into the 3x3 row-major form
 * expected by CanvasKit `SkCanvas.concat()`.
 *
 * Pixi layout:           Skia layout:
 *  [a c tx]               [scaleX skewX  transX]
 *  [b d ty]      ↔        [skewY  scaleY transY]
 *  [0 0  1]               [0      0      1     ]
 */
export function pixiMatrixToCanvasKit(m: PIXI.Matrix): number[] {
  return [m.a, m.c, m.tx, m.b, m.d, m.ty, 0, 0, 1];
}
