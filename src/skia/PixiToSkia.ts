import * as PIXI from 'pixi.js-legacy';
import type {
  CanvasKit,
  Canvas as SkCanvas,
  Surface as SkSurface,
} from 'canvaskit-wasm';

import { pixiMatrixToCanvasKit } from './converters/transform';
import { drawPixiGraphics } from './converters/graphics';
import { drawPixiSprite } from './converters/sprite';

export interface PixiToSkiaOptions {
  /** Background colour as Pixi-style 0xRRGGBB; alpha is fixed to 1. */
  background?: number;
}

/**
 * Custom wrapper around Skia that renders a `PIXI.Container` hierarchy.
 *
 * Walks the display tree depth-first, applies each node's local transform via
 * `SkCanvas.save() / concat() / restore()`, and delegates the actual painting
 * to per-type converters (Graphics, Sprite). The same traversal is used both
 * for screen rendering (`renderToSurface`) and for vector PDF generation
 * (`renderToCanvas`), so the two outputs cannot drift apart.
 */
export class PixiToSkiaRenderer {
  private surface: SkSurface | null = null;

  constructor(
    private readonly ck: CanvasKit,
    target: HTMLCanvasElement,
    private readonly options: PixiToSkiaOptions = {},
  ) {
    this.surface = ck.MakeSWCanvasSurface(target);
    if (!this.surface) {
      throw new Error('CanvasKit: failed to create SW canvas surface');
    }
  }

  /** Re-renders the entire scene to the on-screen Skia canvas. */
  render(root: PIXI.Container): void {
    if (!this.surface) return;
    const skCanvas = this.surface.getCanvas();
    this.clearBackground(skCanvas);
    this.renderToCanvas(skCanvas, root);
    this.surface.flush();
  }

  /**
   * Walks the Pixi tree and paints it onto an arbitrary SkCanvas. This is
   * what the PDF backend calls, so we keep rendering logic in a single spot.
   */
  renderToCanvas(skCanvas: SkCanvas, root: PIXI.Container): void {
    this.paintNode(skCanvas, root, 1);
  }

  dispose(): void {
    this.surface?.delete();
    this.surface = null;
  }

  // -- internals -----------------------------------------------------------

  private clearBackground(skCanvas: SkCanvas): void {
    const bg = this.options.background;
    if (bg === undefined) {
      skCanvas.clear(this.ck.TRANSPARENT);
      return;
    }
    const r = ((bg >> 16) & 0xff) / 255;
    const g = ((bg >> 8) & 0xff) / 255;
    const b = (bg & 0xff) / 255;
    skCanvas.clear(this.ck.Color4f(r, g, b, 1));
  }

  /**
   * Recursive worker that applies the node's local transform, paints it,
   * then descends into children. We multiply `parentAlpha` instead of
   * concatenating an alpha-only matrix because Pixi's alpha is independent
   * of the world transform.
   */
  private paintNode(skCanvas: SkCanvas, node: PIXI.DisplayObject, parentAlpha: number): void {
    if (!node.visible) return;
    if (node.alpha === 0) return;

    skCanvas.save();
    skCanvas.concat(pixiMatrixToCanvasKit(node.transform.localTransform));

    const alpha = parentAlpha * node.alpha;

    if (node instanceof PIXI.Sprite) {
      drawPixiSprite(this.ck, skCanvas, node, alpha);
    } else if (node instanceof PIXI.Graphics) {
      drawPixiGraphics(this.ck, skCanvas, node, alpha);
    }

    if (node instanceof PIXI.Container) {
      for (const child of node.children) {
        this.paintNode(skCanvas, child, alpha);
      }
    }

    skCanvas.restore();
  }
}
