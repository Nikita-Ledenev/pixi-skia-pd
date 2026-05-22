import * as PIXI from 'pixi.js-legacy';

import { attachLog, log } from './util/log';
import { createPixiApp } from './pixi/application';
import { buildExampleScene } from './pixi/scene';
import { addRandomGraphic } from './pixi/randomGraphics';
import { loadCanvasKit } from './skia/CanvasKitLoader';
import { PixiToSkiaRenderer } from './skia/PixiToSkia';
import { bridgeSkiaInput } from './interaction/skiaInputBridge';
import { downloadBlob, exportSceneToPdf } from './skia/pdfExport';

const STAGE_WIDTH = 600;
const STAGE_HEIGHT = 400;
const STAGE_BG = 0xfafbfd;

bootstrap().catch((err) => {
  console.error(err);
  log(`FATAL: ${(err as Error).message}`);
});

async function bootstrap(): Promise<void> {
  attachLog(document.getElementById('log') as HTMLPreElement);
  setStatus('Инициализация Pixi…');

  // 1. Pixi side -----------------------------------------------------------
  const pixiHost = document.getElementById('pixi-host') as HTMLElement;
  const { app, mainContainer } = createPixiApp({
    host: pixiHost,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    background: STAGE_BG,
  });

  // Build the example scene from the task brief.
  const scene = buildExampleScene();
  mainContainer.addChild(scene);

  // 2. Skia side -----------------------------------------------------------
  setStatus('Загрузка CanvasKit (Skia WASM)…');
  const ck = await loadCanvasKit();
  log('CanvasKit загружен.');

  const skiaCanvas = document.getElementById('skia-canvas') as HTMLCanvasElement;
  const skiaRenderer = new PixiToSkiaRenderer(ck, skiaCanvas, { background: STAGE_BG });
  log('Skia surface создан.');

  // Render Skia on every Pixi tick so the two canvases stay in sync.
  app.ticker.add(() => {
    // Pixi computes world transforms only when rendering; make sure they are
    // up to date even though we don't actually rely on `worldTransform`
    // anywhere — `localTransform` is updated by the transform's `updateLocalTransform()`.
    mainContainer.updateTransform();
    skiaRenderer.render(mainContainer);
  });

  // 3. Bridge pointer events from the Skia canvas back to Pixi ------------
  bridgeSkiaInput({
    canvas: skiaCanvas,
    root: mainContainer,
    stageWidth: STAGE_WIDTH,
    stageHeight: STAGE_HEIGHT,
  });

  // 4. UI wiring -----------------------------------------------------------
  const btnRandom = document.getElementById('btn-random') as HTMLButtonElement;
  btnRandom.addEventListener('click', () => {
    addRandomGraphic(scene, STAGE_WIDTH, STAGE_HEIGHT);
  });

  const btnExport = document.getElementById('btn-export') as HTMLButtonElement;
  btnExport.addEventListener('click', () => {
    try {
      setStatus('Экспорт PDF…');
      // PDF page in points (1pt = 1/72 inch); we map 1 stage-pixel → 1pt so
      // the output is A-ratio-agnostic and easy to compare with the screen.
      const blob = exportSceneToPdf(ck, mainContainer, {
        width: STAGE_WIDTH,
        height: STAGE_HEIGHT,
        title: 'Pixi → Skia → PDF',
        author: 'pixi-skia-pdf',
      });
      downloadBlob(blob, 'scene.pdf');
      setStatus('Готово. PDF скачан.');
      log(`PDF создан, размер ${(blob.size / 1024).toFixed(1)} KB`);
    } catch (err) {
      const message = (err as Error).message;
      setStatus(`Ошибка: ${message}`);
      log(`PDF ERROR: ${message}`);
    }
  });

  setStatus('Готово.');
  log('Сцена готова. Кликайте по фигурам — события работают на обоих канвасах.');

  // Expose for quick debugging in the console.
  (window as unknown as { __debug: unknown }).__debug = {
    PIXI,
    app,
    mainContainer,
    scene,
    ck,
  };
}

function setStatus(text: string): void {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}
