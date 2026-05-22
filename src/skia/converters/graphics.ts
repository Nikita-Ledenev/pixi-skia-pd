import * as PIXI from 'pixi.js-legacy';
import type { CanvasKit, Canvas as SkCanvas, Paint as SkPaint } from 'canvaskit-wasm';
import { pixiColorToFloat } from '../../util/color';

const { SHAPES } = PIXI;

/**
 * Renders a single `PIXI.Graphics` instance onto a Skia canvas. The caller
 * is expected to have already applied the parent transform via `canvas.save()`
 * / `canvas.concat(...)`. We additionally apply the Graphics' own
 * `localTransform` here so that nested matrices keep working.
 *
 * Each `GraphicsData` entry is turned into an `SkPath`, then stroked and/or
 * filled depending on which Pixi styles are active.
 */
export function drawPixiGraphics(
  ck: CanvasKit,
  skCanvas: SkCanvas,
  graphics: PIXI.Graphics,
  parentAlpha: number,
): void {
  const geometry = graphics.geometry as PIXI.GraphicsGeometry;
  const dataList = geometry.graphicsData;
  if (!dataList || dataList.length === 0) return;

  const objectAlpha = parentAlpha * graphics.alpha;

  for (const data of dataList) {
    const path = buildPath(ck, data);
    if (!path) continue;

    // Apply a per-shape transform if Pixi recorded one (rare, but supported).
    if (data.matrix) {
      const m = data.matrix;
      // CanvasKit Path lacks .concat; we transform path points instead.
      // Build a 6-tuple [a, c, tx, b, d, ty] which is the affine slice.
      path.transform(m.a, m.c, m.tx, m.b, m.d, m.ty);
    }

    // FILL
    const fillStyle = data.fillStyle as PIXI.FillStyle;
    if (fillStyle && fillStyle.visible) {
      const paint = makePaint(ck, fillStyle.color, fillStyle.alpha * objectAlpha, /* stroke */ false);
      skCanvas.drawPath(path, paint);
      paint.delete();
    }

    // STROKE
    const lineStyle = data.lineStyle as PIXI.LineStyle;
    if (lineStyle && lineStyle.visible && lineStyle.width > 0) {
      const paint = makePaint(ck, lineStyle.color, lineStyle.alpha * objectAlpha, /* stroke */ true);
      paint.setStrokeWidth(lineStyle.width);
      paint.setStrokeCap(strokeCap(ck, lineStyle.cap));
      paint.setStrokeJoin(strokeJoin(ck, lineStyle.join));
      paint.setStrokeMiter(lineStyle.miterLimit);
      skCanvas.drawPath(path, paint);
      paint.delete();
    }

    path.delete();
  }
}

function makePaint(ck: CanvasKit, color: number, alpha: number, stroke: boolean): SkPaint {
  const paint = new ck.Paint();
  const [r, g, b, a] = pixiColorToFloat(color, clamp01(alpha));
  paint.setColor(ck.Color4f(r, g, b, a));
  paint.setStyle(stroke ? ck.PaintStyle.Stroke : ck.PaintStyle.Fill);
  paint.setAntiAlias(true);
  return paint;
}

function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Builds a Skia `Path` describing the geometry of one `GraphicsData` entry.
 * We deliberately ignore `holes` for primitives because the example sets do
 * not use them; if needed, holes could be appended as sub-paths with the
 * `EvenOdd` fill type.
 */
function buildPath(ck: CanvasKit, data: PIXI.GraphicsData): InstanceType<CanvasKit['Path']> | null {
  const path = new ck.Path();
  const shape = data.shape;
  switch (data.type) {
    case SHAPES.RECT: {
      const r = shape as PIXI.Rectangle;
      path.addRect(ck.LTRBRect(r.x, r.y, r.x + r.width, r.y + r.height));
      break;
    }
    case SHAPES.CIRC: {
      const c = shape as PIXI.Circle;
      path.addOval(ck.LTRBRect(c.x - c.radius, c.y - c.radius, c.x + c.radius, c.y + c.radius));
      break;
    }
    case SHAPES.ELIP: {
      const e = shape as PIXI.Ellipse;
      // Pixi `Ellipse(x, y, width, height)` describes an axis-aligned ellipse
      // centred at (x, y) with horizontal radius `width` and vertical radius
      // `height` — i.e. width/height ARE the radii.
      path.addOval(ck.LTRBRect(e.x - e.width, e.y - e.height, e.x + e.width, e.y + e.height));
      break;
    }
    case SHAPES.RREC: {
      const r = shape as PIXI.RoundedRectangle;
      path.addRRect(
        ck.RRectXY(ck.LTRBRect(r.x, r.y, r.x + r.width, r.y + r.height), r.radius, r.radius),
      );
      break;
    }
    case SHAPES.POLY: {
      const poly = shape as PIXI.Polygon;
      const points = poly.points;
      if (points.length < 2) {
        path.delete();
        return null;
      }
      path.moveTo(points[0], points[1]);
      for (let i = 2; i < points.length; i += 2) {
        path.lineTo(points[i], points[i + 1]);
      }
      if (poly.closeStroke) path.close();
      break;
    }
    default:
      path.delete();
      return null;
  }
  return path;
}

function strokeCap(ck: CanvasKit, cap: PIXI.LINE_CAP | undefined) {
  switch (cap) {
    case PIXI.LINE_CAP.ROUND:
      return ck.StrokeCap.Round;
    case PIXI.LINE_CAP.SQUARE:
      return ck.StrokeCap.Square;
    default:
      return ck.StrokeCap.Butt;
  }
}

function strokeJoin(ck: CanvasKit, join: PIXI.LINE_JOIN | undefined) {
  switch (join) {
    case PIXI.LINE_JOIN.ROUND:
      return ck.StrokeJoin.Round;
    case PIXI.LINE_JOIN.BEVEL:
      return ck.StrokeJoin.Bevel;
    default:
      return ck.StrokeJoin.Miter;
  }
}
