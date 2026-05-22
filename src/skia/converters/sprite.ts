import * as PIXI from 'pixi.js-legacy';
import type { CanvasKit, Canvas as SkCanvas, Image as SkImage } from 'canvaskit-wasm';

/**
 * Map of Pixi BaseTexture → SkImage so that we decode each source only once.
 * Decoding from encoded bytes is synchronous from CanvasKit's perspective but
 * requires the bytes to be in memory — we lazily populate this map.
 */
const skImageCache = new WeakMap<PIXI.BaseTexture, SkImage>();

/**
 * Pre-registers a SkImage for a given BaseTexture. Useful when you already
 * have the encoded bytes around (e.g. fetched png) and want to ensure the
 * sprite renders correctly on the very first frame.
 */
export function registerSkImage(baseTexture: PIXI.BaseTexture, skImage: SkImage): void {
  skImageCache.set(baseTexture, skImage);
}

export function drawPixiSprite(
  ck: CanvasKit,
  skCanvas: SkCanvas,
  sprite: PIXI.Sprite,
  parentAlpha: number,
): void {
  const baseTexture = sprite.texture.baseTexture;
  let skImage = skImageCache.get(baseTexture);

  if (!skImage) {
    // Lazy path: try to build an SkImage from whatever resource Pixi has.
    const built = makeSkImageFromBaseTexture(ck, baseTexture);
    if (!built) return;
    skImage = built;
    skImageCache.set(baseTexture, skImage);
  }

  // Pixi sprite anchor: drawing origin is shifted by (anchor.x * width,
  // anchor.y * height) before applying the texture frame.
  const width = sprite.width;
  const height = sprite.height;
  const ax = sprite.anchor.x * width;
  const ay = sprite.anchor.y * height;

  const dst = ck.LTRBRect(-ax, -ay, width - ax, height - ay);

  const paint = new ck.Paint();
  paint.setAntiAlias(true);
  paint.setAlphaf(parentAlpha * sprite.alpha);

  // Use cubic resampling for higher fidelity in PDF (still raster, but sharp).
  skCanvas.drawImageRectCubic(skImage, ck.LTRBRect(0, 0, baseTexture.realWidth, baseTexture.realHeight), dst, 1 / 3, 1 / 3, paint);
  paint.delete();
}

function makeSkImageFromBaseTexture(ck: CanvasKit, baseTexture: PIXI.BaseTexture): SkImage | null {
  const resource = baseTexture.resource as PIXI.ImageResource | PIXI.CanvasResource | undefined;
  if (!resource) return null;

  const source = (resource as { source?: unknown }).source;
  if (
    source instanceof HTMLImageElement ||
    source instanceof HTMLCanvasElement ||
    (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) ||
    (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap)
  ) {
    return ck.MakeImageFromCanvasImageSource(source as CanvasImageSource);
  }

  return null;
}
