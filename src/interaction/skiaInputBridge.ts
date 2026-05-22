import * as PIXI from 'pixi.js-legacy';
import { hitTest, toScenePoint } from './skiaHitTest';

export interface SkiaInputBridgeOptions {
  canvas: HTMLCanvasElement;
  root: PIXI.Container;
  stageWidth: number;
  stageHeight: number;
}

/**
 * Wires pointerdown / pointerup on a Skia canvas through a manual hit-test
 * and re-emits the events on the matching DisplayObject. Pixi listeners
 * attached via `.on('pointerdown', ...)` therefore fire on BOTH canvases,
 * fulfilling the interactivity requirement of the task.
 *
 * Returns a disposer that detaches all listeners.
 */
export function bridgeSkiaInput(opts: SkiaInputBridgeOptions): () => void {
  const handle = (eventName: 'pointerdown' | 'pointerup') => (ev: PointerEvent) => {
    const point = toScenePoint(opts.canvas, ev.clientX, ev.clientY, opts.stageWidth, opts.stageHeight);
    const target = hitTest(opts.root, point);
    if (!target) return;
    // Re-emit as a synthetic Pixi event so user code keeps working.
    // We bypass the strict FederatedEvent type — listeners attached via
    // `.on('pointerdown', ...)` only read what they need.
    const synthetic = {
      data: { global: point, originalEvent: ev },
      target,
      currentTarget: target,
      type: eventName,
    } as unknown as PIXI.FederatedPointerEvent;
    target.emit(eventName, synthetic);
  };

  const onDown = handle('pointerdown');
  const onUp = handle('pointerup');
  opts.canvas.addEventListener('pointerdown', onDown);
  opts.canvas.addEventListener('pointerup', onUp);

  return () => {
    opts.canvas.removeEventListener('pointerdown', onDown);
    opts.canvas.removeEventListener('pointerup', onUp);
  };
}
