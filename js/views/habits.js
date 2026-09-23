/* Ember — Habits */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  const SUGGEST = [
    ['💧', 'Drink water', 8, '#64D2FF'], ['📖', 'Read 20 pages', 1, '#FF9F0A'], ['💪', 'Workout', 1, '#FF453A'],
    ['🧘', 'Meditate', 1, '#BF5AF2'], ['🚶', 'Walk 10k steps', 1, '#30D158'], ['😴', 'Sleep by 23:00', 1, '#5E5CE6'],
    ['🥗', 'Eat vegetables', 3, '#66D4CF'], ['📵', 'No phone before bed', 1, '#8E8E93'], ['✍️', 'Journal', 1, '#FF9F0A'],
    ['🗣️', 'Practice a language', 1, '#0A84FF'],
  ];

  const level = (r) => (r <= 0 ? 0 : r < 0.34 ? 1 : r < 0.67 ? 2 : r < 1 ? 3 : 4);

  const V = (E.views.habits = {
    title: 'Habits',
    st: { week: 0, showArchived: false },

    render() {
      const s = E.db(), T = E.today();
      const habits = E.habit.active();
      const archived = s.habits.filter((h) => h.archived);
      const due = E.habit.dueToday();
      const doneN = due.filter((h) => E.habit.done(h, T)).length;
      const ws = E.addDays(E.weekStartKey(T), this.st.week * 7);
      const days = Array.from({ length: 7 }, (_, i) => E.addDays(ws, i));
      const weekLabel = this.st.week === 0 ? 'This Week' : this.st.week === -1 ? 'Last Week' : `${E.fmtShort(days[0])} – ${E.fmtShort(days[6])}`;

      const head = `<header class="page-head">
        <div><h1 class="large-title">Habits</h1>
          <div class="subtitle">${due.length ? `${doneN} of ${due.length} done today` : habits.length ? 'Nothing scheduled today — enjoy the rest' : 'Build routines that stick'}</div></div>
        <div class="head-actions"><button class="btn btn-primary" data-act="new">${E.icon('plus', 17)}<span>New Habit</span></button></div>
      </header>`;

      if (!habits.length && !archived.length) {
        return `<div class="page">${head}
          <section class="card">${ui.empty({ icon: 'habits', title: 'No habits yet', text: 'Small things, done daily, add up. Start with one of these or create your own.' })}
            <div class="suggest-grid">${SUGGEST.map((x, i) => `<button class="suggest" data-act="suggest" data-i="${i}"><span>${x[0]}</span>${esc(x[1])}</button>`).join('')}</div>
          </section></div>`;
      }

      const bestNow = habits.map((h) => [h, E.habit.streak(h)]).sort((a, b) => b[1] - a[1])[0];
      const avgRate = habits.length ? habits.reduce((a, h) => a + E.habit.rate(h, 30), 0) / habits.length : 0;
      const perfectDays = this.perfectDays(30);

      const rows = habits
        .map((h) => {
          const st = E.habit.streak(h);
          return `<div class="hg-row">
            <button class="hg-name" data-act="open" data-id="${h.id}">
              <span class="emoji-badge" style="--c:${h.color}">${h.emoji}</span>
              <div class="row-main"><div class="row-title">${esc(h.name)}</div>
              <div class="row-sub">${st ? `<span class="streak">${E.icon('flame', 12)}${st}</span> · ` : ''}${esc(E.habit.scheduleText(h))}${h.target > 1 ? ` · ${h.target}×` : ''}</div></div>
            </button>
            ${days.map((k) => `<div class="hg-cell">${k > T ? '<span class="hcell-future"></span>' : ui.habitCell(h, k, { due: E.habit.isDue(h, k), size: 34 })}</div>`).join('')}
          </div>`;
        })
        .join('');

      const heat = E.chart.heatCells(20, (k) => {
        const active = habits.filter((h) => E.habit.start(h) <= k && E.habit.isDue(h, k));
        if (!active.length) return { level: 0, tip: `${E.fmtShort(k)} · No habits scheduled` };
        const d = active.filter((h) => E.habit.done(h, k)).length;
        return { level: level(d / active.length), tip: `${E.fmt(k, { weekday: 'short', month: 'short', day: 'numeric' })} · ${d}/${active.length} done` };
      });

      return `<div class="page page-habits">${head}
        <div class="stat-tiles">
          <div class="stat-tile">${ui.ring(due.length ? doneN / due.length : 0, { size: 46, stroke: 6 })}<div><div class="stat-val">${doneN}/${due.length}</div><div class="stat-lbl">Today</div></div></div>
          <div class="stat-tile"><span class="stat-ic">${E.icon('flame', 22)}</span><div><div class="stat-val">${bestNow ? bestNow[1] : 0}<small> days</small></div><div class="stat-lbl">${bestNow && bestNow[1] ? `Top streak · ${esc(bestNow[0].name)}` : 'Top streak'}</div></div></div>
          <div class="stat-tile"><span class="stat-ic">${E.icon('insights', 22)}</span><div><div class="stat-val">${E.pct(avgRate)}</div><div class="stat-lbl">30-day completion</div></div></div>
          <div class="stat-tile"><span class="stat-ic">${E.icon('trophy', 22)}</span><div><div class="stat-val">${perfectDays}</div><div class="stat-lbl">Perfect days (30d)</div></div></div>
        </div>

        <section class="card hg-card">
          <div class="week-nav">
            <button class="icon-btn sm" data-act="week" data-delta="-1" aria-label="Previous week">${E.icon('left', 18)}</button>
            <span class="week-label">${weekLabel}</span>
            <button class="icon-btn sm" data-act="week" data-delta="1" ${this.st.week >= 0 ? 'disabled' : ''} aria-label="Next week">${E.icon('right', 18)}</button>
            ${this.st.week < 0 ? `<button class="btn btn-plain sm" data-act="week-today">Today</button>` : ''}
          </div>
          <div class="hg">
            <div class="hg-row hg-head"><div class="hg-name"></div>${days
              .map((k) => `<div class="hg-day ${k === T ? 'today' : ''}"><span>${E.DAY_SHORT[E.dow(k)].slice(0, 3)}</span><b>${E.parse(k).getDate()}</b></div>`)
              .join('')}</div>
            ${rows || `<div class="card-empty">All habits are archived.</div>`}
          </div>
        </section>

        <div class="cols-2">
          <section class="card">
            <header class="card-head"><h2>${E.icon('calendar', 18)}Consistency</h2><span class="muted small">Last 20 weeks · all habits</span></header>
            ${E.chart.heat(heat)}
            <div class="heat-legend"><span>Less</span>${[0, 1, 2, 3, 4].map((l) => `<i class="hc l${l}"></i>`).join('')}<span>More</span></div>
          </section>
          <section class="card">
            <header class="card-head"><h2>${E.icon('flame', 18)}Streaks</h2><span class="muted small">Current · best · 30-day rate</span></header>
            <div class="rows">${habits
              .map((h) => [h, E.habit.streak(h), E.habit.best(h), E.habit.rate(h, 30)])
              .sort((a, b) => b[1] - a[1] || b[3] - a[3])
              .map(([h, cur, best, rate]) => `<button class="row streak-row" data-act="open" data-id="${h.id}">
                <span class="emoji-badge" style="--c:${h.color}">${h.emoji}</span>
                <div class="row-main"><div class="row-title">${esc(h.name)}</div>${ui.progress(rate, h.color)}</div>
                <div class="streak-nums"><b>${cur}</b><span>best ${best} · ${E.pct(rate)}</span></div>
              </button>`)
              .join('')}</div>
          </section>
        </div>

        ${
          archived.length
            ? `<section class="card">
            <button class="card-head as-btn" data-act="toggle-archived"><h2>${E.icon('archive', 18)}Archived <span class="count-pill">${archived.length}</span></h2>${E.icon(this.st.showArchived ? 'down' : 'right', 18)}</button>
            ${this.st.showArchived ? `<div class="rows">${archived.map((h) => `<button class="row" data-act="open" data-id="${h.id}"><span class="emoji-badge" style="--c:${h.color}">${h.emoji}</span><div class="row-main"><div class="row-title">${esc(h.name)}</div><div class="row-sub">${E.habit.total(h)} completions</div></div>${E.icon('right', 16)}</button>`).join('')}</div>` : ''}
          </section>`
            : ''
        }
      </div>`;
    },

    perfectDays(n) {
      const habits = E.habit.active(), T = E.today();
      let c = 0;
      for (let i = 0; i < n; i++) {
        const k = E.addDays(T, -i);
        const due = habits.filter((h) => E.habit.start(h) <= k && E.habit.isDue(h, k));
        if (due.length && due.every((h) => E.habit.done(h, k))) c++;
      }
      return c;
    },

    open(id, preset) {
      const existing = id ? E.db().habits.find((h) => h.id === id) : null;
      const d = existing
        ? JSON.parse(JSON.stringify(existing))
        : { id: E.uid(), name: '', emoji: '⭐', color: '#FF9F0A', days: [0, 1, 2, 3, 4, 5, 6], target: 1, log: {}, start: E.today(), archived: false, createdAt: Date.now() };
      if (preset) Object.assign(d, preset);
      let showEmoji = false;

      const stats = (h) => {
        const heat = E.chart.heatCells(26, (k) => {
          const c = E.habit.count(h, k), t = h.target || 1;
          const tip = `${E.fmt(k, { weekday: 'short', month: 'short', day: 'numeric' })} · ${t > 1 ? `${c}/${t}` : c ? 'Done' : E.habit.isDue(h, k) ? 'Missed' : 'Rest day'}`;
          return { level: c >= t ? 4 : c > 0 ? level(c / t) : 0, tip };
        });
        return `<div class="mini-stats">
            <div><b>${E.habit.streak(h)}</b><span>Current streak</span></div>
            <div><b>${E.habit.best(h)}</b><span>Best streak</span></div>
            <div><b>${E.pct(E.habit.rate(h, 30))}</b><span>30-day rate</span></div>
            <div><b>${E.habit.total(h)}</b><span>Total</span></div>
          </div>
          <div class="sheet-section">${E.chart.heat(heat, h.color)}</div>`;
      };

      const body = () => `
        ${existing ? stats(existing) : `<div class="form-label">Suggestions</div><div class="chips-scroll">${SUGGEST.map((x, i) => `<button class="chip" data-act="suggest" data-i="${i}">${x[0]} ${esc(x[1])}</button>`).join('')}</div>`}
        <div class="form-group">
          <div class="field-row">
            <button class="emoji-big" data-act="toggle-emoji" style="--c:${d.color}" aria-label="Choose icon">${d.emoji}</button>
            <input class="field-input big" data-f="name" placeholder="Habit name" value="${esc(d.name)}" ${existing ? '' : 'autofocus'} maxlength="60">
          </div>
          ${showEmoji ? ui.emojiGrid(d.emoji) : ''}
        </div>
        <div class="form-label">Color</div>
        ${ui.colorRow(d.color)}
        <div class="form-label">Repeat on</div>
        <div class="day-picker">${E.weekdayOrder().map((x) => `<button class="day-opt ${d.days.includes(x) ? 'on' : ''}" data-act="day" data-value="${x}">${E.DAY_SHORT[x]}</button>`).join('')}</div>
        <div class="quick-days">
          <button class="chip" data-act="days" data-value="all">Every day</button>
          <button class="chip" data-act="days" data-value="weekdays">Weekdays</button>
          <button class="chip" data-act="days" data-value="weekends">Weekends</button>
        </div>
        <div class="form-group list-group-inset">
          <div class="form-row"><div><div class="form-row-title">Daily goal</div><div class="form-row-sub">Times per day to count as done</div></div>${ui.stepper('target', d.target, '×')}</div>
          ${existing ? `<div class="form-row"><div><div class="form-row-title">Archive</div><div class="form-row-sub">Hide it but keep its history</div></div>${ui.toggle('data-f="archived"', d.archived)}</div>` : ''}
        </div>
        ${existing ? `<button class="btn btn-danger wide" data-act="delete">${E.icon('trash', 16)}Delete Habit</button>` : ''}
      `;

      ui.sheet({
        title: existing ? existing.name : 'New Habit',
        body: body(),
        done: existing ? 'Save' : 'Add',
        size: 'md',
        onInput(el) {
          if (el.dataset.f === 'name') d.name = el.value;
        },
        onChange(el) {
          if (el.dataset.f === 'archived') d.archived = el.checked;
        },
        actions: {
          'toggle-emoji'(el, e, api) { showEmoji = !showEmoji; api.setBody(body()); },
          'pick-emoji'(el, e, api) { d.emoji = el.dataset.value; showEmoji = false; api.setBody(body()); },
          'pick-color'(el, e, api) { d.color = el.dataset.value; api.setBody(body()); },
          day(el, e, api) {
            const x = +el.dataset.value;
            d.days = d.days.includes(x) ? d.days.filter((y) => y !== x) : [...d.days, x];
            api.setBody(body());
          },
          days(el, e, api) {
            d.days = { all: [0, 1, 2, 3, 4, 5, 6], weekdays: [1, 2, 3, 4, 5], weekends: [0, 6] }[el.dataset.value];
            api.setBody(body());
          },
          target(el, e, api) { d.target = E.clamp(d.target + +el.dataset.delta, 1, 50); api.setBody(body()); },
          suggest(el, e, api) {
            const x = SUGGEST[+el.dataset.i];
            Object.assign(d, { emoji: x[0], name: x[1], target: x[2], color: x[3] });
            api.setBody(body());
          },
          async delete(el, e, api) {
            const ok = await ui.confirm({ title: `Delete “${existing.name}”?`, message: 'All of its history will be removed. Archive it instead to keep the history.', ok: 'Delete', destructive: true });
            if (!ok) return;
            api.close();
            E.commit((s) => (s.habits = s.habits.filter((h) => h.id !== existing.id)));
            ui.toast('Habit deleted', 'trash');
          },
        },
        onDone() {
          if (!d.name.trim()) {
            ui.toast('Give your habit a name', 'info');
            return false;
          }
          if (!d.days.length) {
            ui.toast('Pick at least one day', 'info');
            return false;
          }
          d.name = d.name.trim();
          E.commit((s) => {
            if (existing) Object.assign(existing, { name: d.name, emoji: d.emoji, color: d.color, days: d.days, target: d.target, archived: d.archived });
            else s.habits.push(d);
          });
          ui.toast(existing ? 'Habit saved' : 'Habit added');
        },
      });
    },

    actions: {
      new: () => V.open(),
      open: (el) => V.open(el.dataset.id),
      suggest(el) {
        const x = SUGGEST[+el.dataset.i];
        V.open(null, { emoji: x[0], name: x[1], target: x[2], color: x[3] });
      },
      'habit-tap': (el) => E.shared.habitTap(el),
      week(el) {
        V.st.week = Math.min(0, V.st.week + +el.dataset.delta);
        E.app.render();
      },
      'week-today'() {
        V.st.week = 0;
        E.app.render();
      },
      'toggle-archived'() {
        V.st.showArchived = !V.st.showArchived;
        E.app.render();
      },
    },
  });
})();
