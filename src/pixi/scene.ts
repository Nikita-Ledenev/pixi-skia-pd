import * as PIXI from 'pixi.js-legacy';
import { log } from '../util/log';

/**
 * Builds the example scene exactly as shown in the task brief. Returns the
 * `mainContainer` that should be added to the Pixi stage; the function also
 * wires up `pointerdown`/`pointerup` listeners on a couple of children so that
 * interactivity can be observed.
 */
export function buildExampleScene(): PIXI.Container {
  const mainContainer = new PIXI.Container();
  const subContainer = new PIXI.Container();
  const g1 = new PIXI.Graphics();
  const g2 = new PIXI.Graphics();
  const g3 = new PIXI.Graphics();
  const g4 = new PIXI.Graphics();

  // Red ellipse with rotation; logs pointerdown.
  g1.beginFill(0xff0000).drawEllipse(0, 0, 200, 100).endFill();
  g1.position.set(200, 100);
  g1.angle = 30;

  // Blue rect, scaled and rotated; logs pointerup.
  g2.beginFill(0x0000ff).drawRect(-50, -75, 100, 150).endFill();
  g2.position.set(120, 60);
  g2.angle = 15;
  g2.scale.set(1.5, 1.7);

  // White line.
  g3.lineStyle(10, 0xffffff, 1).moveTo(0, 0).lineTo(150, 100);
  g3.angle = -20;

  // Yellow line.
  g4.lineStyle(10, 0xffff00, 1).moveTo(0, 70).lineTo(150, -30);
  g4.angle = 20;

  subContainer.position.set(75, 50);
  subContainer.addChild(g3, g4);
  mainContainer.addChild(subContainer, g1, g2);

  // Interactive: spec requires both pointerdown and pointerup wiring.
  enableInteractivity(g1, 'g1', { pointerdown: true });
  enableInteractivity(g2, 'g2', { pointerup: true });

  return mainContainer;
}

interface ListenerSpec {
  pointerdown?: boolean;
  pointerup?: boolean;
}

function enableInteractivity(
  obj: PIXI.DisplayObject,
  label: string,
  listeners: ListenerSpec,
): void {
  // pixi 7+ uses eventMode; we set it on every interactive node.
  (obj as PIXI.Container).eventMode = 'static';
  (obj as PIXI.Container).cursor = 'pointer';

  if (listeners.pointerdown) {
    obj.on('pointerdown', () => log(`${label} pointerdown!`));
  }
  if (listeners.pointerup) {
    obj.on('pointerup', () => log(`${label} pointerup!`));
  }
}
