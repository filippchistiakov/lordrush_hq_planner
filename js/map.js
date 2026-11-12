(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  const types = {
    hq:       { size: 3, color: '#4e82d5', title: 'Alliance HQ',     short: 'HQ',  unique: true },
    banner:   { size: 1, color: '#e0c45c', title: 'Alliance Banner', short: 'B',   unique: false },
    trap1:    { size: 3, color: '#e59b48', title: 'Hunting Trap 1',  short: 'HT1', unique: true },
    trap2:    { size: 3, color: '#d87f3c', title: 'Hunting Trap 2',  short: 'HT2', unique: true },
    city:     { size: 2, color: '#a58ae5', title: 'Player City',     short: '',    unique: false },
    obstacle: { size: 1, color: '#566573', title: 'Obstacle',        short: '✕',   unique: false }
  };

  const dims = Object.fromEntries(Object.entries(types).map(([k, v]) => [k, v.size]));
  const colors = Object.fromEntries(Object.entries(types).map(([k, v]) => [k, v.color]));

  window.Planner = {
    $,
    cv: $('canvas'),
    ctx: $('canvas').getContext('2d'),
    map: $('map'),
    W: 100,
    H: 100,
    types,
    dims,
    colors,
    objects: [],
    roster: [],
    seq: 1,
    selected: null,
    tool: 'select',
    hover: null,
    drag: null,
    zoom: 17,
    ox: 0,
    oy: 0,
    iso: true,
    showLabels: true
  };

  const P = window.Planner;
  const K = Math.SQRT1_2;

  P.uid = () => P.seq++;

  P.make = (type, x, y, name = '', assignment = '0') => {
    return { id: P.uid(), type, x, y, name, assignment };
  };

  P.gridToScreen = (gx, gy) => {
    if (!P.iso) return { x: gx, y: gy };
    return {
      x: (gx - gy) * K,
      y: (gx + gy) * K * 0.5
    };
  };

  P.center = () => {
    let gx = P.W / 2;
    let gy = P.H / 2;
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
    const sx = (e.clientX - r.left - P.ox) / P.zoom;
    const sy = (e.clientY - r.top - P.oy) / P.zoom;

    if (!P.iso) {
      return { x: Math.floor(sx), y: Math.floor(sy) };
    }

    const u = sx / K;
    const v = (sy * 2) / K;
    return {
      x: Math.floor((u + v) / 2),
      y: Math.floor((v - u) / 2)
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

      for (let x = 0; x <= P.W; x++) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, P.H);
      }
      for (let y = 0; y <= P.H; y++) {
        ctx.moveTo(0, y);
        ctx.lineTo(P.W, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = '#7895a3';
    ctx.lineWidth = 1.5 / P.zoom;
    ctx.strokeRect(0, 0, P.W, P.H);

    for (const o of P.objects) {
      const d = P.dims[o.type] || 1;
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

      if (P.showLabels !== false) {
        const info = P.types[o.type] || {};
        let label =
          o.type === 'city'
            ? o.name || 'Empty'
            : info.short || o.type;

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
})();
