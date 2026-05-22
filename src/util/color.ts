// Converts Pixi color (number) + alpha into a CanvasKit Color4f tuple.
// CanvasKit expects [r, g, b, a] floats in [0,1].
export function pixiColorToFloat(
  color: number,
  alpha = 1,
): [number, number, number, number] {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  return [r, g, b, alpha];
}
