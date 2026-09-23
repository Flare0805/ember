/* Ember — Focus timer page */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;
  const F = E.focus;

  const V = (E.views.focus = {
    title: 'Focus',

    render() {
      const t = F.t(), s = E.db(), cfg = s.settings.focus, T = E.today();
      const left = F.left(), total = F.duration(t.mode) || 1;
      const size = 300, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
      const todayMin = E.focusStats.minutesOn(T);
      const todayN = E.focusStats.sessionsOn(T).length;
      const inCycle = (t.cycle || 0) % cfg.every;
      const status = t.running ? `Ends at ${E.fmtTime(t.endAt)}` : t.startedAt ? 'Paused' : 'Ready';

      const week = Array.from({ length: 7 }, (_, i) => {
        const k = E.addDays(T, i - 6);
        const m = E.focusStats.minutesOn(k);
        return { label: E.DAY_SHORT[E.dow(k)].slice(0, 2), value: m, tip: `${E.fmt(k, { weekday: 'short', month: 'short', day: 'numeric' })}: ${E.fmtMin(m)}`, hi: k === T };
      });
      const weekTotal = week.reduce((a, d) => a + d.value, 0);
      const recent = s.focus.sessions.slice().sort((a, b) => b.start - a.start).slice(0, 8);

      return `<div class="page page-focus">
        <header class="page-head">
          <div><h1 class="large-title">Focus</h1><div class="subtitle">${E.fmtMin(todayMin)} focused today · ${E.plural(todayN, 'session')}</div></div>
          <div class="head-actions"><button class="icon-btn" data-act="settings" data-tip="Timer settings" aria-label="Timer settings">${E.icon('settings', 19)}</button></div>
        </header>
        <div class="focus-layout">
          <section class="card focus-main mode-${t.mode}">
            ${ui.seg('mode', Object.entries(F.MODES).map(([value, label]) => ({ value, label })), t.mode, 'focus-seg')}
            <div class="timer ${t.running ? 'running' : ''}">
              <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
                <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--ring-track)" stroke-width="${stroke}"/>
                <circle data-focus-ring cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--timer-c)" stroke-width="${stroke}" stroke-linecap="round"
                  stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - left / total)).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
              </svg>
              <div class="timer-center">
                <div class="timer-mode">${F.MODES[t.mode]}</div>
                <div class="timer-time" data-focus-time role="timer" aria-live="off">${F.fmt(left)}</div>
                <div class="timer-sub">${status}</div>
              </div>
            </div>
            ${
              t.mode === 'work'
                ? `<input class="focus-label" data-field="label" placeholder="What are you focusing on?" value="${esc(t.label || '')}" maxlength="60" aria-label="Focus label">`
                : `<p class="break-note">${t.mode === 'long' ? 'Take a proper break — go for a walk, get some air.' : 'Stand up, stretch, drink some water.'}</p>`
            }
            <div class="timer-btns">
              <button class="circle-btn grey" data-act="reset" aria-label="Reset">${E.icon('reset', 22)}</button>
              <button class="circle-btn big ${t.running ? 'pause' : 'start'}" data-act="toggle">${t.running ? E.icon('pause', 30) : E.icon('play', 30)}<span>${t.running ? 'Pause' : t.startedAt ? 'Resume' : 'Start'}</span></button>
              <button class="circle-btn grey" data-act="skip" aria-label="Skip to next">${E.icon('skip', 22)}</button>
            </div>
            <div class="cycle">
              <div class="cycle-dots">${Array.from({ length: cfg.every }, (_, i) => `<i class="${i < inCycle ? 'on' : ''}"></i>`).join('')}</div>
              <span>${inCycle} of ${cfg.every} until long break</span>
            </div>
            <div class="ambient">
              <span class="ambient-lbl">${E.icon('waves', 16)}Ambient sound</span>
              ${ui.seg('noise', [{ value: '', label: 'Off' }, { value: 'rain', label: 'Rain' }, { value: 'brown', label: 'Brown' }, { value: 'white', label: 'White' }], F.noiseKind || '', 'small')}
            </div>
          </section>
          <div class="focus-side">
            <section class="card">
              <header class="card-head"><h2>${E.icon('insights', 18)}Last 7 days</h2><span class="muted small">${E.fmtMin(weekTotal)} total</span></header>
              ${E.chart.bars(week, { height: 140, fmt: (v) => v })}
              <div class="chart-note">Minutes of focus per day</div>
            </section>
            <section class="card">
              <header class="card-head"><h2>${E.icon('clock', 18)}Recent sessions</h2></header>
              ${
                recent.length
                  ? `<div class="rows">${recent
                      .map((x) => `<div class="row session-row"><span class="sess-dot"></span><div class="row-main"><div class="row-title">${esc(x.label || 'Focus session')}</div><div class="row-sub">${E.relDay(E.dkey(new Date(x.start)))} · ${E.fmtTime(x.start)}</div></div><span class="sess-min">${x.minutes} min</span><button class="icon-btn sm" data-act="del-session" data-id="${x.id}" aria-label="Delete session">${E.icon('x', 14)}</button></div>`)
                      .join('')}</div>`
                  : `<div class="card-empty">Complete a focus session and it will show up here.</div>`
              }
            </section>
          </div>
        </div>
      </div>`;
    },

    settingsSheet() {
      const cfg = { ...E.db().settings.focus };
      const perm = 'Notification' in window ? Notification.permission : 'unsupported';
      const body = () => `
        <div class="form-group list-group-inset">
          <div class="form-row"><span class="form-row-title">Focus length</span>${ui.stepper('work', cfg.work, ' min')}</div>
          <div class="form-row"><span class="form-row-title">Short break</span>${ui.stepper('short', cfg.short, ' min')}</div>
          <div class="form-row"><span class="form-row-title">Long break</span>${ui.stepper('long', cfg.long, ' min')}</div>
          <div class="form-row"><span class="form-row-title">Long break after</span>${ui.stepper('every', cfg.every, ' sessions')}</div>
        </div>
        <div class="form-group list-group-inset">
          <div class="form-row"><div><div class="form-row-title">Sound when done</div></div><div class="row-right"><button class="btn btn-plain sm" data-act="test">Test</button>${ui.toggle('data-f="sound"', cfg.sound)}</div></div>
          <div class="form-row"><div><div class="form-row-title">Auto-start breaks</div><div class="form-row-sub">Start the break right after a focus session</div></div>${ui.toggle('data-f="autoBreak"', cfg.autoBreak)}</div>
          <div class="form-row"><div><div class="form-row-title">Notifications</div><div class="form-row-sub">${perm === 'granted' ? 'Enabled — you will be notified when the tab is in the background' : perm === 'denied' ? 'Blocked in browser settings' : perm === 'unsupported' ? 'Not supported in this browser' : 'Get notified when a session ends'}</div></div>
            ${perm === 'default' ? `<button class="btn btn-tinted sm" data-act="notif">Enable</button>` : ''}</div>
        </div>`;
      const LIM = { work: [5, 120, 5], short: [1, 30, 1], long: [5, 60, 5], every: [2, 8, 1] };
      const step = (k) => (el, e, api) => {
        const [lo, hi, st] = LIM[k];
        cfg[k] = E.clamp(cfg[k] + +el.dataset.delta * st, lo, hi);
        api.setBody(body());
      };
      ui.sheet({
        title: 'Timer Settings',
        size: 'sm',
        body: body(),
        onChange(el) {
          if (el.dataset.f) cfg[el.dataset.f] = el.checked;
        },
        actions: {
          work: step('work'), short: step('short'), long: step('long'), every: step('every'),
          test: () => F.testSound(),
          notif(el, e, api) {
            Notification.requestPermission().then(() => api.setBody(body()));
          },
        },
        onDone() {
          E.commit((s) => {
            s.settings.focus = cfg;
            F.refreshIdle();
          });
        },
      });
    },

    actions: {
      toggle: () => F.toggle(),
      reset: () => F.reset(),
      skip: () => F.skip(),
      settings: () => V.settingsSheet(),
      async mode(el) {
        const t = F.t();
        if (el.dataset.value === t.mode) return;
        if (t.running) {
          const ok = await ui.confirm({ title: 'Stop the current timer?', message: 'Switching modes resets the timer.', ok: 'Switch' });
          if (!ok) return;
        }
        F.setMode(el.dataset.value);
      },
      noise(el) {
        F.setNoise(el.dataset.value || null);
        E.app.render();
      },
      'del-session'(el) {
        E.commit((s) => (s.focus.sessions = s.focus.sessions.filter((x) => x.id !== el.dataset.id)));
      },
    },

    onInput(el) {
      if (el.dataset.field === 'label') {
        F.t().label = el.value;
        E.commit(null, { silent: true });
      }
    },
    onKey(el, e) {
      if (el.dataset.field === 'label' && e.key === 'Enter') {
        el.blur();
        if (!F.t().running) F.start();
      }
    },
  });
})();
