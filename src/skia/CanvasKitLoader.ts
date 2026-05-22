import CanvasKitInitNpm, { type CanvasKit } from 'canvaskit-wasm';

// URL of the wasm bundle shipped with the npm package (Vite-resolved).
import bundledWasmUrl from 'canvaskit-wasm/bin/canvaskit.wasm?url';

// Shape of the CanvasKitInit factory injected by our custom canvaskit.js.
type CanvasKitInitFn = (opts: {
  locateFile: (file: string) => string;
}) => Promise<CanvasKit>;

let cached: Promise<CanvasKit> | null = null;

/**
 * Loads CanvasKit, preferring a self-built version with the PDF backend if
 * it is present in /public/canvaskit/. Falls back to the npm bundle (no PDF
 * support) so dev / preview works out of the box.
 *
 * **Important:** the wasm binary and the JS glue must be paired — they share
 * the same emscripten import/export table. If `canvaskit.wasm` is present
 * locally, we MUST also load the matching `canvaskit.js` instead of using the
 * npm one. The result is memoised.
 */
export function loadCanvasKit(): Promise<CanvasKit> {
  if (cached) return cached;
  cached = init();
  return cached;
}

async function init(): Promise<CanvasKit> {
  const customBase = `${stripTrailingSlash(import.meta.env.BASE_URL || '/')}/canvaskit/`;
  if (await wasmIsAvailable(`${customBase}canvaskit.wasm`)) {
    return loadCustomCanvasKit(customBase);
  }
  return CanvasKitInitNpm({
    locateFile: () => bundledWasmUrl,
  });
}

/**
 * Loads the local canvaskit.js as a <script> tag, then calls the
 * `CanvasKitInit` it installs onto window. Cleans up the global afterwards so
 * we don't leak it into the page.
 */
async function loadCustomCanvasKit(base: string): Promise<CanvasKit> {
  // Re-use a previously injected script if one is present (e.g. hot reload).
  const existing = (window as unknown as { CanvasKitInit?: CanvasKitInitFn }).CanvasKitInit;
  const factory = existing ?? (await injectScript(`${base}canvaskit.js`));

  try {
    return await factory({
      locateFile: (file: string) => `${base}${file}`,
    });
  } finally {
    // Avoid leaking the global; harmless if a second load happens.
    try {
      delete (window as unknown as { CanvasKitInit?: unknown }).CanvasKitInit;
    } catch {
      /* non-configurable in some browsers — ignore */
    }
  }
}

function injectScript(src: string): Promise<CanvasKitInitFn> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      const fn = (window as unknown as { CanvasKitInit?: CanvasKitInitFn }).CanvasKitInit;
      if (typeof fn !== 'function') {
        reject(new Error(`Loaded ${src} but window.CanvasKitInit is missing`));
        return;
      }
      resolve(fn);
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function wasmIsAvailable(url: string): Promise<boolean> {
  // HEAD / 200 alone isn't enough: Vite's dev server happily replies with the
  // SPA fallback HTML for unknown paths. We fetch the first four bytes and
  // check the WebAssembly magic header (\0asm).
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-3', Accept: 'application/wasm' },
    });
    if (!res.ok) return false;
    const ct = res.headers.get('content-type') ?? '';
    if (!/wasm|octet-stream/.test(ct)) return false;
    const buf = await res.arrayBuffer();
    const v = new Uint8Array(buf);
    return v.length >= 4 && v[0] === 0x00 && v[1] === 0x61 && v[2] === 0x73 && v[3] === 0x6d;
  } catch {
    return false;
  }
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

export type { CanvasKit };
