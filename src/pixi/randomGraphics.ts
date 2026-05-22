import * as PIXI from 'pixi.js-legacy';
import { log } from '../util/log';

const PALETTE = [
  0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0x00b4d8, 0xf08080,
];

/**
 * Adds a random Graphics primitive (rectangle, ellipse, polygon or line)
 * to the given container. Random objects react to `pointerdown` so the user
 * can see that interaction keeps working on both canvases.
 */
export function addRandomGraphic(container: PIXI.Container, stageWidth: number, stageHeight: number): void {
  const g = new PIXI.Graphics();
  const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
  const kind = Math.floor(Math.random() * 4);

  switch (kind) {
    case 0:
      // Filled rectangle.
      g.beginFill(color, 0.85)
        .drawRect(-40, -25, 80, 50)
        .endFill();
      break;
    case 1: {
      // Filled ellipse.
      const rx = 25 + Math.random() * 45;
      const ry = 20 + Math.random() * 35;
      g.beginFill(color, 0.85).drawEllipse(0, 0, rx, ry).endFill();
      break;
    }
    case 2: {
      // Filled triangle via polygon.
      const r = 30 + Math.random() * 30;
      g.beginFill(color, 0.85)
        .drawPolygon([0, -r, r, r, -r, r])
        .endFill();
      break;
    }
    default: {
      // Stroked line.
      const x2 = (Math.random() - 0.5) * 200;
      const y2 = (Math.random() - 0.5) * 200;
      g.lineStyle(3 + Math.random() * 5, color, 1).moveTo(0, 0).lineTo(x2, y2);
      break;
    }
  }

  // Random transform inside the canvas.
  g.position.set(
    40 + Math.random() * (stageWidth - 80),
    40 + Math.random() * (stageHeight - 80),
  );
  g.angle = Math.random() * 360;

  // Interactivity: log a click for any random shape.
  g.eventMode = 'static';
  g.cursor = 'pointer';
  const id = `rnd#${container.children.length + 1}`;
  g.on('pointerdown', () => log(`${id} pointerdown!`));
  g.on('pointerup', () => log(`${id} pointerup!`));

  container.addChild(g);
  log(`Добавлен случайный элемент: ${id} (kind=${kind})`);
}
