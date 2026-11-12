(() => {
  'use strict';

  const P = window.Planner;
  const $ = P.$;
  const STORAGE_KEY = 'kingshot-hunting-planner-v3';

  P.pack = () => {
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
  };

  P.importData = data => {
    if (!data || !Array.isArray(data.objects) || data.objects.length > 10000) {
      throw Error('Invalid layout');
    }
    const arr = [];
    const counts = {};

    for (const raw of data.objects) {
      if (
        !Object.prototype.hasOwnProperty.call(P.dims, raw.type) ||
        !Number.isInteger(raw.x) ||
        !Number.isInteger(raw.y)
      ) {
        throw Error('Invalid structure');
      }
      counts[raw.type] = (counts[raw.type] || 0) + 1;
      if (P.types[raw.type].unique && counts[raw.type] > 1) {
        throw Error('Duplicate ' + P.types[raw.type].title);
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
    P.refresh();
  };

  if ($('save')) {
    $('save').onclick = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(P.pack()));
        P.message('Saved locally.');
      } catch (e) {
        P.message('Local storage unavailable. Export JSON instead.');
      }
    };
  }

  if ($('load')) {
    $('load').onclick = () => {
      try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) {
          P.message('No local save found.');
          return;
        }
        P.importData(JSON.parse(data));
        P.message('Local save loaded.');
      } catch (e) {
        P.message('Could not load: ' + e.message);
      }
    };
  }

  if ($('export')) {
    $('export').onclick = () => {
      const blob = new Blob([JSON.stringify(P.pack(), null, 2)], { type: 'application/json' });
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
        P.importData(JSON.parse(await f.text()));
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
      P.refresh();
      P.message('Map cleared.');
    };
  }

  P.loadFromStorage = () => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) P.importData(JSON.parse(s));
    } catch (e) {}
  };
})();
