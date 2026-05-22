# pixi-skia-pdf

Тестовое задание: TypeScript-приложение, которое объединяет возможности **`pixi.js`** и **Skia (CanvasKit)**, реализует собственную обёртку для рендера `PIXI.Container` через Skia и позволяет экспортировать сцену в **векторный PDF** через **Skia PDF backend**.

| Слева | Справа |
| --- | --- |
| Канвас Pixi (`pixi.js-legacy` + `forceCanvas: true`) | Канвас Skia (CanvasKit WASM) |

Оба канваса показывают одну и ту же сцену из одного `PIXI.Container`. События `pointerdown` / `pointerup` работают на обоих канвасах.

---

## Быстрый старт

```bash
npm install
npm run dev        # Vite dev server → http://localhost:5173
```

Открой `http://localhost:5173`. Сцена соответствует примеру из ТЗ.

- **«Сгенерировать случайную линию/фигуру»** — добавляет случайный `PIXI.Graphics` в контейнер. Шейп интерактивный — кликните по нему, увидите событие в логе.
- **«Экспорт в PDF»** — выгрузит `scene.pdf`. Требует **кастомную сборку CanvasKit с PDF backend** (см. ниже). Без неё рендер работает, но при экспорте появится понятная ошибка.

---

## Архитектура

```
src/
  main.ts                          # точка входа, склейка модулей
  styles.css
  env.d.ts
  util/
    color.ts                       # Pixi color (0xRRGGBB) → CanvasKit Color4f
    log.ts                         # лог в UI и в консоль
  pixi/
    application.ts                 # создание PIXI.Application (forceCanvas)
    scene.ts                       # сцена из ТЗ + интерактивные g1/g2
    randomGraphics.ts              # генератор случайной фигуры/линии
  skia/
    CanvasKitLoader.ts             # загрузка wasm с авто-выбором кастомного / npm-бандла
    PixiToSkia.ts                  # ★ обёртка: рекурсивный обход PIXI.Container
    converters/
      transform.ts                 # PIXI.Matrix → CanvasKit 3x3 affine
      graphics.ts                  # PIXI.Graphics → SkPath + SkPaint
      sprite.ts                    # PIXI.Sprite  → SkImage
    pdfExport.ts                   # экспорт сцены в PDF через SkPDFDocument
  interaction/
    skiaHitTest.ts                 # hit-test по дереву DisplayObject
    skiaInputBridge.ts             # pointer-события Skia-канваса → Pixi-сцена
tools/
  canvaskit-pdf/
    Dockerfile                     # окружение сборки Skia + emscripten
    canvaskit_pdf_bindings.cpp     # отдельный TU, экспонирует MakePDFDocument
scripts/
  build-canvaskit.sh               # запускает Docker-сборку → public/canvaskit/
.github/
  workflows/pages.yml              # деплой в GitHub Pages
```

### Как работает рендер Pixi → Skia

`PixiToSkiaRenderer.renderToCanvas(skCanvas, root)`:

1. Рекурсивно обходит дерево `PIXI.DisplayObject`.
2. Для каждого узла:
   - `skCanvas.save()`,
   - `skCanvas.concat(M)`, где `M` = `node.transform.localTransform` (translate + rotate + scale + pivot/skew, всё, что Pixi кладёт в локальную матрицу).
   - Рисует сам узел: для `Graphics` — каждая `graphicsData` → `SkPath` + `Paint` (fill/stroke с цветом, толщиной, cap/join/miter, alpha). Для `Sprite` — `SkImage` через `drawImageRectCubic`, с anchor.
   - Спускается в `children`,
   - `skCanvas.restore()`.

Тот же путь используется и для on-screen рендера, и для PDF — невозможно, чтобы они разошлись.

### PDF — почему отдельная сборка CanvasKit

Стандартный npm-пакет `canvaskit-wasm` собран **без** `skia_enable_pdf` и без bindings для `SkPDF`. Чтобы получить **векторный** PDF (как требует ТЗ), нужна сборка с:

1. GN-флагом `skia_enable_pdf=true`.
2. Дополнительными bindings, которые экспонируют `MakePDFDocument(width, height, metadata)` наружу в JS.

И первое, и второе сделано в `tools/canvaskit-pdf/`.

---

## Сборка кастомного CanvasKit с PDF

Требуется Docker.

```bash
npm run build:wasm
# равносильно: bash scripts/build-canvaskit.sh
```

Скрипт:
1. Соберёт Docker-образ из `tools/canvaskit-pdf/Dockerfile`. Внутри: emscripten + Skia (`chrome/m121`), копируется `canvaskit_pdf_bindings.cpp` в `modules/canvaskit/`, два `sed`-патча подключают новый translation unit в `BUILD.gn` и переключают `skia_enable_pdf=false → true` в `compile.sh`. Затем запускается `modules/canvaskit/compile.sh release`.
2. Скопирует `canvaskit.wasm` и `canvaskit.js` в `public/canvaskit/`.
3. При следующем `npm run dev` / `npm run build` `CanvasKitLoader` автоматически подцепит файлы — потому что в WASM-байтах присутствует magic `\0asm`, и проверка `wasmIsAvailable` возвращает `true`.

