/** Wires up the target zones. They react to real and synthetic input alike. */
export function setupTargets(): void {
  const flash = (el: Element) => {
    el.classList.add('hit');
    setTimeout(() => el.classList.remove('hit'), 300);
  };
  const bump = (el: Element) => {
    const b = el.querySelector('b');
    if (b) b.textContent = String(Number(b.textContent) + 1);
    flash(el);
  };

  // Click buttons.
  document.querySelectorAll('.t-btn').forEach((btn) => btn.addEventListener('click', () => bump(btn)));

  // Right click zone.
  const ctx = document.getElementById('ctx-zone')!;
  ctx.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    bump(ctx);
  });

  // Scroll list.
  const list = document.getElementById('scroll-list')!;
  list.innerHTML = Array.from({ length: 40 }, (_, i) => `<li>שורה ${i + 1}</li>`).join('');

  // Pointer-event slider (LTR so value grows to the right).
  const slider = document.getElementById('slider')!;
  slider.dir = 'ltr';
  const fill = slider.querySelector<HTMLElement>('.fill')!;
  const thumb = slider.querySelector<HTMLElement>('.thumb')!;
  const valueEl = document.getElementById('slider-value')!;
  let sliding = false;
  const setFromX = (clientX: number) => {
    const r = slider.getBoundingClientRect();
    const v = Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 100);
    fill.style.width = `${v}%`;
    thumb.style.insetInlineStart = `calc(${v}% - 15px)`;
    valueEl.textContent = String(v);
  };
  slider.addEventListener('pointerdown', (e) => {
    sliding = true;
    setFromX(e.clientX);
  });
  document.addEventListener('pointermove', (e) => sliding && setFromX(e.clientX));
  document.addEventListener('pointerup', () => (sliding = false));

  // Mouse-event drag box.
  const area = document.getElementById('drag-area')!;
  const box = document.getElementById('drag-box')!;
  let grab: { dx: number; dy: number } | null = null;
  box.addEventListener('mousedown', (e) => {
    const r = box.getBoundingClientRect();
    grab = { dx: e.clientX - r.left, dy: e.clientY - r.top };
  });
  document.addEventListener('mousemove', (e) => {
    if (!grab) return;
    const a = area.getBoundingClientRect();
    const x = Math.min(a.width - box.offsetWidth, Math.max(0, e.clientX - a.left - grab.dx));
    const y = Math.min(a.height - box.offsetHeight, Math.max(0, e.clientY - a.top - grab.dy));
    box.style.left = `${x}px`;
    box.style.top = `${y}px`;
  });
  document.addEventListener('mouseup', () => (grab = null));
  // Touch support for trying the page by hand on a phone.
  box.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (!t) return;
    const r = box.getBoundingClientRect();
    grab = { dx: t.clientX - r.left, dy: t.clientY - r.top };
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (grab && t) document.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY }));
  }, { passive: true });
  document.addEventListener('touchend', () => (grab = null));

  // HTML5 drag and drop.
  const drop = document.getElementById('dropzone')!;
  let dragged: HTMLElement | null = null;
  document.querySelectorAll<HTMLElement>('.dnd-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      dragged = card;
      e.dataTransfer?.setData('text/plain', card.textContent ?? '');
    });
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('over');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    if (dragged) drop.append(dragged);
  });
}
