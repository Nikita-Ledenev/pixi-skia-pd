import * as PIXI from 'pixi.js-legacy';

/**
 * Maps a (clientX, clientY) mouse position to scene-space coordinates for an
 * HTMLCanvasElement. Honours CSS scaling — i.e. if the canvas is displayed at
 * a different size from its backing buffer, we map back to the buffer-relative
 * coordinates expected by the Pixi scene.
 *
 * `stageWidth` / `stageHeight` should be the same nominal size used when
 * constructing the Pixi application (the scene-space dimensions, not the
 * devicePixelRatio-inflated buffer).
 */
export function toScenePoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  stageWidth: number,
  stageHeight: number,
): PIXI.Point {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * stageWidth;
  const y = ((clientY - rect.top) / rect.height) * stageHeight;
  return new PIXI.Point(x, y);
}

/**
 * Walks the display tree in reverse painter order and returns the topmost
 * interactive child whose geometry contains the given point. We deliberately
 * avoid touching Pixi's EventSystem because that one is bound to the Pixi
 * canvas; this is a small, dependency-free hit-tester for the *second* canvas.
 */
export function hitTest(root: PIXI.Container, globalPoint: PIXI.Point): PIXI.DisplayObject | null {
  return walk(root, globalPoint);
}

function walk(node: PIXI.DisplayObject, globalPoint: PIXI.Point): PIXI.DisplayObject | null {
  if (!node.visible) return null;

  // Containers: descend into children first (later children are drawn on top).
  if (node instanceof PIXI.Container && node.children.length > 0) {
    for (let i = node.children.length - 1; i >= 0; i -= 1) {
      const found = walk(node.children[i], globalPoint);
      if (found) return found;
    }
  }

  // Non-interactive nodes are skipped, matching Pixi's own EventSystem behaviour.
  if ((node as PIXI.Container).eventMode !== 'static' && !(node as { interactive?: boolean }).interactive) {
    return null;
  }

  // Pixi's Graphics & Sprite both expose `containsPoint`, which expects a
  // global point and internally converts to local coords.
  const target = node as unknown as { containsPoint?: (p: PIXI.IPointData) => boolean };
  if (typeof target.containsPoint === 'function' && target.containsPoint(globalPoint)) {
    return node;
  }

  return null;
}
