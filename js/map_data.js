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
    W: 100,
    H: 100,
    types,
    dims,
    colors,
    objects: [],
    seq: 1,
    selected: null,
    tool: 'select',
    hover: null,
    drag: null,
    showLabels: true,
    refresh: () => {},
    draw: () => {}
  };

  const P = window.Planner;

  P.uid = () => P.seq++;

  P.make = (type, x, y, name = '', assignment = '0') => {
    return { id: P.uid(), type, x, y, name, assignment };
  };

  P.message = s => {
    if ($('status')) $('status').textContent = s;
  };

  // --- Перевод локальных координат сетки в мировые координаты игры ---
  P.getWorldCoords = (x, y) => {
    const hq = P.objects.find(o => o.type === 'hq');
    const baseX = $('hqWorldX') ? parseInt($('hqWorldX').value, 10) || 0 : 0;
    const baseY = $('hqWorldY') ? parseInt($('hqWorldY').value, 10) || 0 : 0;

    const obj = P.objects.find(o => o.x === x && o.y === y);
    const d = obj ? P.dims[obj.type] : 1;

    const brX = x + (d - 1);
    const brY = y + (d - 1);

    if (!hq) return { wx: baseX - brY, wy: baseY - brX, hasHq: false };

    const hqBrX = hq.x + (P.dims.hq - 1);
    const hqBrY = hq.y + (P.dims.hq - 1);

    return {
      wx: baseX - (brY - hqBrY),
      wy: baseY - (brX - hqBrX),
      hasHq: true
    };
  };

  // --- Правила территории, оптимизации и коллизий ---
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
    const d = 2, td = 3;
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
      Number.isInteger(x) && Number.isInteger(y) &&
      x >= 0 && y >= 0 && x + d <= P.W && y + d <= P.H &&
      !arr.some(o => o.id !== except && x < o.x + P.dims[o.type] && x + d > o.x && y < o.y + P.dims[o.type] && y + d > o.y)
    );
  };

  P.at = (x, y) => {
    return [...P.objects].reverse().find(o => x >= o.x && x < o.x + P.dims[o.type] && y >= o.y && y < o.y + P.dims[o.type]);
  };
})();
