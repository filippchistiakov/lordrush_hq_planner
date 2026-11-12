(() => {
  'use strict';

  const P = window.Planner;
  const $ = P.$;

  P.setTool = t => {
    P.tool = t;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    P.cv.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair';
    P.draw();
  };

  document.querySelectorAll('[data-tool]').forEach(b => (b.onclick = () => P.setTool(b.dataset.tool)));

  P.cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    P.cv.setPointerCapture(e.pointerId);
    const t = P.tile(e);
    const h = P.at(t.x, t.y);
    P.drag = { px: e.clientX, py: e.clientY, ox: P.ox, oy: P.oy, mode: 'click', moved: false };

    if (P.tool === 'pan' || (P.tool === 'select' && !h)) {
      P.drag.mode = 'pan';
      return;
    }

    if (P.tool === 'select' && h) {
      P.selected = h.id;
      P.drag.mode = 'move';
      P.drag.o = h;
      P.drag.dx = t.x - h.x;
      P.drag.dy = t.y - h.y;
      P.refresh();
    }
  });

  P.cv.addEventListener('pointermove', e => {
    const t = P.tile(e);
    P.hover = t;
    const wc = P.getWorldCoords(t.x, t.y);
    if ($('coords')) $('coords').textContent = `World X ${wc.wx} · Y ${wc.wy} (Grid ${t.x}, ${t.y})`;

    if (P.drag) {
      if (Math.abs(e.clientX - P.drag.px) + Math.abs(e.clientY - P.drag.py) > 5) P.drag.moved = true;

      if (P.drag.mode === 'pan') {
        P.ox = P.drag.ox + e.clientX - P.drag.px;
        P.oy = P.drag.oy + e.clientY - P.drag.py;
      } else if (P.drag.mode === 'move' && P.drag.moved) {
        const o = P.drag.o;
        const x = t.x - P.drag.dx;
        const y = t.y - P.drag.dy;
        if (P.valid(o.type, x, y, o.id)) {
          o.x = x;
          o.y = y;
          if (P.selected === o.id && P.renderSelection) P.renderSelection();
        }
      }
    }
    P.draw();
  });

  P.cv.addEventListener('pointerup', e => {
    if (!P.drag) return;
    const t = P.tile(e);
    const d = P.drag;

    if (d.mode === 'click' && !d.moved) {
      if (P.tool === 'erase') {
        const o = P.at(t.x, t.y);
        if (o) {
          P.objects = P.objects.filter(a => a.id !== o.id);
          if (P.selected === o.id) P.selected = null;
          P.message('Structure removed.');
        }
      } else if (P.dims[P.tool]) {
        const info = P.types[P.tool];
        if (info && info.unique && P.objects.some(o => o.type === P.tool)) {
          P.message('Only one ' + info.title + ' is allowed. Move the existing structure.');
        } else if (P.valid(P.tool, t.x, t.y)) {
          const o = P.make(
            P.tool, t.x, t.y,
            P.tool === 'city' && $('newName') ? $('newName').value.trim() : '',
            P.tool === 'city' && $('newTrap') ? $('newTrap').value : '0'
          );
          P.objects.push(o);
          P.selected = o.id;
          P.message('Placed ' + info.title + ' at (' + t.x + ', ' + t.y + ').');
        } else {
          P.message('Placement blocked: occupied tiles or outside map.');
        }
      }
    }
    P.drag = null;
    P.refresh();
  });

  P.cv.addEventListener('pointercancel', () => { P.drag = null; P.refresh(); });
  P.cv.addEventListener('pointerleave', () => { P.hover = null; P.draw(); });

  P.cv.addEventListener('wheel', e => {
    e.preventDefault();
    const r = P.cv.getBoundingClientRect();
    P.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
})();
