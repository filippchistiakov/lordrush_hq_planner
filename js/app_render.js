(() => {
  'use strict';

  const P = window.Planner;
  const $ = P.$;

  P.renderSelection = () => {
    const p = $('selection');
    if (!p) return;
    const o = P.objects.find(o => o.id === P.selected);
    p.replaceChildren();

    if (!o) {
      p.textContent = 'Click a structure to edit it.';
      return;
    }

    const wc = P.getWorldCoords(o.x, o.y);
    const title = document.createElement('div');
    const typeName = (P.types[o.type] && P.types[o.type].title) || o.type;

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
        P.renderList();
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
        P.refresh();
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
      P.refresh();
    };

    const deselect = document.createElement('button');
    deselect.textContent = 'Deselect';
    deselect.onclick = () => {
      P.selected = null;
      P.refresh();
    };

    actions.append(del, deselect);
    p.append(actions);
  };

  P.renderList = () => {
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
        if (P.selected === o.id) P.renderSelection();
        P.draw();
      });

      nameInput.addEventListener('focus', () => {
        if (P.selected !== o.id) {
          P.selected = o.id;
          document.querySelectorAll('.entry').forEach(el => el.classList.remove('is-selected'));
          row.classList.add('is-selected');
          P.renderSelection();
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
        const pos = P.gridToScreen(o.x + 1, o.y + 1);
        P.ox = P.map.clientWidth / 2 - pos.x * P.zoom;
        P.oy = P.map.clientHeight / 2 - pos.y * P.zoom;
        P.setTool('select');
        P.refresh();
      };

      row.append(nameInput, tag, btn);
      p.append(row);
    }
  };

  P.refresh = () => {
    const cities = P.objects.filter(o => o.type === 'city');
    if ($('cities')) $('cities').textContent = cities.length;
    if ($('named')) $('named').textContent = cities.filter(o => o.name.trim()).length;
    if ($('banners')) $('banners').textContent = P.objects.filter(o => o.type === 'banner').length;
    if ($('covered')) $('covered').textContent = P.coverage().size.toLocaleString();
    if ($('ht1')) $('ht1').textContent = cities.filter(o => o.assignment === '1').length;
    if ($('ht2')) $('ht2').textContent = cities.filter(o => o.assignment === '2').length;

    P.renderSelection();
    P.renderList();
    P.draw();
  };

  if ($('hqWorldX')) $('hqWorldX').oninput = P.renderSelection;
  if ($('hqWorldY')) $('hqWorldY').oninput = P.renderSelection;
  if ($('search')) $('search').oninput = P.renderList;
})();
