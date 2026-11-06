const MAX_ROWS = 60;
const THROTTLED = new Set(['scroll', 'wheel']);
const THROTTLE_MS = 400;

export type LogSource = 'מחווה' | 'דף';

function describe(target: EventTarget | null): string {
  if (!(target instanceof Element)) return target === document ? 'document' : '–';
  const id = target.id ? `#${target.id}` : '';
  const cls = target.classList[0] ? `.${target.classList[0]}` : '';
  const text = (target.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 18);
  return `${target.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
}

export class EventLog {
  private lastByType = new Map<string, number>();
  private readonly t0 = performance.now();

  constructor(private readonly body: HTMLTableSectionElement) {}

  /** Log DOM events that reach the document, real or synthetic. */
  watch(types: string[]): void {
    for (const type of types) {
      document.addEventListener(type, (e) => this.dom(e), { capture: true, passive: true });
    }
  }

  gesture(type: string, detail = ''): void {
    this.add('מחווה', type, detail, null);
  }

  clear(): void {
    this.body.innerHTML = '';
  }

  private dom(e: Event): void {
    if (THROTTLED.has(e.type)) {
      const last = this.lastByType.get(e.type) ?? 0;
      if (e.timeStamp - last < THROTTLE_MS) return;
      this.lastByType.set(e.type, e.timeStamp);
    }
    this.add('דף', e.type, describe(e.target), e.isTrusted);
  }

  private add(source: LogSource, type: string, target: string, trusted: boolean | null): void {
    const row = document.createElement('tr');
    const secs = ((performance.now() - this.t0) / 1000).toFixed(2);
    const trustedCell =
      trusted === null ? '–' : trusted ? '<span class="yes">✓ true</span>' : '<span class="no">✗ false</span>';
    row.innerHTML = `<td>${secs}</td><td>${source}</td><td>${type}</td><td></td><td>${trustedCell}</td>`;
    row.children[3]!.textContent = target;
    this.body.prepend(row);
    while (this.body.rows.length > MAX_ROWS) this.body.deleteRow(-1);
  }
}
