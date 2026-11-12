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

  // --- Сжатие и упаковка раскладки в URL-ссылку ---
  async function encodeShareHash() {
    // Сокращаем структуру для минимального размера ссылки
    const compact = {
      w: [
        $('hqWorldX') ? parseInt($('hqWorldX').value, 10) || 0 : 0,
        $('hqWorldY') ? parseInt($('hqWorldY').value, 10) || 0 : 0
      ],
      o: P.objects.map(o => [o.type, o.x, o.y, o.name || '', o.assignment || '0'])
    };

    const jsonStr = JSON.stringify(compact);
    const bytes = new TextEncoder().encode(jsonStr);

    // Используем встроенное в браузер сжатие deflate-raw для уменьшения длины ссылки
    if (typeof CompressionStream !== 'undefined') {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const compressed = new Uint8Array(await new Response(cs.readable).arrayBuffer());
      let bin = '';
      for (let i = 0; i < compressed.length; i++) bin += String.fromCharCode(compressed[i]);
      return 'z=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    // Резервный вариант без сжатия для старых браузеров
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'b=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  async function decodeShareHash(hash) {
    const clean = hash.replace(/^#/, '');
    const isZ = clean.startsWith('z=');
    const isB = clean.startsWith('b=');
    if (!isZ && !isB) return null;

    let b64 = clean.slice(2).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    let jsonStr = '';
    if (isZ && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(bytes);
      writer.close();
      const decompressed = await new Response(ds.readable).arrayBuffer();
      jsonStr = new TextDecoder().decode(decompressed);
    } else {
      jsonStr = new TextDecoder().decode(bytes);
    }

    const compact = JSON.parse(jsonStr);
    if (!compact || !Array.isArray(compact.o)) throw Error('Corrupted link');

    return {
      hqWorld: Array.isArray(compact.w) ? { x: compact.w[0], y: compact.w[1] } : undefined,
      objects: compact.o.map(item => ({
        type: item[0],
        x: item[1],
        y: item[2],
        name: item[3] || '',
        assignment: item[4] || '0'
      }))
    };
  }

  if ($('shareLink')) {
    $('shareLink').onclick = async () => {
      try {
        const hash = await encodeShareHash();
        const baseUrl = location.href.split('#')[0];
        const url = baseUrl + '#' + hash;
        history.replaceState(null, '', '#' + hash);

        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
          P.message('Shareable link copied to clipboard!');
        } else {
          prompt('Copy this link to share your layout:', url);
        }
      } catch (e) {
        P.message('Could not create link: ' + e.message);
      }
    };
  }


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
      history.replaceState(null, '', location.pathname);
      P.refresh();
      P.message('Map cleared.');
    };
  }

  // Асинхронная загрузка: сначала проверяем ссылку (#z=...), затем localStorage
  P.initData = async () => {
    if (location.hash.length > 3) {
      try {
        const shared = await decodeShareHash(location.hash);
        if (shared) {
          P.importData(shared);
          P.message('Layout loaded from shared link.');
          return true;
        }
      } catch (e) {
        P.message('Invalid or broken share link.');
      }
    }

    try {
      const s = localStorage.getItem(STORAGE_KEY);
      if (s) {
        P.importData(JSON.parse(s));
        return true;
      }
    } catch (e) {}

    return false;
  };
})();
