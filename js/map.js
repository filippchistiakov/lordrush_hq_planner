(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  window.Planner = {
    $,
    cv: $('canvas'),
    ctx: $('canvas').getContext('2d'),
    map: $('map'),
    W: 100,
    H: 100,
    dims: { hq: 3, banner: 1, trap1: 3, trap2: 3, city: 2 },
    colors: { hq: '#4e82d5', banner: '#e0c45c', trap1: '#e59b48', trap2: '#d87f3c', city: '#a58ae5' },
    objects: [],
    roster: [],
    seq: 1,
    selected: null,
    tool: 'select',
    hover: null,
    drag: null,
    zoom: 17,
    ox: 0,
    oy: 0
  };

  const P = window.Planner;

  P.uid = () => P.seq++;

  P.make = (type, x, y, name = '', assignment = '0') => {
    return { id: P.uid(), type, x, y, name, assignment };
  };

  P.center = () => {
    P.ox = P.map.clientWidth / 2 - (P.W * P.zoom) / 2;
    P.oy = P.map.clientHeight / 2 - (P.H * P.zoom) / 2;
  };

  P.message = s => {
    if ($('status')) $('status').textContent = s;
  };

  P.coverage = () => {
    const cells = new Set();
    for (const o of P.objects) {
      if (o.type !== 'hq' && o.type !== 'banner') continue;
      const r = o.type === 'hq' ? 6 : 3;
      const d = P.dims[o.type];
      for (let y = Math.max(0, o.y - r); y < Math.min(P.H, o.y + d + r); y++) {
        for (let x = Math.max(0, o.x - r); x < Math.min(P.W, o.x + d + r); x++) {
          cells.add(y * P.W + x);
        }
      }
    }
    return cells;
  };

  P.trapRow = (city, trap) => {
    const d = 2;
    const td = 3;
    const dx = Math.max(0, trap.x - (city.x + d), city.x - (trap.x + td));
    const dy = Math.max(0, trap.y - (city.y + d), city.y - (trap.y + td));
    return Math.floor(Math.max(dx, dy) / 2) + 1;
  };

  P.isNonOptimized = city => {
    if (city.type !== 'city') return false;
    const traps = P.objects.filter(o => o.type === 'trap1' || o.type === 'trap2');
    if (!traps.length) return false;
    const assigned = traps.find(t => t.type === 'trap' + city.assignment);
    const target = assigned || traps.reduce((best, t) => (!best || P.trapRow(city, t) < P.trapRow(city, best) ? t : best), null);
    return P.trapRow(city, target) >= 4;
  };

  P.valid = (type, x, y, except = null, arr = P.objects) => {
    const d = P.dims[type];
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      y >= 0 &&
      x + d <= P.W &&
      y + d <= P.H &&
      !arr.some(
        o =>
          o.id !== except &&
          x < o.x + P.dims[o.type] &&
          x + d > o.x &&
          y < o.y + P.dims[o.type] &&
          y + d > o.y
      )
    );
  };

  P.at = (x, y) => {
    return [...P.objects].reverse().find(o => x >= o.x && x < o.x + P.dims[o.type] && y >= o.y && y < o.y + P.dims[o.type]);
  };

  P.tile = e => {
    const r = P.cv.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left - P.ox) / P.zoom),
      y: Math.floor((e.clientY - r.top - P.oy) / P.zoom)
    };
  };

  P.setTool = t => {
    P.tool = t;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    P.cv.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair';
    P.draw();
  };

  P.draw = () => {
    const w = P.map.clientWidth;
    const h = P.map.clientHeight;
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

    ctx.fillStyle = '#1e3039';
    ctx.fillRect(0, 0, P.W, P.H);

    if ($('territory') && $('territory').checked) {
      ctx.fillStyle = 'rgba(57,139,114,.43)';
      for (const n of P.coverage()) {
        ctx.fillRect(n % P.W, Math.floor(n / P.W), 1, 1);
      }
    }

    if ($('grid') && $('grid').checked && P.zoom >= 5) {
      const x0 = Math.max(0, Math.floor(-P.ox / P.zoom));
      const x1 = Math.min(P.W, Math.ceil((w - P.ox) / P.zoom));
      const y0 = Math.max(0, Math.floor(-P.oy / P.zoom));
      const y1 = Math.min(P.H, Math.ceil((h - P.oy) / P.zoom));

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(205,225,240,.16)';
      ctx.lineWidth = 1 / P.zoom;

      for (let x = x0; x <= x1; x++) {
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
      }
      for (let y = y0; y <= y1; y++) {
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = '#7895a3';
    ctx.lineWidth = 1.5 / P.zoom;
    ctx.strokeRect(0, 0, P.W, P.H);

    for (const o of P.objects) {
      const d = P.dims[o.type];
      ctx.fillStyle =
        o.type === 'city' && P.isNonOptimized(o)
          ? '#e04d55'
          : o.type === 'city' && !o.name
          ? '#8094a4'
          : P.colors[o.type];

      ctx.fillRect(o.x + 0.04, o.y + 0.04, d - 0.08, d - 0.08);
      ctx.strokeStyle = o.id === P.selected ? 'white' : '#b7c8d5';
      ctx.lineWidth = (o.id === P.selected ? 2.6 : 0.8) / P.zoom;
      ctx.strokeRect(o.x + 0.04, o.y + 0.04, d - 0.08, d - 0.08);

      if (P.zoom >= 7) {
        let label =
          o.type === 'hq'
            ? 'HQ'
            : o.type === 'banner'
            ? 'B'
            : o.type === 'trap1'
            ? 'HT1'
            : o.type === 'trap2'
            ? 'HT2'
            : $('names') && $('names').checked
            ? o.name || 'Empty'
            : 'City';

        ctx.save();
        ctx.beginPath();
        ctx.rect(o.x, o.y, d, d);
        ctx.clip();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + Math.min(d * 0.48, Math.max(0.5, 11 / P.zoom)) + 'px sans-serif';

        while (label.length > 1 && ctx.measureText(label).width > d - 0.15) {
          label = label.slice(0, -2) + '…';
        }
        ctx.fillText(label, o.x + d / 2, o.y + d / 2);

        if (o.type === 'city' && P.zoom >= 15) {
          ctx.font = '.33px sans-serif';
          ctx.fillText(o.assignment === '0' ? 'Free' : 'HT' + o.assignment, o.x + d / 2, o.y + d - 0.27);
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
})();
