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

  P.setLabelsVisible = visible => {
    P.showLabels = visible;
    if ($('names')) $('names').checked = visible;
    if ($('toggleLabels')) {
      $('toggleLabels').classList.toggle('active', visible);
      $('toggleLabels').textContent = visible ? 'Labels: ON' : 'Labels: OFF';
    }
    P.draw();
  };

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
})();