> **Время:** на первый запуск уйдёт от 30 минут до часа (скачивание Skia + третьесторонних deps + полная компиляция). Кэш Docker layer-ов делает повторные сборки быстрее.

Если Docker недоступен — можно собрать руками: установить `depot_tools` и `emsdk`, склонировать Skia (`chrome/m121`), скопировать `tools/canvaskit-pdf/canvaskit_pdf_bindings.cpp` в `modules/canvaskit/`, добавить файл в `sources = [...]` в `modules/canvaskit/BUILD.gn`, заменить `skia_enable_pdf=false` на `=true` в `modules/canvaskit/compile.sh`, выполнить `cd modules/canvaskit && ./compile.sh release`.

### Что делает наш файл

`canvaskit_pdf_bindings.cpp` определяет класс `SkPdfDocumentJs` поверх `SkPDF::MakeDocument` и регистрирует отдельным EMSCRIPTEN_BINDINGS блоком:

```cpp
emscripten::function("MakePDFDocument", &MakePDFDocument);
```

Со стороны JS получаем:

```ts
const doc = CanvasKit.MakePDFDocument(600, 400, { title: '...', author: '...' });
const skCanvas = doc.getCanvas();          // рисуем как обычно
// ...
doc.endPage();
const bytes: Uint8Array = doc.close();      // PDF bytes
```

В `src/skia/pdfExport.ts` мы используем именно этот API. Если `CanvasKit.MakePDFDocument` отсутствует (т. е. wasm без PDF) — функция кидает ошибку с инструкцией.

---

## Деплой (GitHub Pages)

1. Создайте репозиторий на GitHub и запушьте проект:
   ```bash
   git init
   git add .
   git commit -m "initial: pixi-skia-pdf test task"
   git branch -M main
   git remote add origin git@github.com:<your-user>/pixi-skia-pdf.git
   git push -u origin main
   ```
2. В настройках репозитория: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow `.github/workflows/pages.yml` соберёт сайт и выложит его. Vite автоматически подхватит подпапку (`/<repo>/`) через `VITE_BASE`.
4. Когда соберёте `public/canvaskit/` локально и закоммитите — деплой включит и PDF.

   > Файлы `public/canvaskit/canvaskit.{wasm,js}` исключены из git через `.gitignore` (они большие — ~7 MB). Уберите их из `.gitignore`, если хотите задеплоить сразу с PDF.

---

## Технические заметки

- **Pixi версия:** `pixi.js-legacy@7.2.4`. В ТЗ написано «`pixi.js` версии `7.2.4-legacy`» — на npm это пакет `pixi.js-legacy`. С `forceCanvas: true` Pixi использует Canvas2D, а не WebGL.
- **Двумерный hit-test для Skia-канваса.** Skia-канвас не управляется Pixi `EventSystem` (он привязан к канвасу Pixi). Реализован собственный `hitTest` (`src/interaction/skiaHitTest.ts`): обход дерева в обратном painter-order, проверка `Graphics.containsPoint(globalPoint)` / `Sprite.containsPoint(...)`. Найденный узел получает синтетический `FederatedPointerEvent` через `target.emit(name, …)`. Pixi-обработчики, повешенные через `g.on('pointerdown', …)`, срабатывают.
- **Кастомный wasm vs npm-бандл.** `CanvasKitLoader` сначала проверяет `public/canvaskit/canvaskit.wasm` (HTTP-запрос с проверкой magic-байт `\0asm`, чтобы Vite dev SPA-fallback нас не обманул). Если файла нет — используется бандл из `canvaskit-wasm/bin/canvaskit.wasm` через Vite `?url`.
- **Векторность PDF.** Все `PIXI.Graphics` пишутся в PDF как векторные `SkPath`-ы. `PIXI.Sprite` (PNG) принципиально является растром; SkPDF встраивает его как изображение — это нормальное поведение Skia PDF backend.

---

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | dev-сервер с HMR на `:5173` |
| `npm run build` | прод-сборка в `dist/` |
| `npm run preview` | поднимает прод-сборку локально на `:4173` |
| `npm run typecheck` | строгая проверка типов (`tsc --noEmit`) |
| `npm run build:wasm` | собирает CanvasKit + PDF в Docker, кладёт в `public/canvaskit/` |

---

## Что протестировать вручную

- [ ] `npm run dev` — оба канваса рисуют одинаковую картинку (синий квадрат, красный эллипс, две короткие линии).
- [ ] Кликнуть по красному эллипсу в **Pixi**-канвасе → в логе `g1 pointerdown!`.
- [ ] Кликнуть по красному эллипсу в **Skia**-канвасе → в логе тоже `g1 pointerdown!`.
- [ ] Кликнуть по синему прямоугольнику и отпустить — `g2 pointerup!`.
- [ ] «Сгенерировать случайную фигуру» — новая фигура появляется одновременно на обоих канвасах. Клик по ней пишет `rnd#N pointerdown!`.
- [ ] После `npm run build:wasm` нажать «Экспорт в PDF» — скачивается `scene.pdf`. Открой его — фигуры векторные (масштабируются без потери качества).
