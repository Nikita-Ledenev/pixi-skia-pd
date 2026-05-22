import * as PIXI from 'pixi.js-legacy';

export interface PixiSetup {
  app: PIXI.Application;
  mainContainer: PIXI.Container;
  subContainer: PIXI.Container;
}

export interface PixiSetupOptions {
  host: HTMLElement;
  width: number;
  height: number;
  background: number;
}

/**
 * Creates a Pixi application using the Canvas (non-WebGL) backend, as required
 * by the task spec ("forceCanvas: true"). The Pixi canvas is appended to
 * `options.host`.
 */
export function createPixiApp(options: PixiSetupOptions): PixiSetup {
  const app = new PIXI.Application({
    width: options.width,
    height: options.height,
    background: options.background,
    antialias: true,
    forceCanvas: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });

  // pixi.js-legacy 7.x: `app.view` is typed as HTMLCanvasElement | OffscreenCanvas;
  // with forceCanvas we always get an HTMLCanvasElement.
  const view = app.view as HTMLCanvasElement;
  view.style.width = `${options.width}px`;
  view.style.height = `${options.height}px`;
  options.host.appendChild(view);

  const mainContainer = new PIXI.Container();
  const subContainer = new PIXI.Container();
  app.stage.addChild(mainContainer);

  return { app, mainContainer, subContainer };
}
