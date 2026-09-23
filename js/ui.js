/* Ember — UI toolkit: sheets, alerts, menus, toasts, components, charts */
(function () {
  'use strict';
  const E = window.Ember;
  const esc = E.esc;
  const ui = (E.ui = {});
  const overlayRoot = () => document.getElementById('overlay-root');

  /* ---------- sheet (modal) ---------- */
  ui.sheet = function ({ title = '', body = '', done = 'Done', cancel = 'Cancel', hideDone = false, size = '', actions = {}, onDone, onClose, onInput, onChange, mount }) {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `
      <div class="sheet-backdrop"></div>
      <div class="sheet ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-grabber"></div>
        <header class="sheet-head">
          <button class="sheet-btn" data-sheet="cancel">${esc(cancel)}</button>
          <h2 class="sheet-title">${esc(title)}</h2>
          ${hideDone ? '<span class="sheet-btn-ph"></span>' : `<button class="sheet-btn strong" data-sheet="done">${esc(done)}</button>`}
        </header>
        <div class="sheet-body">${body}</div>
      </div>`;
    overlayRoot().appendChild(wrap);
    const prevFocus = document.activeElement;
    let closed = false;
    const api = {
      wrap,
      el: wrap.querySelector('.sheet'),
      body: wrap.querySelector('.sheet-body'),
      $: (sel) => wrap.querySelector(sel),
      $$: (sel) => [...wrap.querySelectorAll(sel)],
      setBody(html) {
        const st = api.body.scrollTop;
        api.body.innerHTML = html;
        api.body.scrollTop = st;
      },
      setTitle(t) {
        wrap.querySelector('.sheet-title').textContent = t;
      },
      close,
      done: () => {
        if (onDone && onDone(api) === false) return;
        close();
      },
    };
    function close() {
      if (closed) return;
      closed = true;
      wrap.classList.remove('open');
      wrap.classList.add('closing');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(() => wrap.remove(), 320);
      if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
      onClose && onClose(api);
    }
    function onKey(e) {
      if (overlayRoot().lastElementChild !== wrap) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !hideDone) {
        e.preventDefault();
        api.done();
      }
    }
    document.addEventListener('keydown', onKey, true);
    wrap.addEventListener('click', (e) => {
      if (e.target.classList.contains('sheet-backdrop')) return close();
      const sb = e.target.closest('[data-sheet]');
      if (sb) return sb.dataset.sheet === 'cancel' ? close() : api.done();
      const a = e.target.closest('[data-act]');
      if (a && actions[a.dataset.act]) actions[a.dataset.act](a, e, api);
    });
    if (onInput) wrap.addEventListener('input', (e) => onInput(e.target, e, api));
    if (onChange) wrap.addEventListener('change', (e) => onChange(e.target, e, api));
    mount && mount(api);
    requestAnimationFrame(() => {
      wrap.classList.add('open');
      const af = wrap.querySelector('[autofocus]');
      if (af && window.matchMedia('(pointer: fine)').matches) af.focus({ preventScroll: true });
    });
    return api;
  };

  /* ---------- alert / confirm ---------- */
  ui.confirm = ({ title, message = '', ok = 'OK', cancel = 'Cancel', destructive = false }) =>
    new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'alert-wrap';
      wrap.innerHTML = `<div class="alert" role="alertdialog" aria-modal="true">
        <div class="alert-text"><h3>${esc(title)}</h3>${message ? `<p>${esc(message)}</p>` : ''}</div>
        <div class="alert-btns">
          <button data-r="0">${esc(cancel)}</button>
          <button data-r="1" class="${destructive ? 'danger' : 'strong'}">${esc(ok)}</button>
        </div></div>`;
      overlayRoot().appendChild(wrap);
      requestAnimationFrame(() => wrap.classList.add('open'));
      const done = (r) => {
        document.removeEventListener('keydown', key, true);
        wrap.classList.remove('open');
        setTimeout(() => wrap.remove(), 200);
        resolve(r);
      };
      const key = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(false); }
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); done(true); }
      };
      document.addEventListener('keydown', key, true);
      wrap.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]');
        if (b) done(b.dataset.r === '1');
        else if (e.target === wrap) done(false);
      });
      setTimeout(() => wrap.querySelector('[data-r="1"]').focus(), 30);
    });

  /* ---------- context menu ---------- */
  ui.menu = function (anchor, items) {
    document.querySelectorAll('.menu-pop').forEach((m) => m.remove());
    const m = document.createElement('div');
    m.className = 'menu-pop';
    m.setAttribute('role', 'menu');
    m.innerHTML = items
      .map((it, i) =>
        it === '-'
          ? '<div class="menu-sep"></div>'
          : `<button role="menuitem" class="menu-item ${it.danger ? 'danger' : ''}" data-i="${i}">${it.icon ? E.icon(it.icon, 17) : ''}<span>${esc(it.label)}</span></button>`
      )
      .join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    let left = r.right - w, top = r.bottom + 6;
    if (left < 8) left = 8;
    if (top + h > innerHeight - 8) top = r.top - h - 6;
    m.style.left = left + 'px';
    m.style.top = Math.max(8, top) + 'px';
    requestAnimationFrame(() => m.classList.add('open'));
    const close = () => {
      m.remove();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', key, true);
    };
    const outside = (e) => { if (!m.contains(e.target)) close(); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    setTimeout(() => {
      document.addEventListener('pointerdown', outside, true);
      document.addEventListener('keydown', key, true);
    });
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]');
      if (!b) return;
      close();
      items[+b.dataset.i].onClick();
    });
  };

  /* ---------- toast (HUD) ---------- */
  ui.toast = function (msg, icon = 'check') {
    let host = document.querySelector('.toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toast-host';
      host.setAttribute('aria-live', 'polite');
      document.body.appendChild(host);
    }
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${E.icon(icon, 17)}<span>${esc(msg)}</span>`;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, 2400);
  };

  /* ---------- tooltip for [data-tip] ---------- */
  let tipEl;
  function showTip(target) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tip';
      document.body.appendChild(tipEl);
    }
    tipEl.innerHTML = target.dataset.tip;
    tipEl.classList.add('show');
    const r = target.getBoundingClientRect();
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
    if (y < 6) y = r.bottom + 8;
    tipEl.style.left = E.clamp(x, 6, innerWidth - w - 6) + 'px';
    tipEl.style.top = y + 'px';
  }
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (t) showTip(t);
    else if (tipEl) tipEl.classList.remove('show');
  });
  document.addEventListener('scroll', () => tipEl && tipEl.classList.remove('show'), true);

  /* ---------- confetti ---------- */
  ui.confetti = function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const c = document.createElement('canvas');
    c.className = 'confetti';
    c.width = innerWidth * devicePixelRatio;
    c.height = innerHeight * devicePixelRatio;
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const colors = ['#FF9F0A', '#FFC56B', '#FF6B3D', '#FFD60A', '#ffffff'];
    const parts = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: -Math.random() * 16 - 6,
      r: Math.random() * 360,
      vr: (Math.random() - 0.5) * 20,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    (function frame(t) {
      const el = t - t0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of parts) {
        p.vy += 0.45;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - el / 2200);
        ctx.translate(p.x, p.y);
        ctx.rotate((p.r * Math.PI) / 180);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (el < 2200) requestAnimationFrame(frame);
      else c.remove();
    })(t0);
  };

  /* ---------- components ---------- */
  ui.ring = (pct, { size = 44, stroke = 5, color = 'var(--accent)', track = 'var(--ring-track)', cls = '' } = {}) => {
    const r = (size - stroke) / 2, c = 2 * Math.PI * r;
    const off = c * (1 - E.clamp(pct || 0, 0, 1));
    return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
      <circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" style="--c:${c.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})" ${pct <= 0 ? 'opacity="0"' : ''}/>
    </svg>`;
  };

  /** Concentric activity-style rings. rings: [{pct,color}] outermost first */
  ui.rings = (rings, size = 132, stroke = 14, gap = 3) => {
    let out = `<svg class="rings" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">`;
    rings.forEach((rg, i) => {
      const r = size / 2 - stroke / 2 - i * (stroke + gap), c = 2 * Math.PI * r;
      const p = E.clamp(rg.pct || 0, 0, 1);
      out += `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${rg.color}" stroke-opacity=".2" stroke-width="${stroke}"/>`;
      if (p > 0)
        out += `<circle class="ring-val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${rg.color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}" style="--c:${c.toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
    });
    return out + '</svg>';
  };

  ui.seg = (act, options, value, cls = '') =>
    `<div class="seg ${cls}" role="tablist">${options
      .map((o) => `<button type="button" class="seg-btn ${o.value === value ? 'on' : ''}" data-act="${act}" data-value="${esc(o.value)}" role="tab" aria-selected="${o.value === value}">${o.label}</button>`)
      .join('')}</div>`;

  ui.toggle = (attrs, on) => `<label class="switch"><input type="checkbox" ${attrs} ${on ? 'checked' : ''}><span class="switch-track"><span class="switch-thumb"></span></span></label>`;

  ui.stepper = (act, value, suffix = '') =>
    `<div class="stepper"><button type="button" data-act="${act}" data-delta="-1" aria-label="Decrease">${E.icon('minus', 16)}</button><span class="stepper-val">${value}${suffix}</span><button type="button" data-act="${act}" data-delta="1" aria-label="Increase">${E.icon('plus', 16)}</button></div>`;

  ui.emojiGrid = (selected, act = 'pick-emoji') =>
    `<div class="emoji-grid">${E.EMOJIS.map((e) => `<button type="button" class="emoji-opt ${e === selected ? 'on' : ''}" data-act="${act}" data-value="${e}">${e}</button>`).join('')}</div>`;

  ui.colorRow = (selected, act = 'pick-color') =>
    `<div class="color-row">${E.COLORS.map((c) => `<button type="button" class="color-opt ${c === selected ? 'on' : ''}" data-act="${act}" data-value="${c}" style="--c:${c}" aria-label="Color ${c}"></button>`).join('')}</div>`;

  ui.empty = ({ icon, title, text = '', action = '', actAttr = '' }) =>
    `<div class="empty"><div class="empty-ic">${E.icon(icon, 30)}</div><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action ? `<button class="btn btn-tinted" ${actAttr}>${E.icon('plus', 16)}${esc(action)}</button>` : ''}</div>`;

  ui.check = (on, attrs = '', color = 'var(--accent)') =>
    `<button type="button" class="check ${on ? 'on' : ''}" style="--c:${color}" ${attrs} aria-pressed="${on}" aria-label="${on ? 'Mark as not done' : 'Mark as done'}">${E.icon('check', 14)}</button>`;

  ui.stars = (rating, act = '', size = 16) =>
    `<div class="stars ${act ? 'interactive' : ''}" ${act ? '' : `aria-label="${rating} of 5 stars"`}>${[1, 2, 3, 4, 5]
      .map((i) => (act ? `<button type="button" class="star ${i <= rating ? 'on' : ''}" data-act="${act}" data-value="${i}" aria-label="${i} stars">${E.icon('star', size)}</button>` : `<span class="star ${i <= rating ? 'on' : ''}">${E.icon('star', size)}</span>`))
      .join('')}</div>`;

  const COVERS = [
    ['#FF9F0A', '#B8430B'], ['#3A3A3C', '#1C1C1E'], ['#7A3E2A', '#2B1810'], ['#2D5B63', '#12262A'],
    ['#5E5CE6', '#23225E'], ['#C4553B', '#5A1F14'], ['#6B7A3A', '#262D12'], ['#8E6BBF', '#3B2657'],
  ];
  ui.cover = (b, cls = '') => {
    const pal = COVERS[E.hash((b.title || '') + (b.author || '')) % COVERS.length];
    return `<div class="cover ${cls}" style="--c1:${pal[0]};--c2:${pal[1]}">
      <div class="cover-gen"><div class="cover-title">${esc(b.title || 'Untitled')}</div><div class="cover-author">${esc(b.author || '')}</div></div>
      ${b.cover ? `<img src="${esc(b.cover)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()" onload="if(this.naturalWidth<10)this.remove()">` : ''}
    </div>`;
  };

  /** Tappable habit day cell: shows a partial ring for counted habits, a check when complete. */
  ui.habitCell = (h, k, { size = 34, act = 'habit-tap', due = true } = {}) => {
    const c = E.habit.count(h, k), t = h.target || 1, done = c >= t;
    const tip = `${E.fmt(k, { weekday: 'short', month: 'short', day: 'numeric' })} · ${t > 1 ? `${c}/${t}` : done ? 'Done' : due ? 'Not done' : 'Rest day'}`;
    const inner = done ? E.icon('check', Math.round(size * 0.46)) : t > 1 && c > 0 ? `<span class="hcell-n">${c}</span>` : '';
    return `<button type="button" class="hcell ${done ? 'done' : ''} ${due ? '' : 'rest'}" style="--c:${h.color};--s:${size}px" data-act="${act}" data-id="${h.id}" data-date="${k}" data-tip="${esc(tip)}" aria-label="${esc(h.name)}, ${esc(tip)}">
      ${t > 1 && !done && c > 0 ? ui.ring(c / t, { size, stroke: 3, color: h.color, track: 'transparent', cls: 'hcell-ring' }) : ''}${inner}</button>`;
  };

  ui.progress = (pct, color = 'var(--accent)') =>
    `<div class="pbar" role="progressbar" aria-valuenow="${Math.round(pct * 100)}" aria-valuemin="0" aria-valuemax="100"><div style="width:${(E.clamp(pct, 0, 1) * 100).toFixed(1)}%;background:${color}"></div></div>`;

  ui.download = (filename, text, type = 'application/json') => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  ui.autoGrow = (ta) => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  };

  /* ---------- charts (single-series, one hue, hover tooltips) ---------- */
  const chart = (E.chart = {});

  /** Vertical bars. data: [{label, value, tip, hi}] */
  chart.bars = (data, { height = 150, max, fmt = (v) => v, color = 'var(--accent)', every = 1 } = {}) => {
    const m = max || Math.max(1, ...data.map((d) => d.value));
    const nice = niceMax(m);
    return `<div class="bars" style="--h:${height}px">
      <div class="bars-grid">${[1, 0.5, 0]
        .map((f) => {
          const v = Math.round(nice * f * 10) / 10;
          return `<div class="gl" style="bottom:${f * 100}%"><span>${Number.isInteger(v) ? fmt(v) : ''}</span></div>`;
        })
        .join('')}</div>
      <div class="bars-cols">${data
        .map(
          (d, i) => `<div class="bar-col ${d.hi ? 'hi' : ''}" data-tip="${esc(d.tip || `${d.label}: ${fmt(d.value)}`)}" tabindex="0">
            <div class="bar-track"><div class="bar" style="height:${((d.value / nice) * 100).toFixed(1)}%;${d.value > 0 ? `min-height:3px;` : ''}background:${color}"></div></div>
            <span class="bar-lbl">${i % every === 0 ? esc(d.label) : ''}</span></div>`
        )
        .join('')}</div></div>`;
  };

  function niceMax(m) {
    if (m <= 5) return Math.ceil(m);
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= m) return s * p;
    return m;
  }

  /** Line with round markers. points: [{label, value|null, tip}] ; y domain [min,max] */
  chart.line = (points, { height = 170, min = 1, max = 5, yLabels = [], color = 'var(--accent)', every = 1 } = {}) => {
    const n = points.length;
    const x = (i) => (n === 1 ? 50 : (i / (n - 1)) * 100);
    const y = (v) => 100 - ((v - min) / (max - min)) * 100;
    // Sparse data (e.g. mood only on days with an entry): connect the known points
    const segs = [points.map((p, i) => (p.value == null ? null : `${x(i).toFixed(2)},${y(p.value).toFixed(2)}`)).filter(Boolean)];
    return `<div class="linechart" style="--h:${height}px">
      <div class="lc-y">${yLabels.map((l) => `<span style="top:${y(l.v)}%">${l.label}</span>`).join('')}</div>
      <div class="lc-plot">
        ${yLabels.map((l) => `<div class="gl" style="top:${y(l.v)}%"></div>`).join('')}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${segs
          .map((s) => `<polyline points="${s.join(' ')}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>`)
          .join('')}</svg>
        ${points.map((p, i) => (p.value == null ? '' : `<div class="lc-dot" style="left:${x(i)}%;top:${y(p.value)}%;background:${color}"></div>`)).join('')}
        ${points
          .map((p, i) => (p.value == null ? '' : `<div class="lc-hit" style="left:${x(i)}%;width:${(100 / n).toFixed(2)}%" data-tip="${esc(p.tip)}"></div>`))
          .join('')}
      </div>
      <div class="lc-x">${points
        .map((p, i) => (i % every === 0 ? `<span style="left:${x(i)}%">${esc(p.label)}</span>` : ''))
        .join('')}</div>
    </div>`;
  };

  /** Heatmap: weeks as columns, 7 rows. cells: [{key, level 0..4, tip, future}] ordered by day, starting at a week start. */
  chart.heat = (cells, color = 'var(--accent)') => {
    const months = [];
    let lastM = -1;
    for (let i = 0; i < cells.length; i += 7) {
      const m = E.parse(cells[i].key).getMonth();
      months.push(m !== lastM ? E.MONTHS[m].slice(0, 3) : '');
      lastM = m;
    }
    // Drop a month label when the next one starts within 3 columns (they would overlap)
    for (let i = 0; i < months.length; i++) {
      if (!months[i]) continue;
      for (let j = i + 1; j < Math.min(months.length, i + 3); j++) if (months[j]) months[i] = '';
    }
    const order = E.weekdayOrder();
    return `<div class="heat" style="--hc:${color};--weeks:${months.length}">
      <div class="heat-days"><span></span>${order.map((d, i) => `<span>${i % 2 === 0 ? E.DAY_SHORT[d].slice(0, 1) : ''}</span>`).join('')}</div>
      <div class="heat-main">
        <div class="heat-months" style="grid-template-columns:repeat(${months.length},var(--cell))">${months.map((m) => `<span>${m}</span>`).join('')}</div>
        <div class="heat-grid">${cells
          .map((c) => `<div class="hc l${c.level} ${c.future ? 'fut' : ''}" ${c.future ? '' : `data-tip="${esc(c.tip)}"`}></div>`)
          .join('')}</div>
      </div>
    </div>`;
  };

  /** Build heatmap cells for the last `weeks` weeks using fn(key) → {level, tip} */
  chart.heatCells = (weeks, fn) => {
    const today = E.today();
    const start = E.addDays(E.weekStartKey(today), -7 * (weeks - 1));
    const out = [];
    for (let i = 0; i < weeks * 7; i++) {
      const k = E.addDays(start, i);
      if (k > today) out.push({ key: k, level: 0, future: true });
      else out.push({ key: k, ...fn(k) });
    }
    return out;
  };
})();
