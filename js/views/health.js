/* Ember — Health: sleep, stress, Body Battery… (from Garmin or logged by hand) and how they relate to productivity */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  const hm = (m) => {
    m = Math.round(m);
    const h = Math.floor(m / 60), r = m % 60;
    return h ? `${h}h ${String(r).padStart(2, '0')}m` : `${r}m`;
  };
  const int = (v) => Math.round(v).toLocaleString('en-US');

  /* Health metrics. better: 1 = higher is better, -1 = lower is better */
  const METRICS = [
    { k: 'sleep', label: 'Sleep', icon: 'moon', color: '#64D2FF', better: 1, fmt: hm, axis: (v) => `${(v / 60).toFixed(1)}h`, lo: 0, hi: 1080, chart: 'bars', chartMax: 600, hint: 'Time asleep last night' },
    { k: 'sleepScore', label: 'Sleep score', icon: 'sparkles', color: '#7D7AFF', better: 1, fmt: int, lo: 0, hi: 100, chart: 'line', hint: '0–100' },
    { k: 'stress', label: 'Stress', icon: 'waves', color: '#FF9F0A', better: -1, fmt: int, lo: 0, hi: 100, chart: 'line', hint: 'Daily average, 0–100' },
    { k: 'bb', label: 'Body Battery', short: 'Battery', icon: 'battery', color: '#30D158', better: 1, fmt: int, lo: 0, hi: 100, chart: 'bars', chartMax: 100, hint: 'Morning / highest value' },
    { k: 'rhr', label: 'Resting HR', short: 'Rest HR', icon: 'heart', color: '#FF375F', better: -1, fmt: int, unit: ' bpm', lo: 25, hi: 150, chart: 'line', hint: 'Beats per minute' },
    { k: 'hrv', label: 'HRV', icon: 'pulse', color: '#BF5AF2', better: 1, fmt: int, unit: ' ms', lo: 5, hi: 300, chart: 'line', hint: 'Overnight average' },
    { k: 'steps', label: 'Steps', icon: 'steps', color: '#FF6B3D', better: 1, fmt: int, lo: 0, hi: 150000, chart: 'bars', hint: 'Total for the day' },
    // Sleep stages you can compare against productivity (not shown as tiles)
    { k: 'deep', label: 'Deep sleep', icon: 'moon', color: '#4C6EF0', better: 1, fmt: hm, axis: (v) => `${(v / 60).toFixed(1)}h`, lo: 0, hi: 1080, extra: true, hint: 'Deep sleep last night' },
    { k: 'rem', label: 'REM sleep', icon: 'moon', color: '#A55FE3', better: 1, fmt: hm, axis: (v) => `${(v / 60).toFixed(1)}h`, lo: 0, hi: 1080, extra: true, hint: 'REM sleep last night' },
  ];
  const MAIN = METRICS.filter((m) => !m.extra);

  /* Sleep stages, stacked bottom → top. Colors validated for the dark surface (lightness band, CVD, contrast). */
  const STAGES = [
    { k: 'deep', label: 'Deep', color: '#4C6EF0' },
    { k: 'light', label: 'Light', color: '#1E9FB0' },
    { k: 'rem', label: 'REM', color: '#A55FE3' },
    { k: 'awake', label: 'Awake', color: '#E0608E' },
  ];

  /* Productivity measures from the rest of Ember */
  const PROD = [
    { k: 'focus', label: 'Focus time', unit: 'min', fmt: (v) => `${Math.round(v)} min`, axis: (v) => `${Math.round(v)}`, lo: 0 },
    { k: 'tasks', label: 'Tasks done', unit: 'tasks', fmt: (v) => v.toFixed(1), axis: (v) => `${Math.round(v * 10) / 10}`, lo: 0 },
    { k: 'habits', label: 'Habits done', unit: '%', fmt: (v) => `${Math.round(v)}%`, axis: (v) => `${Math.round(v)}%`, lo: 0, hi: 100 },
    { k: 'mood', label: 'Mood', unit: '1–5', fmt: (v) => v.toFixed(1), axis: (v) => `${Math.round(v * 10) / 10}`, lo: 1, hi: 5 },
  ];

  const H = (E.health = {
    METRICS, PROD, STAGES, hm,
    metric: (k) => METRICS.find((m) => m.k === k),
    prod: (k) => PROD.find((m) => m.k === k),
    fmt: (m, v) => (v == null ? '—' : m.fmt(v) + (m.unit || '')),
    val(k, mk) {
      const d = E.db().health[k], v = d && d[mk];
      return typeof v === 'number' && isFinite(v) ? v : null;
    },
    keys: () => Object.keys(E.db().health).sort(),
    latestKey() {
      const ks = H.keys();
      return ks.length ? ks[ks.length - 1] : null;
    },
    avg(mk, endKey, days) {
      let s = 0, n = 0;
      for (let i = 0; i < days; i++) {
        const v = H.val(E.addDays(endKey, -i), mk);
        if (v != null) { s += v; n++; }
      }
      return n ? s / n : null;
    },

    /** One pass over the other sections: per-day focus, tasks, habit %, mood and whether Ember was used that day. */
    prodTable(days = 120) {
      const s = E.db(), T = E.today();
      const t = {};
      for (let i = 0; i < days; i++) t[E.addDays(T, -i)] = { focus: 0, tasks: 0, habits: null, mood: null, active: false };
      s.focus.sessions.forEach((x) => {
        const d = t[E.dkey(new Date(x.start))];
        if (d) { d.focus += x.minutes; d.active = true; }
      });
      s.tasks.forEach((x) => {
        if (!x.done || !x.doneAt) return;
        const d = t[E.dkey(new Date(x.doneAt))];
        if (d) { d.tasks++; d.active = true; }
      });
      const habits = E.habit.active();
      Object.keys(t).forEach((k) => {
        const d = t[k];
        const due = habits.filter((h) => E.habit.start(h) <= k && E.habit.isDue(h, k));
        if (due.length) {
          const done = due.filter((h) => E.habit.done(h, k)).length;
          if (k !== T || done) d.habits = (done / due.length) * 100;
        }
        if (habits.some((h) => h.log[k])) d.active = true;
        const m = E.journal.moodOn(k);
        if (m) { d.mood = m; d.active = true; }
        if (E.journal.forDay(k).length) d.active = true;
      });
      // Zero focus or tasks only counts on days you used Ember, and only since you started using that feature
      const first = (list) => list.reduce((a, k) => (!a || k < a ? k : a), null);
      const firstFocus = first(s.focus.sessions.map((x) => E.dkey(new Date(x.start))));
      const firstTask = first(s.tasks.filter((x) => x.done && x.doneAt).map((x) => E.dkey(new Date(x.doneAt))));
      Object.entries(t).forEach(([k, d]) => {
        if (!d.active || !firstFocus || k < firstFocus) d.focus = null;
        if (!d.active || !firstTask || k < firstTask) d.tasks = null;
      });
      return t;
    },

    pairs(hk, pk, table) {
      const out = [], T = E.today();
      Object.keys(table).forEach((k) => {
        if (k === T && (hk === 'stress' || hk === 'steps')) return; // today isn't finished yet
        const x = H.val(k, hk), y = table[k][pk];
        if (x != null && y != null) out.push({ k, x, y });
      });
      return out;
    },

    pearson(ps) {
      const n = ps.length;
      if (n < 3) return 0;
      const mx = ps.reduce((a, p) => a + p.x, 0) / n, my = ps.reduce((a, p) => a + p.y, 0) / n;
      let sxy = 0, sxx = 0, syy = 0;
      ps.forEach((p) => {
        sxy += (p.x - mx) * (p.y - my);
        sxx += (p.x - mx) ** 2;
        syy += (p.y - my) ** 2;
      });
      return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
    },

    /** Split the days at the median of the health metric and compare the productivity averages. */
    compare(hk, pk, table) {
      const ps = H.pairs(hk, pk, table);
      if (ps.length < 6) return { n: ps.length, ps };
      const xs = ps.map((p) => p.x).sort((a, b) => a - b);
      const med = xs[Math.floor(xs.length / 2)];
      const hi = ps.filter((p) => p.x >= med), lo = ps.filter((p) => p.x < med);
      if (!hi.length || !lo.length) return { n: ps.length, ps };
      const avg = (a) => a.reduce((s, p) => s + p.y, 0) / a.length;
      return { n: ps.length, ps, r: H.pearson(ps), med, hiAvg: avg(hi), loAvg: avg(lo), hiN: hi.length, loN: lo.length };
    },

    strength(r) {
      const a = Math.abs(r || 0);
      return a >= 0.5 ? 'Strong link' : a >= 0.3 ? 'Clear link' : a >= 0.15 ? 'Weak link' : 'No clear link';
    },

    sentence(hk, pk, c) {
      const cond = {
        sleep: (v) => `after nights with at least <b>${hm(v)}</b> of sleep`,
        sleepScore: (v) => `after a sleep score of <b>${Math.round(v)}+</b>`,
        stress: (v) => `on days when your stress is <b>${Math.round(v)}+</b>`,
        bb: (v) => `when your Body Battery starts at <b>${Math.round(v)}+</b>`,
        rhr: (v) => `when your resting heart rate is <b>${Math.round(v)}+ bpm</b>`,
        hrv: (v) => `when your HRV is <b>${Math.round(v)}+ ms</b>`,
        steps: (v) => `on days with <b>${int(v)}+</b> steps`,
        deep: (v) => `after nights with at least <b>${hm(v)}</b> of deep sleep`,
        rem: (v) => `after nights with at least <b>${hm(v)}</b> of REM sleep`,
      }[hk](c.med);
      const hi = c.hiAvg, lo = c.loAvg, up = hi >= lo;
      const rel = lo > 0 ? `${Math.round((Math.abs(hi - lo) / lo) * 100)}% ` : '';
      const out = {
        focus: `you focus <b>${rel}${up ? 'more' : 'less'}</b> (${Math.round(hi)} vs ${Math.round(lo)} min a day)`,
        tasks: `you finish <b>${rel}${up ? 'more' : 'fewer'} tasks</b> (${hi.toFixed(1)} vs ${lo.toFixed(1)} a day)`,
        habits: `you complete <b>${Math.round(hi)}%</b> of your habits vs ${Math.round(lo)}% otherwise`,
        mood: `your mood averages <b>${hi.toFixed(1)}</b> vs ${lo.toFixed(1)} otherwise`,
      }[pk];
      const s = `${cond}, ${out}.`;
      return s.charAt(0).toUpperCase() + s.slice(1);
    },

    /** Strongest relationships across every health × productivity pair. */
    insights(limit = 5, table = H.prodTable()) {
      const found = [];
      METRICS.forEach((m) =>
        PROD.forEach((p) => {
          const c = H.compare(m.k, p.k, table);
          if (c.r == null || c.n < 8 || Math.abs(c.r) < 0.25) return;
          if (Math.abs(c.hiAvg - c.loAvg) < (p.k === 'mood' ? 0.2 : p.k === 'habits' ? 5 : p.k === 'tasks' ? 0.3 : 5)) return;
          found.push({ m, p, c, text: H.sentence(m.k, p.k, c) });
        })
      );
      // Keep only the best finding per productivity measure first, then the rest
      found.sort((a, b) => Math.abs(b.c.r) - Math.abs(a.c.r));
      const seen = new Set(), first = [], rest = [];
      found.forEach((f) => (seen.has(f.p.k) ? rest : (seen.add(f.p.k), first)).push(f));
      return first.concat(rest).slice(0, limit);
    },

    /* ----- import ----- */
    clean(v) {
      const out = {};
      if (!v || typeof v !== 'object') return out;
      const fields = METRICS.concat(STAGES.filter((s) => !H.metric(s.k)).map((s) => ({ k: s.k, lo: 0, hi: 1080 })));
      fields.forEach((m) => {
        const n = typeof v[m.k] === 'string' ? parseFloat(v[m.k].replace(',', '.')) : v[m.k];
        if (typeof n === 'number' && isFinite(n) && n >= m.lo && n <= m.hi) out[m.k] = Math.round(n);
      });
      return out;
    },

    parseCsv(text) {
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) return null;
      const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
      const ALIAS = {
        date: 'date', day: 'date', calendardate: 'date', datum: 'date',
        sleep: 'sleep', sleepminutes: 'sleep', sleepmin: 'sleep', sleepmins: 'sleep', sleeptime: 'sleep', sleephours: 'sleepH', sleeph: 'sleepH',
        sleepscore: 'sleepScore', score: 'sleepScore',
        stress: 'stress', avgstress: 'stress', averagestress: 'stress', stresslevel: 'stress',
        bodybattery: 'bb', bb: 'bb', bodybatteryhigh: 'bb',
        restinghr: 'rhr', rhr: 'rhr', restingheartrate: 'rhr',
        hrv: 'hrv', overnighthrv: 'hrv', hrvms: 'hrv',
        steps: 'steps', totalsteps: 'steps',
      };
      const cols = lines[0].split(sep).map((h) => ALIAS[h.trim().replace(/^"|"$/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')] || null);
      if (!cols.includes('date')) return null;
      const days = {};
      lines.slice(1).forEach((line) => {
        const cells = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
        const raw = cells[cols.indexOf('date')] || '';
        let m, k = null;
        if ((m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) k = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        else if ((m = raw.match(/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})/))) k = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        if (!k) return;
        const d = {};
        cols.forEach((c, i) => {
          if (!c || c === 'date' || cells[i] == null || cells[i] === '') return;
          const n = parseFloat(sep === ';' ? cells[i].replace(',', '.') : cells[i]);
          if (!isFinite(n)) return;
          if (c === 'sleepH') d.sleep = n * 60;
          else d[c] = n;
        });
        days[k] = d;
      });
      return days;
    },

    importText(text) {
      let days = null;
      const t = text.trim().replace(/^﻿/, '');
      if (t.startsWith('{')) {
        let o;
        try {
          o = JSON.parse(t);
        } catch (e) {
          throw new Error('That file is not valid JSON.');
        }
        if (o.days && typeof o.days === 'object') days = o.days;
        else if (o.health && o.settings) days = o.health;
      } else days = H.parseCsv(t);
      if (!days) throw new Error("That file doesn't contain health data Ember understands.");
      let n = 0;
      E.commit((s) => {
        Object.entries(days).forEach(([k, v]) => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
          const c = H.clean(v);
          if (!Object.keys(c).length) return;
          s.health[k] = { ...(s.health[k] || {}), ...c, src: 'garmin', at: Date.now() };
          n++;
        });
        s.settings.healthImportedAt = Date.now();
      });
      return n;
    },

    pickFile() {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.json,.csv,application/json,text/csv,text/plain';
      inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.addEventListener('change', () => {
        const f = inp.files[0];
        inp.remove();
        if (!f) return;
        f.text().then((txt) => {
          try {
            const n = H.importText(txt);
            ui.toast(n ? `Imported ${E.plural(n, 'day')} of health data` : 'No new days found in that file', n ? 'watch' : 'info');
          } catch (err) {
            ui.toast(err.message, 'info');
          }
        });
      });
      inp.click();
    },

    /* ----- manual log ----- */
    logSheet(key) {
      let k = key || E.today();
      let d = { ...(E.db().health[k] || {}) };
      const inp = (m) => {
        if (m.k === 'sleep') {
          const v = d.sleep;
          return `<div class="form-row"><span class="form-row-title">${E.icon(m.icon, 16)} ${m.label}</span>
            <span class="hm-inputs"><input class="row-input sm" type="number" inputmode="numeric" min="0" max="18" data-m="sleepH" value="${v != null ? Math.floor(v / 60) : ''}" placeholder="–" aria-label="Sleep hours">h
            <input class="row-input sm" type="number" inputmode="numeric" min="0" max="59" data-m="sleepM" value="${v != null ? Math.round(v % 60) : ''}" placeholder="–" aria-label="Sleep minutes">m</span></div>`;
        }
        return `<div class="form-row"><div><div class="form-row-title">${E.icon(m.icon, 16)} ${m.label}</div><div class="form-row-sub">${m.hint}</div></div>
          <input class="row-input" type="number" inputmode="numeric" min="${m.lo}" max="${m.hi}" data-m="${m.k}" value="${d[m.k] != null ? d[m.k] : ''}" placeholder="–" aria-label="${m.label}"></div>`;
      };
      const body = () => `
        <div class="form-group list-group-inset">
          <div class="form-row"><span class="form-row-title">${E.icon('calendar', 16)} Day</span><input type="date" class="field-date" data-m="date" value="${k}" max="${E.today()}"></div>
        </div>
        <div class="form-note">Copy the numbers from the Garmin Connect app. Leave anything blank you don't track. Sleep belongs to the day you woke up.</div>
        <div class="form-group list-group-inset">${MAIN.map(inp).join('')}</div>
        ${E.db().health[k] ? `<button class="btn btn-danger wide" data-act="del">${E.icon('trash', 16)}Delete this day</button>` : ''}`;
      const read = (api) => {
        const out = {};
        let sh = null, sm = null;
        api.$$('[data-m]').forEach((el) => {
          const f = el.dataset.m;
          if (f === 'date') return;
          const v = el.value.trim() === '' ? null : parseFloat(el.value.replace(',', '.'));
          if (f === 'sleepH') sh = v;
          else if (f === 'sleepM') sm = v;
          else if (v != null) out[f] = v;
        });
        if (sh != null || sm != null) out.sleep = (sh || 0) * 60 + (sm || 0);
        return out;
      };
      ui.sheet({
        title: 'Log Health',
        size: 'sm',
        done: 'Save',
        body: body(),
        onChange(el, e, api) {
          if (el.dataset.m === 'date' && el.value) {
            k = el.value;
            d = { ...(E.db().health[k] || {}) };
            api.setBody(body());
          }
        },
        actions: {
          async del(el, e, api) {
            const ok = await ui.confirm({ title: 'Delete this day?', message: `Health data for ${E.fmtLong(k)} will be removed.`, ok: 'Delete', destructive: true });
            if (!ok) return;
            api.close();
            E.commit((s) => delete s.health[k]);
            ui.toast('Day deleted', 'trash');
          },
        },
        onDone(api) {
          const raw = read(api), c = H.clean(raw);
          const rejected = Object.keys(raw).filter((x) => !(x in c));
          if (rejected.length) {
            ui.toast(`Check ${rejected.map((x) => H.metric(x).label).join(', ')} — out of range`, 'info');
            return false;
          }
          E.commit((s) => {
            // Replace the fields shown in this sheet; keep the rest (e.g. Garmin sleep stages)
            const day = { ...(s.health[k] || {}) };
            MAIN.forEach((m) => delete day[m.k]);
            Object.assign(day, c);
            const hasData = [...MAIN, ...STAGES].some((m) => day[m.k] != null);
            if (!hasData) delete s.health[k];
            else s.health[k] = { ...day, src: 'manual', at: Date.now() };
          });
          ui.toast('Health data saved', 'health');
        },
      });
    },

    helpSheet() {
      ui.sheet({
        title: 'Sync with Garmin',
        size: 'md',
        hideDone: true,
        cancel: 'Close',
        body: `
          <p class="help-lead">Garmin doesn't offer a public connection for personal apps, so there are two ways to get your watch data into Ember:</p>
          <div class="help-step"><span class="help-n">1</span><div><b>Log by hand (any device)</b>
            <p>Each morning open Garmin Connect and type sleep, stress, Body Battery and so on into <b>Log</b>. It takes about 20 seconds.</p></div></div>
          <div class="help-step"><span class="help-n">2</span><div><b>Automatic download (Windows PC)</b>
            <p>A small script in your Ember folder signs in to <i>your</i> Garmin Connect account and downloads up to a year of history in one go.</p>
            <ol>
              <li>Install Python once: <code>winget install Python.Python.3.12</code></li>
              <li>Double-click <code>sync-garmin.cmd</code> in the Ember folder. The first time, sign in with your Garmin email and password in that window. They go only to Garmin, and the login is remembered on your PC.</li>
              <li>It saves <code>garmin-export\\ember-health-latest.json</code>. Import that file here.</li>
              <li>For your iPhone: double-click <code>sync-garmin-to-onedrive.cmd</code> instead. It also puts a copy in <b>OneDrive › Ember</b>, which you can import from the Files app (with the OneDrive app installed).</li>
            </ol>
            <p class="muted small">This uses Garmin's unofficial connection, so it could stop working if Garmin changes things.</p></div></div>
          <div class="help-actions">
            <button class="btn btn-primary" data-act="import">${E.icon('upload', 16)}Import file</button>
            <button class="btn btn-tinted" data-act="log">${E.icon('edit', 16)}Log by hand</button>
          </div>`,
        actions: {
          import(el, e, api) { api.close(); H.pickFile(); },
          log(el, e, api) { api.close(); setTimeout(() => H.logSheet(), 250); },
        },
      });
    },
  });

  /* ----- scatter plot (one series, trend line, hover tooltips) ----- */
  function scatter(ps, m, p) {
    const xs = ps.map((q) => q.x), ys = ps.map((q) => q.y);
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const px = (x1 - x0) * 0.08 || 1, py = (y1 - y0) * 0.12 || 1;
    x0 -= px; x1 += px;
    y0 = p.lo != null ? Math.max(p.lo, y0 - py) : y0 - py;
    y1 = p.hi != null ? Math.min(p.hi, y1 + py) : y1 + py;
    if (y1 <= y0) y1 = y0 + 1;
    const X = (v) => ((v - x0) / (x1 - x0)) * 100, Y = (v) => 100 - ((v - y0) / (y1 - y0)) * 100;
    const n = ps.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0, sxx = 0;
    ps.forEach((q) => { sxy += (q.x - mx) * (q.y - my); sxx += (q.x - mx) ** 2; });
    const slope = sxx ? sxy / sxx : 0, b = my - slope * mx;
    const yt = [y0, (y0 + y1) / 2, y1], xt = [x0 + px, (x0 + x1) / 2, x1 - px];
    const xf = m.axis || ((v) => m.fmt(v));
    return `<div class="scatter">
      <div class="sc-ylabel">↑ ${esc(p.label)} (${esc(p.unit)})</div>
      <div class="sc-y">${yt.map((v) => `<span style="top:${Y(v)}%">${p.axis(v)}</span>`).join('')}</div>
      <div class="sc-plot">
        ${yt.map((v) => `<div class="gl" style="top:${Y(v)}%"></div>`).join('')}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="${Y(slope * x0 + b)}" x2="100" y2="${Y(slope * x1 + b)}" stroke="var(--text-2)" stroke-width="1.5" stroke-dasharray="5 5" vector-effect="non-scaling-stroke"/></svg>
        ${ps.map((q) => `<div class="sc-dot" style="left:${X(q.x)}%;top:${Y(q.y)}%" data-tip="${esc(`${E.fmt(q.k, { weekday: 'short', month: 'short', day: 'numeric' })} · ${m.label} ${H.fmt(m, q.x)} · ${p.label} ${p.fmt(q.y)}`)}"></div>`).join('')}
      </div>
      <div class="sc-x">${xt.map((v, i) => `<span style="left:${X(v)}%" class="${i === 0 ? 'first' : i === 2 ? 'last' : ''}">${xf(v)}</span>`).join('')}</div>
      <div class="sc-xlabel">${esc(m.label)}${m.unit ? ` (${m.unit.trim()})` : ''} →</div>
    </div>`;
  }

  /* ----- trend chart for one metric, last 30 days ----- */
  function trend(m) {
    const T = E.today();
    const pts = Array.from({ length: 30 }, (_, i) => {
      const k = E.addDays(T, i - 29), v = H.val(k, m.k);
      return { k, label: E.fmt(k, { month: 'short', day: 'numeric' }), value: v, tip: `${E.fmt(k, { weekday: 'short', month: 'short', day: 'numeric' })}: ${H.fmt(m, v)}`, hi: k === T };
    });
    const vals = pts.map((q) => q.value).filter((v) => v != null);
    if (!vals.length) return `<div class="card-empty">No ${m.label.toLowerCase()} data in the last 30 days.</div>`;
    if (m.chart === 'bars')
      return E.chart.bars(pts.map((q) => ({ ...q, value: q.value || 0, label: E.parse(q.k).getDate() % 5 === 0 || q.hi ? String(E.parse(q.k).getDate()) : '' })), { height: 150, max: m.chartMax, fmt: (v) => (m.k === 'sleep' ? `${Math.round(v / 60)}h` : m.k === 'steps' ? `${Math.round(v / 1000)}k` : Math.round(v)), color: m.color });
    let lo = Math.min(...vals), hi = Math.max(...vals);
    const pad = Math.max(2, (hi - lo) * 0.2);
    lo = Math.max(m.lo, Math.floor(lo - pad));
    hi = Math.min(m.hi, Math.ceil(hi + pad));
    const mid = Math.round((lo + hi) / 2);
    return E.chart.line(pts, { height: 150, min: lo, max: hi, yLabels: [lo, mid, hi].map((v) => ({ v, label: `<small>${v}</small>` })), color: m.color, every: 7 });
  }

  /* ----- sleep stages ----- */
  const hasStages = (d) => !!d && STAGES.some((st) => typeof d[st.k] === 'number');

  /** Last night as one horizontal bar split into stages, with a legend that also labels the 30-day chart. */
  function lastNight(k) {
    const d = E.db().health[k];
    const parts = STAGES.map((st) => ({ ...st, v: d[st.k] || 0 }));
    const total = parts.reduce((a, p) => a + p.v, 0) || 1;
    const pct = (v) => Math.round((v / total) * 100);
    return `<div class="ln">
      <div class="ln-head"><span>${k === E.today() ? 'Last night' : `Night before ${E.relDay(k).toLowerCase()}`}</span>
        <span><b>${hm(d.sleep != null ? d.sleep : total - (d.awake || 0))}</b> asleep${d.sleepScore ? ` · score <b>${d.sleepScore}</b>` : ''}</span></div>
      <div class="ln-bar" role="img" aria-label="${esc(parts.map((p) => `${p.label} ${hm(p.v)}`).join(', '))}">${parts
        .filter((p) => p.v > 0)
        .map((p) => `<i style="flex:${p.v} 0 0;background:${p.color}" data-tip="${p.label}: ${hm(p.v)} (${pct(p.v)}%)"></i>`)
        .join('')}</div>
      <div class="ln-legend">${parts
        .map((p) => `<div class="ln-item"><span class="sw" style="background:${p.color}"></span><span class="ln-lbl">${p.label}</span><b>${hm(p.v)}</b><span class="ln-pct">${pct(p.v)}%</span></div>`)
        .join('')}</div>
    </div>`;
  }

  /** 30 nights as stacked bars (deep at the bottom, awake on top). Nights without stages show as one neutral bar. */
  function stageBars(days) {
    const s = E.db().health, T = E.today();
    const totals = days.map((k) => {
      const d = s[k];
      return d ? Math.max(STAGES.reduce((a, x) => a + (d[x.k] || 0), 0), d.sleep || 0) : 0;
    });
    const maxH = Math.max(10, Math.ceil(Math.max(...totals) / 60));
    const grid = [1, 0.5, 0].map((f) => `<div class="gl" style="bottom:${f * 100}%"><span>${Math.round(maxH * f)}h</span></div>`).join('');
    const cols = days
      .map((k, i) => {
        const d = s[k], n = E.parse(k).getDate();
        const lbl = n % 5 === 0 || k === T ? String(n) : '';
        if (!totals[i]) return `<div class="bar-col"><div class="bar-track"></div><span class="bar-lbl">${lbl}</span></div>`;
        const staged = hasStages(d);
        const segs = staged
          ? STAGES.slice().reverse().filter((x) => d[x.k] > 0).map((x) => `<i style="flex:${d[x.k]} 0 0;background:${x.color}"></i>`).join('')
          : '<i class="nostage"></i>';
        const tip = `${E.fmt(k, { weekday: 'short', month: 'short', day: 'numeric' })}: ${hm(d.sleep || totals[i])} asleep${staged ? ' · ' + STAGES.map((x) => `${x.label} ${hm(d[x.k] || 0)}`).join(' · ') : ''}`;
        return `<div class="bar-col ${k === T ? 'hi' : ''}" data-tip="${esc(tip)}" tabindex="0">
          <div class="bar-track"><div class="stack" style="height:${Math.min(100, (totals[i] / (maxH * 60)) * 100).toFixed(1)}%">${segs}</div></div>
          <span class="bar-lbl">${lbl}</span></div>`;
      })
      .join('');
    return `<div class="bars dense stacked" style="--h:160px"><div class="bars-grid">${grid}</div><div class="bars-cols">${cols}</div></div>`;
  }

  function sleepCard(avg30) {
    const T = E.today(), s = E.db().health;
    let lnKey = null;
    for (let i = 0; i < 3 && !lnKey; i++) if (hasStages(s[E.addDays(T, -i)])) lnKey = E.addDays(T, -i);
    const days = Array.from({ length: 30 }, (_, i) => E.addDays(T, i - 29));
    const anyStages = days.some((k) => hasStages(s[k]));
    return `<section class="card sleep-card">
      <header class="card-head"><h2>${E.icon('moon', 18)}Sleep · 30 days</h2>${avg30 != null ? `<span class="muted small">Avg ${hm(avg30)}</span>` : ''}</header>
      ${lnKey ? lastNight(lnKey) : ''}
      ${anyStages ? stageBars(days) : trend(H.metric('sleep'))}
      ${anyStages && !lnKey ? `<div class="stage-legend">${STAGES.map((x) => `<span><i style="background:${x.color}"></i>${x.label}</span>`).join('')}</div>` : ''}
      <div class="chart-note">${anyStages ? 'Each bar is one night split into sleep stages. Hover or tap a bar for the details.' : 'Time asleep per night. Sleep stages appear after a Garmin import.'}</div>
    </section>`;
  }

  /* ----- page ----- */
  const V = (E.views.health = {
    title: 'Health',
    st: { metric: 'sleep', x: 'sleep', y: 'focus' },

    render() {
      const s = E.db();
      const has = Object.keys(s.health).length > 0;
      const imported = s.settings.healthImportedAt;
      const head = `<header class="page-head">
        <div><h1 class="large-title">Health</h1>
          <div class="subtitle">${has ? (imported ? `Garmin data imported ${E.timeAgo(imported)}` : 'Sleep, stress and energy next to your productivity') : 'Sleep, stress and energy next to your productivity'}</div></div>
        <div class="head-actions">
          <button class="icon-btn" data-act="help" data-tip="Sync with Garmin" aria-label="Sync with Garmin">${E.icon('watch', 19)}</button>
          <button class="btn btn-primary" data-act="new">${E.icon('plus', 17)}<span>Log</span></button>
        </div>
      </header>`;

      if (!has)
        return `<div class="page page-health">${head}
          <section class="card">${ui.empty({ icon: 'health', title: 'Connect your body to your day', text: 'Add sleep, stress, Body Battery, resting heart rate, HRV and steps from your Garmin. Ember then shows how they relate to your focus, tasks, habits and mood.' })}
            <div class="help-actions center">
              <button class="btn btn-primary" data-act="help">${E.icon('watch', 16)}Sync with Garmin</button>
              <button class="btn btn-tinted" data-act="new">${E.icon('edit', 16)}Log today by hand</button>
            </div>
          </section></div>`;

      const ref = H.latestKey();
      const table = H.prodTable();
      const m = H.metric(this.st.metric), xm = H.metric(this.st.x), pm = H.prod(this.st.y);
      const cmp = H.compare(xm.k, pm.k, table);
      const found = H.insights(5, table);
      const T = E.today();

      const tiles = MAIN.map((mt) => {
        const v = H.val(ref, mt.k);
        const base = H.avg(mt.k, E.addDays(ref, -1), 7);
        let delta = '';
        if (v != null && base != null) {
          const diff = v - base, tiny = mt.k === 'sleep' ? 10 : mt.k === 'steps' ? 300 : 1.5;
          if (Math.abs(diff) < tiny) delta = `<span class="delta">≈ usual</span>`;
          else {
            const good = diff * mt.better > 0;
            const amt = mt.k === 'sleep' ? hm(Math.abs(diff)) : mt.k === 'steps' ? int(Math.abs(diff)) : Math.round(Math.abs(diff));
            delta = `<span class="delta ${good ? 'good' : 'bad'}">${diff > 0 ? '▲' : '▼'} ${amt} vs 7-day avg</span>`;
          }
        }
        return `<button class="h-tile ${this.st.metric === mt.k ? 'on' : ''}" data-act="metric" data-value="${mt.k}" style="--c:${mt.color}">
          <span class="h-tile-top"><span class="h-ic">${E.icon(mt.icon, 15)}</span>${mt.label}</span>
          <span class="h-val">${v == null ? '—' : mt.fmt(v)}<small>${v == null ? '' : mt.unit || ''}</small></span>
          ${delta || `<span class="delta">${v == null ? 'Not logged' : '&nbsp;'}</span>`}
        </button>`;
      }).join('');

      const vals30 = Array.from({ length: 30 }, (_, i) => H.val(E.addDays(T, -i), m.k)).filter((v) => v != null);
      const avg30 = vals30.length ? vals30.reduce((a, b) => a + b, 0) / vals30.length : null;

      const recent = Array.from({ length: 14 }, (_, i) => E.addDays(T, -i)).filter((k) => s.health[k]);

      return `<div class="page page-health">${head}
        <div class="h-ref">${ref === T ? 'Today' : `Latest: ${E.relDay(ref)}`} · compared with your previous 7 days</div>
        <div class="h-tiles">${tiles}</div>

        <div class="cols-2">
          ${
            m.k === 'sleep'
              ? sleepCard(avg30)
              : `<section class="card">
            <header class="card-head"><h2>${E.icon(m.icon, 18)}${m.label} · 30 days</h2>${avg30 != null ? `<span class="muted small">Avg ${H.fmt(m, avg30)}</span>` : ''}</header>
            ${trend(m)}
            <div class="chart-note">${esc(m.hint)}. Tap a tile above to switch metric.</div>
          </section>`
          }

          <section class="card">
            <header class="card-head"><h2>${E.icon('scatter', 18)}Compare</h2>${cmp.r != null ? `<span class="strength s${Math.min(3, Math.floor(Math.abs(cmp.r) / 0.15))}">${H.strength(cmp.r)}</span>` : ''}</header>
            <div class="cmp-pickers">
              <div class="pick"><span id="pick-x">Health</span><button class="pick-btn" data-act="pick" data-which="x" aria-haspopup="menu" aria-labelledby="pick-x pick-x-val"><span id="pick-x-val">${xm.label}</span>${E.icon('down', 15)}</button></div>
              <span class="vs">vs</span>
              <div class="pick"><span id="pick-y">Productivity</span><button class="pick-btn" data-act="pick" data-which="y" aria-haspopup="menu" aria-labelledby="pick-y pick-y-val"><span id="pick-y-val">${pm.label}</span>${E.icon('down', 15)}</button></div>
            </div>
            ${
              cmp.n >= 3
                ? `${scatter(cmp.ps, xm, pm)}
                   <p class="cmp-text">${cmp.r != null ? H.sentence(xm.k, pm.k, cmp) : 'Not enough variety in the data yet to compare.'}</p>
                   <div class="chart-note">Each dot is one day · ${E.plural(cmp.n, 'day')} with both values${cmp.r != null ? ` · correlation r = ${cmp.r.toFixed(2)}` : ''}</div>`
                : `<div class="card-empty">Need at least 3 days with both ${xm.label.toLowerCase()} and ${pm.label.toLowerCase()}. ${pm.k === 'mood' ? 'Log your mood in the journal.' : pm.k === 'habits' ? 'Check off your habits.' : pm.k === 'focus' ? 'Use the focus timer.' : 'Complete some tasks.'}</div>`
            }
          </section>
        </div>

        <section class="card h-insights">
          <header class="card-head"><h2>${E.icon('sparkles', 18)}What seems to affect you</h2></header>
          ${
            found.length
              ? `<ul class="obs">${found.map((f) => `<li><span class="obs-tag" style="--c:${f.m.color}">${f.m.label} × ${f.p.label}</span>${f.text}</li>`).join('')}</ul>
                 <div class="chart-note">Patterns, not proof: two things moving together doesn't mean one causes the other. They get more reliable the longer you track.</div>`
              : `<div class="card-empty">Keep going. Once you have about a week of health data <i>and</i> activity in Ember (focus sessions, tasks, habits or mood), the clearest patterns show up here.</div>`
          }
        </section>

        <section class="card">
          <header class="card-head"><h2>${E.icon('list', 18)}Recent days</h2><button class="btn btn-plain sm" data-act="import">${E.icon('upload', 14)}Import file</button></header>
          ${
            recent.length
              ? `<div class="h-table-wrap"><table class="h-table">
                  <thead><tr><th>Day</th>${MAIN.map((x) => `<th>${x.label}</th>`).join('')}</tr></thead>
                  <tbody>${recent
                    .map((k) => `<tr data-act="edit" data-date="${k}" tabindex="0"><td>${E.relDay(k)}${s.health[k].src === 'manual' ? ' <span class="src">manual</span>' : ''}</td>${MAIN.map((x) => `<td>${H.val(k, x.k) == null ? '<span class="muted">—</span>' : x.fmt(H.val(k, x.k))}</td>`).join('')}</tr>`)
                    .join('')}</tbody></table></div>`
              : `<div class="card-empty">Nothing in the last 14 days.</div>`
          }
        </section>
      </div>`;
    },

    actions: {
      new: () => H.logSheet(),
      help: () => H.helpSheet(),
      import: () => H.pickFile(),
      edit: (el) => H.logSheet(el.dataset.date),
      metric(el) {
        V.st.metric = el.dataset.value;
        V.st.x = el.dataset.value;
        E.app.render();
      },
      pick(el) {
        const which = el.dataset.which, list = which === 'x' ? METRICS : PROD;
        ui.menu(
          el,
          list.map((o) => ({
            label: o.label,
            checked: o.k === V.st[which],
            onClick: () => {
              V.st[which] = o.k;
              E.app.focusAfter(`.pick-btn[data-which="${which}"]`);
              E.app.render();
            },
          })),
          { align: 'left' }
        );
      },
    },

    onKey(el, e) {
      if (e.key === 'Enter' && el.dataset.act === 'edit') H.logSheet(el.dataset.date);
    },
  });
})();
