(() => {
  'use strict';

  const P = window.Planner;
  const $ = P.$;

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
        ctx.scale(1 / P.zoom, 1 / P.zoom);

        const fontSize = Math.round(Math.max(8, Math.min(d * P.zoom * 0.36, 16)));
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${fontSize}px sans-serif`;

        const maxWidth = d * P.zoom * (P.iso ? 1.35 : 0.92);
        while (label.length > 1 && ctx.measureText(label).width > maxWidth) {
          label = label.slice(0, -2) + '…';
        }

        const showSub = o.type === 'city' && P.zoom >= 12;
        ctx.fillText(label, 0, showSub ? -fontSize * 0.45 : 0);

        if (showSub) {
          const subSize = Math.round(Math.max(7, fontSize * 0.75));
          ctx.font = `${subSize}px sans-serif`;
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

  ['territory', 'grid'].forEach(k => { if ($(k)) $(k).onchange = P.draw; });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(P.draw).observe(P.map);
})();
