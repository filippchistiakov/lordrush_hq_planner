(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const cv = $('canvas');
  const ctx = cv.getContext('2d');
  const map = $('map');

  const W = 100;
  const H = 100;
  const dims = {hq: 3, banner: 1, trap1: 3, trap2: 3, city: 2};
  const colors = {hq: '#4e82d5', banner: '#e0c45c', trap1: '#e59b48', trap2: '#d87f3c', city: '#a58ae5'};

  let objects = [];
  let seq = 1;
  let selected = null;
  let tool = 'select';
  let hover = null;
  let drag = null;
  let zoom = 17;
  let ox = 0;
  let oy = 0;

  const uid = () => seq++;

  function make(type, x, y, name = '', assignment = '0') {
    return {id: uid(), type, x, y, name, assignment};
  }

  function center() {
    ox = map.clientWidth / 2 - (W * zoom) / 2;
    oy = map.clientHeight / 2 - (H * zoom) / 2;
  }

  function seed() {
    objects = [
      make('hq', 48, 48),
      make('trap1', 31, 47),
      make('trap2', 66, 47),
      make('banner', 43, 49),
      make('banner', 57, 49)
    ];
    center();
    refresh();
  }

  function coverage() {
    const cells = new Set();
    for (const o of objects) {
      if (o.type !== 'hq' && o.type !== 'banner') continue;
      const r = o.type === 'hq' ? 6 : 3;
      const d = dims[o.type];
      for (let y = Math.max(0, o.y - r); y < Math.min(H, o.y + d + r); y++) {
        for (let x = Math.max(0, o.x - r); x < Math.min(W, o.x + d + r); x++) {
          cells.add(y * W + x);
        }
      }
    }
    return cells;
  }

  function trapRow(city, trap) {
    const d = 2;
    const td = 3;
    const dx = Math.max(0, trap.x - (city.x + d), city.x - (trap.x + td));
    const dy = Math.max(0, trap.y - (city.y + d), city.y - (trap.y + td));
    return Math.floor(Math.max(dx, dy) / 2) + 1;
  }

  function isNonOptimized(city) {
    if (city.type !== 'city') return false;
    const traps = objects.filter(o => o.type === 'trap1' || o.type === 'trap2');
    if (!traps.length) return false;
    const assigned = traps.find(t => t.type === 'trap' + city.assignment);
    const target = assigned || traps.reduce((best, t) => (!best || trapRow(city, t) < trapRow(city, best) ? t : best), null);
    return trapRow(city, target) >= 4;
  }

  function valid(type, x, y, except = null, arr = objects) {
    const d = dims[type];
    return (
      Number.isInteger(x) &&
      Number.isInteger(y) &&
      x >= 0 &&
      y >= 0 &&
      x + d <= W &&
      y + d <= H &&
      !arr.some(
        o =>
          o.id !== except &&
          x < o.x + dims[o.type] &&
          x + d > o.x &&
          y < o.y + dims[o.type] &&
          y + d > o.y
      )
    );
  }

  function at(x, y) {
    return [...objects].reverse().find(o => x >= o.x && x < o.x + dims[o.type] && y >= o.y && y < o.y + dims[o.type]);
  }

  function tile(e) {
    const r = cv.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left - ox) / zoom),
      y: Math.floor((e.clientY - r.top - oy) / zoom)
    };
  }

  function message(s) {
    $('status').textContent = s;
  }

  function setTool(t) {
    tool = t;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    cv.style.cursor = t === 'pan' ? 'grab' : t === 'select' ? 'default' : 'crosshair';
    draw();
  }

  function draw() {
    const w = map.clientWidth;
    const h = map.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);

    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#17232b';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(zoom, zoom);

    ctx.fillStyle = '#1e3039';
    ctx.fillRect(0, 0, W, H);

    if ($('territory').checked) {
      ctx.fillStyle = 'rgba(57,139,114,.43)';
      for (const n of coverage()) {
        ctx.fillRect(n % W, Math.floor(n / W), 1, 1);
      }
    }

    if ($('grid').checked && zoom >= 5) {
      const x0 = Math.max(0, Math.floor(-ox / zoom));
      const x1 = Math.min(W, Math.ceil((w - ox) / zoom));
      const y0 = Math.max(0, Math.floor(-oy / zoom));
      const y1 = Math.min(H, Math.ceil((h - oy) / zoom));

      ctx.beginPath();
      ctx.strokeStyle = 'rgba(205,225,240,.16)';
      ctx.lineWidth = 1 / zoom;

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
    ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(0, 0, W, H);

    for (const o of objects) {
      const d = dims[o.type];
      ctx.fillStyle =
        o.type === 'city' && isNonOptimized(o)
          ? '#e04d55'
          : o.type === 'city' && !o.name
            ? '#8094a4'
            : colors[o.type];

      ctx.fillRect(o.x + 0.04, o.y + 0.04, d - 0.08, d - 0.08);
      ctx.strokeStyle = o.id === selected ? 'white' : '#b7c8d5';
      ctx.lineWidth = (o.id === selected ? 2.6 : 0.8) / zoom;
      ctx.strokeRect(o.x + 0.04, o.y + 0.04, d - 0.08, d - 0.08);

      if (zoom >= 7) {
        let label =
          o.type === 'hq'
            ? 'HQ'
            : o.type === 'banner'
              ? 'B'
              : o.type === 'trap1'
                ? 'HT1'
                : o.type === 'trap2'
                  ? 'HT2'
                  : $('names').checked
                    ? o.name || 'Empty'
                    : 'City';

        ctx.save();
        ctx.beginPath();
        ctx.rect(o.x, o.y, d, d);
        ctx.clip();

        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + Math.min(d * 0.48, Math.max(0.5, 11 / zoom)) + 'px sans-serif';

        while (label.length > 1 && ctx.measureText(label).width > d - 0.15) {
          label = label.slice(0, -2) + '…';
        }
        ctx.fillText(label, o.x + d / 2, o.y + d / 2);

        if (o.type === 'city' && zoom >= 15) {
          ctx.font = '.33px sans-serif';
          ctx.fillText(o.assignment === '0' ? 'Free' : 'HT' + o.assignment, o.x + d / 2, o.y + d - 0.27);
        }
        ctx.restore();
      }
    }

    if (hover && dims[tool]) {
      const d = dims[tool];
      const ok = valid(tool, hover.x, hover.y);
      ctx.fillStyle = ok ? 'rgba(90,225,155,.42)' : 'rgba(255,80,80,.42)';
      ctx.fillRect(hover.x, hover.y, d, d);
      ctx.strokeStyle = ok ? '#9dffbe' : '#ff8888';
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(hover.x, hover.y, d, d);
    }

    ctx.restore();
  }

  function refresh() {
    const cities = objects.filter(o => o.type === 'city');
    $('cities').textContent = cities.length;
    $('named').textContent = cities.filter(o => o.name.trim()).length;
    $('banners').textContent = objects.filter(o => o.type === 'banner').length;
    $('covered').textContent = coverage().size.toLocaleString();
    $('ht1').textContent = cities.filter(o => o.assignment === '1').length;
    $('ht2').textContent = cities.filter(o => o.assignment === '2').length;

    renderSelection();
    renderList();
    draw();
  }

  function renderSelection() {
    const p = $('selection');
    const o = objects.find(o => o.id === selected);
    p.replaceChildren();

    if (!o) {
      p.textContent = 'Click a structure to edit it.';
      return;
    }

    const title = document.createElement('div');
    title.textContent =
      {
        hq: 'Alliance HQ',
        banner: 'Alliance Banner',
        trap1: 'Hunting Trap 1',
        trap2: 'Hunting Trap 2',
        city: 'Player City'
      }[o.type] +
      ' at (' +
      o.x +
      ', ' +
      o.y +
      ')';
    p.append(title);

    if (o.type === 'city') {
      const label = document.createElement('label');
      label.textContent = 'Player name';
      const input = document.createElement('input');
      input.maxLength = 50;
      input.value = o.name;
      input.addEventListener('input', () => {
        o.name = input.value;
        $('named').textContent = objects.filter(a => a.type === 'city' && a.name.trim()).length;
        renderList();
        draw();
      });

      const tl = document.createElement('label');
      tl.textContent = 'Trap assignment';
      const select = document.createElement('select');
      [
        ['1', 'Hunting Trap 1'],
        ['2', 'Hunting Trap 2'],
        ['0', 'Unassigned']
      ].forEach(([v, t]) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = t;
        select.append(opt);
      });
      select.value = o.assignment;
      select.onchange = () => {
        o.assignment = select.value;
        refresh();
      };

      p.append(label, input, tl, select);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.style.marginTop = '10px';

    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = () => {
      objects = objects.filter(a => a.id !== selected);
      selected = null;
      refresh();
    };

    const deselect = document.createElement('button');
    deselect.textContent = 'Deselect';
    deselect.onclick = () => {
      selected = null;
      refresh();
    };

    actions.append(del, deselect);
    p.append(actions);
  }

  function renderList() {
    const q = $('search').value.toLowerCase();
    const p = $('list');
    p.replaceChildren();

    const cities = objects.filter(o => o.type === 'city' && (!q || (o.name || 'Unnamed').toLowerCase().includes(q)));

    if (!cities.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'No matching cities.';
      p.append(empty);
    }

    for (const o of cities) {
      const row = document.createElement('div');
      row.className = 'entry';

      const name = document.createElement('span');
      name.textContent = o.name || 'Unnamed city';
      const tag = document.createElement('small');
      tag.textContent = o.assignment === '0' ? 'Free' : 'HT' + o.assignment;
      const b = document.createElement('button');
      b.textContent = 'Locate';
      b.onclick = () => {
        selected = o.id;
        ox = map.clientWidth / 2 - (o.x + 1) * zoom;
        oy = map.clientHeight / 2 - (o.y + 1) * zoom;
        setTool('select');
        refresh();
      };
      row.append(name, tag, b);
      p.append(row);
    }
  }

  document.querySelectorAll('[data-tool]').forEach(b => (b.onclick = () => setTool(b.dataset.tool)));
  cv.addEventListener('pointerdown', e => {
    e.preventDefault();
    cv.setPointerCapture(e.pointerId);
    const t = tile(e);
    const h = at(t.x, t.y);
    drag = {px: e.clientX, py: e.clientY, ox, oy, mode: 'click', moved: false};
    if (tool === 'pan' || (tool === 'select' && !h)) {
      drag.mode = 'pan';
      return;
    }
    if (tool === 'select' && h) {
      selected = h.id;
      drag.mode = 'move';
      drag.o = h;
      drag.dx = t.x - h.x;
      drag.dy = t.y - h.y;
      refresh();
    }
  });
  cv.addEventListener('pointermove', e => {
    const t = tile(e);
    hover = t;
    $('coords').textContent = 'X ' + t.x + ' · Y ' + t.y;
    if (drag) {
      if (Math.abs(e.clientX - drag.px) + Math.abs(e.clientY - drag.py) > 5) {
        drag.moved = true;
      }
      if (drag.mode === 'pan') {
        ox = drag.ox + e.clientX - drag.px;
        oy = drag.oy + e.clientY - drag.py;
      } else if (drag.mode === 'move' && drag.moved) {
        const o = drag.o;
        const x = t.x - drag.dx;
        const y = t.y - drag.dy;
        if (valid(o.type, x, y, o.id)) {
          o.x = x;
          o.y = y;
        }
      }
    }
    draw();
  });
  cv.addEventListener('pointerup', e => {
    if (!drag) return;
    const t = tile(e);
    const d = drag;
    if (d.mode === 'click' && !d.moved) {
      if (tool === 'erase') {
        const o = at(t.x, t.y);
        if (o) {
          objects = objects.filter(a => a.id !== o.id);
          if (selected === o.id) selected = null;
          message('Structure removed.');
        }
      } else if (dims[tool]) {
        if (['hq', 'trap1', 'trap2'].includes(tool) && objects.some(o => o.type === tool)) {
          message('Only one ' + tool + ' is allowed. Move the existing structure.');
        } else if (valid(tool, t.x, t.y)) {
          const o = make(
            tool,
            t.x,
            t.y,
            tool === 'city' ? $('newName').value.trim() : '',
            tool === 'city' ? $('newTrap').value : '0'
          );
          objects.push(o);
          selected = o.id;
          message('Placed ' + tool + ' at (' + t.x + ', ' + t.y + ').');
        } else {
          message('Placement blocked: occupied tiles or outside map.');
        }
      }
    }
    drag = null;
    refresh();
  });
  cv.addEventListener('pointercancel', () => {
    drag = null;
    refresh();
  });
  cv.addEventListener('pointerleave', () => {
    hover = null;
    draw();
  });

  function zoomBy(f, cx = map.clientWidth / 2, cy = map.clientHeight / 2) {
    const z = Math.max(2, Math.min(60, zoom * f));
    ox = cx - ((cx - ox) * z) / zoom;
    oy = cy - ((cy - oy) * z) / zoom;
    zoom = z;
    draw();
  }

  cv.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    },
    {passive: false}
  );
  $('zoomIn').onclick = () => zoomBy(1.3);
  $('zoomOut').onclick = () => zoomBy(1 / 1.3);
  $('fit').onclick = () => {
    zoom = Math.min(map.clientWidth / 104, map.clientHeight / 104);
    center();
    draw();
  };
  $('focus').onclick = () => {
    if (!objects.length) {
      $('fit').click();
      return;
    }
    const left = Math.min(...objects.map(o => o.x)) - 5;
    const top = Math.min(...objects.map(o => o.y)) - 5;
    const right = Math.max(...objects.map(o => o.x + dims[o.type])) + 5;
    const bottom = Math.max(...objects.map(o => o.y + dims[o.type])) + 5;
    zoom = Math.min(45, map.clientWidth / (right - left), map.clientHeight / (bottom - top));
    ox = (map.clientWidth - (left + right) * zoom) / 2;
    oy = (map.clientHeight - (top + bottom) * zoom) / 2;
    draw();
  };
  ['territory', 'grid', 'names'].forEach(k => ($(k).onchange = draw));
  $('search').oninput = renderList;

  function pack() {
    return {
      version: 3,
      grid: {width: W, height: H},
      territory: {hq: 15, banner: 7},
      objects,
      nextId: seq
    };
  }

  function importData(data) {
    if (!data || !Array.isArray(data.objects) || data.objects.length > 10000) {
      throw Error('Invalid layout');
    }
    const arr = [];
    let hq = 0;
    let t1 = 0;
    let t2 = 0;
    for (const raw of data.objects) {
      if (
        !Object.prototype.hasOwnProperty.call(dims, raw.type) ||
        !Number.isInteger(raw.x) ||
        !Number.isInteger(raw.y)
      ) {
        throw Error('Invalid structure');
      }
      if (
        (raw.type === 'hq' && ++hq > 1) ||
        (raw.type === 'trap1' && ++t1 > 1) ||
        (raw.type === 'trap2' && ++t2 > 1)
      ) {
        throw Error('Duplicate HQ or trap');
      }
      const o = {
        id: arr.length + 1,
        type: raw.type,
        x: raw.x,
        y: raw.y,
        name: String(raw.name || '').slice(0, 50),
        assignment: ['0', '1', '2'].includes(String(raw.assignment)) ? String(raw.assignment) : '0'
      };
      if (!valid(o.type, o.x, o.y, null, arr)) {
        throw Error('Overlapping or out-of-bounds structures');
      }
      arr.push(o);
    }
    objects = arr;
    seq = arr.length + 1;
    selected = null;
    refresh();
  }

  $('save').onclick = () => {
    try {
      localStorage.setItem('kingshot-hunting-planner-v3', JSON.stringify(pack()));
      message('Saved locally.');
    } catch (e) {
      message('Local storage unavailable. Export JSON instead.');
    }
  };
  $('load').onclick = () => {
    try {
      const data = localStorage.getItem('kingshot-hunting-planner-v3');
      if (!data) {
        message('No local save found.');
        return;
      }
      importData(JSON.parse(data));
      message('Local save loaded.');
    } catch (e) {
      message('Could not load: ' + e.message);
    }
  };
  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(pack(), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lordrush-hunting-trap-layout.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    message('Layout exported as JSON.');
  };
  $('import').onclick = () => $('file').click();
  $('file').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      importData(JSON.parse(await f.text()));
      message('Layout imported successfully.');
    } catch (err) {
      message('Import failed: ' + err.message);
    }
    e.target.value = '';
  };
  $('clear').onclick = () => {
    if (!confirm('Clear all structures and player assignments?')) return;
    objects = [];
    selected = null;
    refresh();
    message('Map cleared.');
  };
  try {
    const s = localStorage.getItem('kingshot-hunting-planner-v3');
    if (s) importData(JSON.parse(s));
  } catch (e) {
  }
  if (!objects.length) {
    seed();
  } else {
    center();
    refresh();
  }
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(draw).observe(map);
  }
})();

