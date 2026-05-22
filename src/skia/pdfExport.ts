import * as PIXI from 'pixi.js-legacy';
import type { CanvasKit } from 'canvaskit-wasm';
import { PixiToSkiaRenderer } from './PixiToSkia';

export interface PdfExportOptions {
  width: number;
  height: number;
  /** Optional document metadata. */
  title?: string;
  author?: string;
}

/**
 * Extended CanvasKit surface introduced by the patched build with PDF backend.
 *
 * The upstream `canvaskit-wasm` package does not type these — they are
 * exposed by our self-built CanvasKit (see scripts/build-canvaskit.sh and
 * the C++ bindings in `tools/canvaskit-pdf-bindings.cpp`).
 */
interface CanvasKitWithPdf extends CanvasKit {
  MakePDFDocument?: (
    width: number,
    height: number,
    metadata?: { title?: string; author?: string },
  ) => PdfDocument;
}

interface PdfDocument {
  /** Returns the SkCanvas for the current page. */
  getCanvas(): ReturnType<CanvasKit['MakeSurface']> extends infer S
    ? S extends { getCanvas: () => infer C }
      ? C
      : never
    : never;
  /** Finishes the page and starts a new one (if width/height supplied). */
  endPage(): void;
  beginPage(width: number, height: number): void;
  /** Finalises the PDF and returns the raw bytes. */
  close(): Uint8Array;
  /** Frees the underlying C++ object. Embind requires explicit cleanup. */
  delete(): void;
}

/**
 * Renders the given Pixi container to a single-page PDF using Skia's PDF
 * backend. Graphics shapes are written as vector primitives; sprites become
 * embedded raster images, which is the documented behaviour of SkPDF.
 *
 * Throws if the loaded CanvasKit build does not expose `MakePDFDocument` —
 * see the README for instructions on producing a CanvasKit build with PDF
 * support enabled.
 */
export function exportSceneToPdf(
  ck: CanvasKit,
  root: PIXI.Container,
  options: PdfExportOptions,
): Blob {
  const ckPdf = ck as CanvasKitWithPdf;

  if (typeof ckPdf.MakePDFDocument !== 'function') {
    throw new Error(
      'PDF export unavailable: this CanvasKit build was compiled without ' +
        'the PDF backend. See README → "Building CanvasKit with PDF" to ' +
        'produce a wasm with skia_enable_pdf=true.',
    );
  }

  const doc = ckPdf.MakePDFDocument(options.width, options.height, {
    title: options.title,
    author: options.author,
  });

  // The renderer needs an HTMLCanvasElement to construct its on-screen
  // surface, but for PDF we paint to the document's own SkCanvas directly.
  // To reuse the recursive walker we instantiate a renderer with a dummy
  // surface and call `renderToCanvas` against the PDF page canvas.
  const dummyCanvas = makeDummyCanvas(options.width, options.height);
  const renderer = new PixiToSkiaRenderer(ck, dummyCanvas, { background: 0xffffff });

  try {
    const pdfCanvas = doc.getCanvas() as unknown as Parameters<
      PixiToSkiaRenderer['renderToCanvas']
    >[0];
    // White page background (paper).
    const paint = new ck.Paint();
    paint.setColor(ck.Color4f(1, 1, 1, 1));
    pdfCanvas.drawRect(ck.LTRBRect(0, 0, options.width, options.height), paint);
    paint.delete();

    renderer.renderToCanvas(pdfCanvas, root);
    doc.endPage();
    const bytes = doc.close();
    return new Blob([bytes], { type: 'application/pdf' });
  } finally {
    renderer.dispose();
    // Embind objects must be released manually; without this we'd leak the
    // entire SkPdfDocumentJs instance on every export.
    try { doc.delete(); } catch { /* already closed */ }
  }
}

function makeDummyCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

/** Triggers a browser download for an arbitrary blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
