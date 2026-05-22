// Mini logger that writes to a DOM <pre> so the user can see events from
// both canvases without opening the devtools.

const MAX_LINES = 80;
let host: HTMLElement | null = null;
const buffer: string[] = [];

export function attachLog(el: HTMLElement): void {
  host = el;
  flush();
}

export function log(message: string): void {
  const stamp = new Date().toLocaleTimeString();
  buffer.push(`[${stamp}] ${message}`);
  if (buffer.length > MAX_LINES) buffer.splice(0, buffer.length - MAX_LINES);
  flush();
  // Also surface in devtools for engineers
  // eslint-disable-next-line no-console
  console.log(message);
}

function flush(): void {
  if (!host) return;
  host.textContent = buffer.join('\n');
  host.scrollTop = host.scrollHeight;
}
