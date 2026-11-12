(() => {
  'use strict';

  const P = window.Planner;
  const $ = P.$;

  function getWorldCoords(x, y) {
    const hq = P.objects.find(o => o.type === 'hq');
    const baseX = $('hqWorldX') ? parseInt($('hqWorldX').value, 10) || 0 : 0;
    const baseY = $('hqWorldY') ? parseInt($('hqWorldY').value, 10) || 0 : 0;

    const obj = P.objects.find(o => o.x === x && o.y === y);
    const d = obj ? P.dims[obj.type] : 1;

    // Правый нижний угол выбранного объекта
    const brX = x + (d - 1);
    const brY = y + (d - 1);

    if (!hq) return { wx: baseX - brY, wy: baseY - brX, hasHq: false };

    // Правый нижний угол HQ
    const hqBrX = hq.x + (P.dims.hq - 1);
    const hqBrY = hq.y + (P.dims.hq - 1);

    const dx = brX - hqBrX;
    const dy = brY - hqBrY;

    // Поворот осей: движение вправо по сетке (+dx) уменьшает Y, движение вниз (+dy) уменьшает X
    return {
      wx: baseX - dy,
      wy: baseY - dx,
      hasHq: true
    };
  }


  function seed() {
    P.objects = [
      P.make('hq', 48, 48),
      P.make('trap1', 31, 47),
      P.make('trap2', 66, 47),
      P.make('banner', 43, 49),
      P.make('banner', 57, 49)
    ];
    P.center();
    refresh();
  }

  function refresh() {
    const cities = P.objects.filter(o => o.type === 'city');
    if ($('cities')) $('cities').textContent = cities.length;
    if ($('named')) $('named').textContent = cities.filter(o => o.name.trim()).length;
    if ($('banners')) $('banners').textContent = P.objects.filter(o => o.type === 'banner').length;
    if ($('covered')) $('covered').textContent = P.coverage().size.toLocaleString();
    if ($('ht1')) $('ht1').textContent = cities.filter(o => o.assignment === '1').length;
    if ($('ht2')) $('ht2').textContent = cities.filter(o => o.assignment === '2').length;

    renderSelection();
    renderList();
    P.draw();
  }

  function renderSelection() {
    const p = $('selection');
    if (!p) return;
    const o = P.objects.find(o => o.id === P.selected);
    p.replaceChildren();

    if (!o) {
      p.textContent = 'Click a structure to edit it.';
      return;
    }

    const wc = getWorldCoords(o.x, o.y);
    const title = document.createElement('div');
    const typeName = {
      hq: 'Alliance HQ',
      banner: 'Alliance Banner',
      trap1: 'Hunting Trap 1',
      trap2: 'Hunting Trap 2',
      city: 'Player City'
    }[o.type];

    title.innerHTML =
      `<b>${typeName}</b><br>` +
      `<small>World: <b>X ${wc.wx} · Y ${wc.wy}</b> (Grid: ${o.x}, ${o.y})</small>`;
    p.append(title);

    if (o.type === 'city') {
      const label = document.createElement('label');
      label.textContent = 'Player name';
      const input = document.createElement('input');
      input.maxLength = 50;
      input.value = o.name;
      input.addEventListener('input', () => {
        o.name = input.value;
        if ($('named')) {
          $('named').textContent = P.objects.filter(a => a.type === 'city' && a.name.trim()).length;
        }
        renderList();
        P.draw();
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
      P.objects = P.objects.filter(a => a.id !== P.selected);
      P.selected = null;
      refresh();
    };

    const deselect = document.createElement('button');
    deselect.textContent = 'Deselect';
    deselect.onclick = () => {
      P.selected = null;
      refresh();
    };

    actions.append(del, deselect);
    p.append(actions);
  }

  function renderList() {
    const p = $('list');
    if (!p) return;
    const q = $('search') ? $('search').value.toLowerCase() : '';
    p.replaceChildren();

    const cities = P.objects.filter(o => {
      if (o.type !== 'city') return false;
      const displayName = o.name || 'Unnamed city';
      return !q || displayName.toLowerCase().includes(q);
    });

    if (!cities.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'No matching cities.';
      p.append(empty);
      return;
    }

    for (const o of cities) {
      const row = document.createElement('div');
      row.className = 'entry';
      if (P.selected === o.id) row.classList.add('is-selected');

      const nameInput = document.createElement('input');
      nameInput.className = 'entry-input';
      nameInput.maxLength = 50;
      nameInput.value = o.name;
      nameInput.placeholder = 'Unnamed city';

      nameInput.addEventListener('input', () => {
        o.name = nameInput.value;
        if ($('named')) {
          $('named').textContent = P.objects.filter(a => a.type === 'city' && a.name.trim()).length;
        }
        if (P.selected === o.id) renderSelection();
        P.draw();
      });

      nameInput.addEventListener('focus', () => {
        if (P.selected !== o.id) {
          P.selected = o.id;
          document.querySelectorAll('.entry').forEach(el => el.classList.remove('is-selected'));
          row.classList.add('is-selected');
          renderSelection();
          P.draw();
        }
      });

      const tag = document.createElement('small');
      tag.textContent = o.assignment === '0' ? 'Free' : 'HT' + o.assignment;
      tag.className = o.assignment === '0' ? 'badge-free' : 'badge-assigned';

      const btn = document.createElement('button');
      btn.textContent = 'Locate';
      btn.onclick = () => {
        P.selected = o.id;
        P.ox = P.map.clientWidth / 2 - (o.x + 1) * P.zoom;
        P.oy = P.map.clientHeight / 2 - (o.y + 1) * P.zoom;
        P.setTool('select');
        refresh();
      };

      row.append(nameInput, tag, btn);
      p.append(row);
    }
  }
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
      refresh();
    }
  });

  P.cv.addEventListener('pointermove', e => {
    const t = P.tile(e);
    P.hover = t;
    const wc = getWorldCoords(t.x, t.y);
    if ($('coords')) {
      $('coords').textContent = `World X ${wc.wx} · Y ${wc.wy} (Grid ${t.x}, ${t.y})`;
    }

    if (P.drag) {
      if (Math.abs(e.clientX - P.drag.px) + Math.abs(e.clientY - P.drag.py) > 5) {
        P.drag.moved = true;
      }

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
          if (P.selected === o.id) renderSelection();
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
        if (['hq', 'trap1', 'trap2'].includes(P.tool) && P.objects.some(o => o.type === P.tool)) {
          P.message('Only one ' + P.tool + ' is allowed. Move the existing structure.');
        } else if (P.valid(P.tool, t.x, t.y)) {
          const o = P.make(
            P.tool,
            t.x,
            t.y,
            P.tool === 'city' && $('newName') ? $('newName').value.trim() : '',
            P.tool === 'city' && $('newTrap') ? $('newTrap').value : '0'
          );
          P.objects.push(o);
          P.selected = o.id;
          P.message('Placed ' + P.tool + ' at (' + t.x + ', ' + t.y + ').');
        } else {
          P.message('Placement blocked: occupied tiles or outside map.');
        }
      }
    }

    P.drag = null;
    refresh();
  });

  P.cv.addEventListener('pointercancel', () => {
    P.drag = null;
    refresh();
  });

  P.cv.addEventListener('pointerleave', () => {
    P.hover = null;
    P.draw();
  });

  function zoomBy(f, cx = P.map.clientWidth / 2, cy = P.map.clientHeight / 2) {
    const z = Math.max(2, Math.min(60, P.zoom * f));
    P.ox = cx - ((cx - P.ox) * z) / P.zoom;
    P.oy = cy - ((cy - P.oy) * z) / P.zoom;
    P.zoom = z;
    P.draw();
  }

  P.cv.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      const r = P.cv.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false }
  );

  if ($('zoomIn')) $('zoomIn').onclick = () => zoomBy(1.3);
  if ($('zoomOut')) $('zoomOut').onclick = () => zoomBy(1 / 1.3);
  if ($('fit')) {
    $('fit').onclick = () => {
      P.zoom = Math.min(P.map.clientWidth / 104, P.map.clientHeight / 104);
      P.center();
      P.draw();
    };
  }

  if ($('focus')) {
    $('focus').onclick = () => {
      if (!P.objects.length) {
        if ($('fit')) $('fit').click();
        return;
      }
      const left = Math.min(...P.objects.map(o => o.x)) - 5;
      const top = Math.min(...P.objects.map(o => o.y)) - 5;
      const right = Math.max(...P.objects.map(o => o.x + P.dims[o.type])) + 5;
      const bottom = Math.max(...P.objects.map(o => o.y + P.dims[o.type])) + 5;
      P.zoom = Math.min(45, P.map.clientWidth / (right - left), P.map.clientHeight / (bottom - top));
      P.ox = (P.map.clientWidth - (left + right) * P.zoom) / 2;
      P.oy = (P.map.clientHeight - (top + bottom) * P.zoom) / 2;
      P.draw();
    };
  }

  ['territory', 'grid', 'names'].forEach(k => {
    if ($(k)) $(k).onchange = P.draw;
  });

  if ($('hqWorldX')) $('hqWorldX').oninput = renderSelection;
  if ($('hqWorldY')) $('hqWorldY').oninput = renderSelection;
  if ($('search')) $('search').oninput = renderList;

  function pack() {
    return {
      version: 4,
      grid: { width: P.W, height: P.H },
      territory: { hq: 15, banner: 7 },
      hqWorld: {
        x: $('hqWorldX') ? parseInt($('hqWorldX').value, 10) || 0 : 0,
        y: $('hqWorldY') ? parseInt($('hqWorldY').value, 10) || 0 : 0
      },
      objects: P.objects,
      nextId: P.seq
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
        !Object.prototype.hasOwnProperty.call(P.dims, raw.type) ||
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

      if (!P.valid(o.type, o.x, o.y, null, arr)) {
        throw Error('Overlapping or out-of-bounds structures');
      }
      arr.push(o);
    }

    if (data.hqWorld) {
      if ($('hqWorldX') && Number.isFinite(data.hqWorld.x)) $('hqWorldX').value = data.hqWorld.x;
      if ($('hqWorldY') && Number.isFinite(data.hqWorld.y)) $('hqWorldY').value = data.hqWorld.y;
    }

    P.objects = arr;
    P.seq = arr.length + 1;
    P.selected = null;
    refresh();
  }

  if ($('save')) {
    $('save').onclick = () => {
      try {
        localStorage.setItem('kingshot-hunting-planner-v3', JSON.stringify(pack()));
        P.message('Saved locally.');
      } catch (e) {
        P.message('Local storage unavailable. Export JSON instead.');
      }
    };
  }

  if ($('load')) {
    $('load').onclick = () => {
      try {
        const data = localStorage.getItem('kingshot-hunting-planner-v3');
        if (!data) {
          P.message('No local save found.');
          return;
        }
        importData(JSON.parse(data));
        P.message('Local save loaded.');
      } catch (e) {
        P.message('Could not load: ' + e.message);
      }
    };
  }

  if ($('export')) {
    $('export').onclick = () => {
      const blob = new Blob([JSON.stringify(pack(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lordrush-hunting-trap-layout.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      P.message('Layout exported as JSON.');
    };
  }

  if ($('import')) $('import').onclick = () => $('file') && $('file').click();

  if ($('file')) {
    $('file').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        importData(JSON.parse(await f.text()));
        P.message('Layout imported successfully.');
      } catch (err) {
        P.message('Import failed: ' + err.message);
      }
      e.target.value = '';
    };
  }

  if ($('clear')) {
    $('clear').onclick = () => {
      if (!confirm('Clear all structures and player assignments?')) return;
      P.objects = [];
      P.selected = null;
      refresh();
      P.message('Map cleared.');
    };
  }

  try {
    const s = localStorage.getItem('kingshot-hunting-planner-v3');
    if (s) importData(JSON.parse(s));
  } catch (e) {}

  if (!P.objects.length) {
    seed();
  } else {
    P.center();
    refresh();
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(P.draw).observe(P.map);
  }
})();
