(() => {
  'use strict';

  const P = window.Planner;
  const $ = P.$;
  const K = Math.SQRT1_2;

  P.cv = $('canvas');
  P.ctx = P.cv.getContext('2d');
  P.map = $('map');
  P.zoom = 17;
  P.ox = 0;
  P.oy = 0;
  P.iso = true;

  // --- Проекция сетки и преобразование координат мыши ---
  P.gridToScreen = (gx, gy) => {
    if (!P.iso) return { x: gx, y: gy };
    return { x: (gx - gy) * K, y: (gx + gy) * K * 0.5 };
  };

  P.tile = e => {
    const r = P.cv.getBoundingClientRect();
    const sx = (e.clientX - r.left - P.ox) / P.zoom;
    const sy = (e.clientY - r.top - P.oy) / P.zoom;

    if (!P.iso) return { x: Math.floor(sx), y: Math.floor(sy) };

    const u = sx / K;
    const v = (sy * 2) / K;
    return {
      x: Math.floor((u + v) / 2),
      y: Math.floor((v - u) / 2)
    };
  };

  // --- Управление положением и масштабом камеры ---
  P.center = () => {
    let gx = P.W / 2, gy = P.H / 2;
    if (P.objects.length) {
      const left = Math.min(...P.objects.map(o => o.x));
      const top = Math.min(...P.objects.map(o => o.y));
      const right = Math.max(...P.objects.map(o => o.x + (P.dims[o.type] || 1)));
      const bottom = Math.max(...P.objects.map(o => o.y + (P.dims[o.type] || 1)));
      gx = (left + right) / 2;
      gy = (top + bottom) / 2;
    }
    const c = P.gridToScreen(gx, gy);
    P.ox = P.map.clientWidth / 2 - c.x * P.zoom;
    P.oy = P.map.clientHeight / 2 - c.y * P.zoom;
  };

  P.zoomBy = (f, cx = P.map.clientWidth / 2, cy = P.map.clientHeight / 2) => {
    const z = Math.max(2, Math.min(60, P.zoom * f));
    P.ox = cx - ((cx - P.ox) * z) / P.zoom;
    P.oy = cy - ((cy - P.oy) * z) / P.zoom;
    P.zoom = z;
    P.draw();
  };

  P.setTool = t => {
    P.tool = t;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    P.cv.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair';
    P.draw();
  };

  P.setLabelsVisible = visible => {
    P.showLabels = visible;
    if ($('names')) $('names').checked = visible;
    if ($('toggleLabels')) {
      $('toggleLabels').classList.toggle('active', visible);
      $('toggleLabels').textContent = visible ? 'Labels: ON' : 'Labels: OFF';
    }
    P.draw();
  };

  // --- Отрисовка карты на Canvas ---
  P.draw = () => {
    const w = P.map.clientWidth, h = P.map.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);

    if (P.cv.width !== Math.round(w * dpr) || P.cv.height !== Math.round(h * dpr)) {
      P.cv.width = Math.round(w * dpr);
      P.cv.height = Math.round(h * dpr);
    }

    const ctx = P.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#17232b';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(P.ox, P.oy);
    ctx.scale(P.zoom, P.zoom);

    if (P.iso) {
      ctx.scale(1, 0.5);
      ctx.rotate(Math.PI / 4);
    }

    ctx.fillStyle = '#1e3039';
    ctx.fillRect(0, 0, P.W, P.H);

    if ($('territory') && $('territory').checked) {
      ctx.fillStyle = 'rgba(57,139,114,.43)';
      for (const n of P.coverage()) {
        ctx.fillRect(n % P.W, Math.floor(n / P.W), 1, 1);
      }
    }

    if ($('grid') && $('grid').checked && P.zoom >= 5) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(205,225,240,.16)';
      ctx.lineWidth = 1 / P.zoom;
      for (let x = 0; x <= P.W; x++) { ctx.moveTo(x, 0); ctx.lineTo(x, P.H); }
      for (let y = 0; y <= P.H; y++) { ctx.moveTo(0, y); ctx.lineTo(P.W, y); }
      ctx.stroke();
    }

    ctx.strokeStyle = '#7895a3';
    ctx.lineWidth = 1.5 / P.zoom;
    ctx.strokeRect(0, 0, P.W, P.H);

    for (const o of P.objects) {
      const d = P.dims[o.type] || 1;
      ctx.fillStyle =
        o.type === 'city' && P.isNonOptimized(o) ? '#e04d55' :
        o.type === 'city' && !o.name ? '#8094a4' : P.colors[o.type];

      ctx.fillRect(o.x + 0.04, o.y + 0.04, d - 0.08, d - 0.08);
      ctx.strokeStyle = o.id === P.selected ? 'white' : '#b7c8d5';
      ctx.lineWidth = (o.id === P.selected ? 2.6 : 0.8) / P.zoom;
      ctx.strokeRect(o.x + 0.04, o.y + 0.04, d - 0.08, d - 0.08);

      if (P.showLabels !== false) {
        const info = P.types[o.type] || {};
        let label = o.type === 'city' ? (o.name || 'Empty') : (info.short || o.type);

        ctx.save();
        ctx.translate(o.x + d / 2, o.y + d / 2);
        if (P.iso) {
          ctx.rotate(-Math.PI / 4);
          ctx.scale(1, 2);
        }

        const fontSize = Math.max(0.22, Math.min(d * 0.42, 12 / P.zoom));
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px sans-serif`;

        const maxWidth = d * (P.iso ? 1.35 : 0.92);
        while (label.length > 1 && ctx.measureText(label).width > maxWidth) {
          label = label.slice(0, -2) + '…';
        }
        ctx.fillText(label, 0, o.type === 'city' && P.zoom >= 12 ? -fontSize * 0.45 : 0);

        if (o.type === 'city' && P.zoom >= 12) {
          ctx.font = `${Math.max(0.2, fontSize * 0.72)}px sans-serif`;
          ctx.fillStyle = '#d8e6f0';
          ctx.fillText(o.assignment === '0' ? 'Free' : 'HT' + o.assignment, 0, fontSize * 0.55);
        }
        ctx.restore();
      }
    }

    if (P.hover && P.dims[P.tool]) {
      const d = P.dims[P.tool];
      const ok = P.valid(P.tool, P.hover.x, P.hover.y);
      ctx.fillStyle = ok ? 'rgba(90,225,155,.42)' : 'rgba(255,80,80,.42)';
      ctx.fillRect(P.hover.x, P.hover.y, d, d);
      ctx.strokeStyle = ok ? '#9dffbe' : '#ff8888';
      ctx.lineWidth = 2 / P.zoom;
      ctx.strokeRect(P.hover.x, P.hover.y, d, d);
    }

    ctx.restore();
  };
  // --- События мыши и кнопок навигации ---
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

  if ($('zoomIn')) $('zoomIn').onclick = () => P.zoomBy(1.3);
  if ($('zoomOut')) $('zoomOut').onclick = () => P.zoomBy(1 / 1.3);
  if ($('toggleIso')) {
    $('toggleIso').onclick = () => {
      P.iso = !P.iso;
      $('toggleIso').classList.toggle('active', P.iso);
      P.center();
      P.draw();
    };
  }
  if ($('toggleLabels')) $('toggleLabels').onclick = () => P.setLabelsVisible(!P.showLabels);
  if ($('names')) $('names').onchange = () => P.setLabelsVisible($('names').checked);

  if ($('fit')) {
    $('fit').onclick = () => {
      P.zoom = Math.min(P.map.clientWidth / 104, P.map.clientHeight / 104);
      P.center();
      P.draw();
    };
  }

  if ($('focus')) {
    $('focus').onclick = () => {
      if (!P.objects.length) { if ($('fit')) $('fit').click(); return; }
      const left = Math.min(...P.objects.map(o => o.x)) - 5;
      const top = Math.min(...P.objects.map(o => o.y)) - 5;
      const right = Math.max(...P.objects.map(o => o.x + P.dims[o.type])) + 5;
      const bottom = Math.max(...P.objects.map(o => o.y + P.dims[o.type])) + 5;
      const mid = P.gridToScreen((left + right) / 2, (top + bottom) / 2);

      P.zoom = Math.min(45, P.map.clientWidth / (right - left), P.map.clientHeight / (bottom - top));
      P.ox = P.map.clientWidth / 2 - mid.x * P.zoom;
      P.oy = P.map.clientHeight / 2 - mid.y * P.zoom;
      P.draw();
    };
  }

  ['territory', 'grid'].forEach(k => { if ($(k)) $(k).onchange = P.draw; });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(P.draw).observe(P.map);
})();
