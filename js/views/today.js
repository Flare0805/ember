/* Ember — Today: a whole-day dashboard in three phases (morning check-in, the day, evening review) */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  const RING = { habits: 'var(--accent)', tasks: '#FFD60A', focus: '#FF5E3A' };
  const PHASES = [
    { id: 'morning', label: 'Morning', icon: 'today' },
    { id: 'day', label: 'Day', icon: 'clock' },
    { id: 'evening', label: 'Evening', icon: 'moon' },
  ];
  const BLOCK_COLORS = ['#FF9F0A', '#0A84FF', '#30D158', '#FF453A', '#BF5AF2', '#64D2FF', '#FFD60A', '#8E8E93'];
  const BLOCK_IDEAS = ['Deep work', 'Meetings', 'Lunch', 'Workout', 'Study', 'Errands', 'Reading', 'Break'];
  const hhmm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const V = (E.views.today = {
    title: 'Today',
    st: { phase: null, day: null },

    /** Re-render when the phase changes or every few minutes (keeps "now" current), but never while typing. */
    /** After the dashboard opens: remind about the top 3 once a day if none are set (not in the evening). */
    after() {
      const T = E.today(), KEY = 'ember:top3-reminder';
      if (E.day.phase() === 'evening' || E.day.top3(T).some((x) => x.text.trim())) return;
      let shown = null;
      try { shown = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
      if (shown === T) return;
      clearTimeout(this._remind);
      this._remind = setTimeout(() => {
        // Not over the welcome screen or another open sheet, and only if we're still on Today
        if (document.querySelector('.onboard') || document.getElementById('overlay-root').children.length) return;
        if (!E.app.current() || E.app.current().view !== 'today') return;
        try { localStorage.setItem(KEY, T); } catch (e) { /* ignore */ }
        this.top3Reminder();
      }, 700);
    },

    top3Reminder() {
      const T = E.today(), holders = ['The most important thing', 'Second priority', 'Third priority'];
      ui.sheet({
        title: "Today's priorities",
        size: 'sm',
        cancel: 'Later',
        done: 'Save',
        body: `
          <div class="remind">
            <span class="remind-ic">${E.icon('target', 28)}</span>
            <h3>Don't forget to add your priorities today</h3>
            <p>What are the three things that would make today a good day?</p>
          </div>
          <div class="form-group list-group-inset">${holders
            .map((h, i) => `<div class="form-row"><span class="win-n">${i + 1}</span><input class="row-input remind-input" data-i="${i}" placeholder="${h}" maxlength="80" enterkeyhint="${i < 2 ? 'next' : 'done'}" aria-label="Priority ${i + 1}" ${i === 0 ? 'autofocus' : ''}></div>`)
            .join('')}</div>`,
        mount(api) {
          api.wrap.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' || !e.target.classList.contains('remind-input')) return;
            e.preventDefault();
            const next = api.$(`.remind-input[data-i="${+e.target.dataset.i + 1}"]`);
            next ? next.focus() : api.done();
          });
        },
        onDone(api) {
          const texts = api.$$('.remind-input').map((x) => x.value.trim());
          if (!texts.some(Boolean)) return;
          E.commit(() => {
            const d = E.day.get(T, true);
            d.top3 = texts.map((text) => ({ text, done: false }));
          });
          ui.toast('Priorities set. Have a great day!', 'target');
        },
      });
    },

    stale() {
      return E.day.phase() !== this.lastAuto || Date.now() - (this.lastRender || 0) > 5 * 60e3;
    },

    render() {
      const T = E.today();
      if (this.st.day !== T) this.st = { phase: null, day: T };
      const auto = E.day.phase();
      this.lastAuto = auto;
      this.lastRender = Date.now();
      const phase = this.st.phase || auto;
      const s = E.db(), hour = new Date().getHours();
      const greet = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      const name = (s.settings.name || '').trim().split(/\s+/)[0];
      const wx = E.weather.cached();
      const chip = wx && wx.data.current ? `<span class="wx-chip" aria-label="Weather now">${E.weather.look(wx.data.current.weather_code, wx.data.current.is_day).icon} ${Math.round(wx.data.current.temperature_2m)}°</span>` : '';

      const T1 = E.addDays(T, 1);
      const cards = {
        morning: [
          [this.lastNightCard(T), this.weatherCard('full'), this.top3Card(T, "Today's top 3"), this.planCard(T)],
          [this.moodCard(T, 'How do you feel this morning?'), this.habitsCard(E.habit.dueToday(), T), this.quoteCard()],
        ],
        day: [
          [this.nowCard(T), this.top3Card(T, "Today's top 3"), this.tasksCard(T)],
          [this.habitsCard(E.habit.dueToday(), T), this.weatherCard('compact'), this.readingCard(), this.goalsCard()],
        ],
        evening: [
          [this.summaryCard(T), this.reviewCard(T), this.habitsLeftCard(T)],
          [this.top3Card(T1, "Tomorrow's top 3", this.tomorrowWeather()), this.planCard(T1, 'Plan for tomorrow'), this.readingCard(), this.quoteCard()],
        ],
      }[phase];

      return `<div class="page page-today">
        <header class="page-head dash-head">
          <div>
            <div class="eyebrow">${esc(E.fmtLong(T))}</div>
            <h1 class="large-title">${greet}${name ? `, ${esc(name)}` : ''}</h1>
          </div>
          <div class="head-actions">${chip}<button class="icon-btn" data-act="spotlight" data-tip="Search (Ctrl K)" aria-label="Search">${E.icon('search', 19)}</button></div>
        </header>
        <div class="phase-seg" role="tablist" aria-label="Part of the day">${PHASES.map(
          (p) => `<button class="phase-btn ${p.id === phase ? 'on' : ''}" role="tab" aria-selected="${p.id === phase}" data-act="phase" data-value="${p.id}">
            ${E.icon(p.icon, 16)}<span>${p.label}</span>${p.id === auto ? '<i class="now-dot" title="Now"></i>' : ''}</button>`
        ).join('')}</div>
        <div class="dash"><div class="col">${cards[0].join('')}</div><div class="col">${cards[1].join('')}</div></div>
      </div>`;
    },

    /* ---------- morning ---------- */
    lastNightCard(T) {
      const H = E.health, s = E.db(), d = s.health[T], auto = !!H.cloud.key(), synced = s.settings.healthImportedAt;
      const head = `<header class="card-head"><h2>${E.icon('moon', 18)}Last night</h2><a class="link" href="#/health">Health${E.icon('right', 15)}</a></header>`;
      if (d && d.sleepBad)
        return `<section class="card">${head}
          <div class="card-empty">✕ You marked last night's sleep as recorded wrong by the watch, so it's left out of your stats.</div>
          <div class="btn-row"><button class="btn btn-plain sm" data-act="night-restore">${E.icon('check', 14)}Count it again</button></div>
        </section>`;
      if (!d || d.sleep == null)
        return `<section class="card">${head}
          <div class="card-empty">${
            auto
              ? `No sleep data for last night yet. It arrives with the next cloud sync after your watch has synced with the Garmin app${synced ? ` (last sync ${E.timeAgo(synced)})` : ''}.`
              : 'See your sleep, Body Battery and stress here every morning, straight from your Garmin.'
          }</div>
          <div class="btn-row">${
            auto
              ? `<button class="btn btn-tinted sm" data-act="sync-now">${E.icon('reset', 14)}Check now</button>`
              : `<button class="btn btn-tinted sm" data-act="cloud">${E.icon('watch', 14)}Turn on automatic sync</button>`
          }<button class="btn btn-plain sm" data-act="health-log">${E.icon('edit', 14)}Log by hand</button></div>
        </section>`;

      const staged = ['deep', 'light', 'rem', 'awake'].some((k) => typeof d[k] === 'number');
      const stressY = H.val(E.addDays(T, -1), 'stress');
      const mini = [
        ['bb', H.val(T, 'bb')], ['rhr', H.val(T, 'rhr')], ['hrv', H.val(T, 'hrv')], ['stress', stressY],
      ].map(([k, v]) => {
        const m = H.metric(k);
        return `<div class="h-mini-item" style="--c:${m.color}" ${k === 'stress' ? `title="Yesterday's average stress"` : ''}><span class="h-ic">${E.icon(m.icon, 14)}</span><b>${v == null ? '—' : m.fmt(v)}</b><span>${m.short || m.label}</span></div>`;
      }).join('');
      const bb = d.bb, sc = d.sleepScore;
      const note = bb == null && sc == null ? ''
        : (bb ?? 60) >= 70 && (sc ?? 70) >= 70 ? 'Well recharged. A good day for your hardest task.'
        : (bb ?? 60) < 40 || (sc ?? 70) < 55 ? 'Low battery. Keep today lighter and aim for an earlier night.'
        : 'Decent recovery. Pace yourself and take real breaks.';
      return `<section class="card ln-card">${head}
        ${staged ? H.lastNightHtml(T, 'Asleep') :`<div class="ln-head"><span>Asleep</span><span><b>${H.hm(d.sleep)}</b>${sc ? ` · score <b>${sc}</b>` : ''}</span></div>`}
        <div class="h-mini">${mini}</div>
        ${note ? `<p class="h-tip">${E.icon('sparkles', 15)}<span>${note}</span></p>` : ''}
        <div class="sync-line">${d.src === 'manual' ? 'Logged by hand' : `From Garmin${synced ? ` · synced ${E.timeAgo(synced)}` : ''}`}${stressY != null ? ' · stress is yesterday’s average' : ''}</div>
      </section>`;
    },

    weatherCard(mode) {
      const W = E.weather;
      const head = (right = '') => `<header class="card-head"><h2>${E.icon('today', 18)}Weather</h2>${right}</header>`;
      if (W.needsPermission())
        return `<section class="card wx-card">${head()}
          <div class="wx-ask"><span class="wx-big-ic">⛅</span><div><b>Weather for where you are</b><span>Your phone asks once. Only a rounded location (about 1 km) is sent to the free Open-Meteo service.</span></div></div>
          <div class="btn-row"><button class="btn btn-tinted sm" data-act="wx-locate">${E.icon('today', 14)}Allow location</button><button class="btn btn-plain sm" data-act="wx-city">Pick a city instead</button></div>
        </section>`;
      const data = W.get(), place = W.place();
      if (!data || !data.current)
        return `<section class="card wx-card">${head()}<div class="card-empty">${navigator.onLine === false ? 'Offline. The forecast appears when you are back online.' : 'Loading the forecast…'}</div></section>`;
      const c = data.current, today = W.day(data, 0), now = W.look(c.weather_code, c.is_day);
      const hours = W.hours(data, mode === 'compact' ? 6 : 12);
      return `<section class="card wx-card ${mode}">
        ${head(`<span class="muted small">${esc(place.name)}</span>`)}
        <div class="wx-now">
          <span class="wx-big-ic">${now.icon}</span>
          <div class="wx-temp">${Math.round(c.temperature_2m)}°</div>
          <div class="wx-meta"><b>${now.label}</b><span>H ${today.hi}° · L ${today.lo}°${today.rain != null ? ` · ${today.rain}% rain` : ''}</span>${
            mode === 'full' ? `<span>Feels like ${Math.round(c.apparent_temperature)}° · Sun ${today.sunrise}–${today.sunset}</span>` : ''
          }</div>
        </div>
        <div class="wx-hours">${hours
          .map((h, i) => `<div class="wx-h"><span>${i === 0 ? 'Now' : h.time}</span><i>${i === 0 ? now.icon : h.icon}</i><b>${i === 0 ? Math.round(c.temperature_2m) : h.temp}°</b><small>${h.rain >= 20 ? `${h.rain}%` : '&nbsp;'}</small></div>`)
          .join('')}</div>
        ${today.rain >= 50 ? `<div class="wx-tip">☂️ Good day for an umbrella.</div>` : ''}
      </section>`;
    },

    tomorrowWeather() {
      const c = E.weather.cached(), d = c ? E.weather.day(c.data, 1) : null;
      return d ? `<div class="wx-tomorrow"><span>${d.icon}</span>Tomorrow: <b>${d.label}</b>, ${d.hi}° / ${d.lo}°${d.rain != null ? ` · ${d.rain}% rain` : ''}</div>` : '';
    },

    top3Card(k, title, extra = '') {
      const t = E.day.top3(k);
      const filled = t.filter((x) => x.text.trim()), done = filled.filter((x) => x.done).length;
      const free = t.filter((x) => !x.text.trim()).length;
      const carry = k === E.today() ? E.day.top3(E.addDays(k, -1)).filter((x) => x.text.trim() && !x.done) : [];
      const holders = ['The most important thing', 'Second priority', 'Third priority'];
      return `<section class="card top3-card">
        <header class="card-head"><h2>${E.icon('target', 18)}${title}</h2>${filled.length ? `<span class="count-pill">${done}/${filled.length}</span>` : ''}</header>
        ${extra}
        <div class="t3">${t
          .map((x, i) => `<div class="t3-row ${x.done ? 'done' : ''}">
            ${ui.check(x.done, `data-act="t3-toggle" data-date="${k}" data-i="${i}" ${x.text.trim() ? '' : 'disabled'}`)}
            <input class="t3-input" data-field="t3" data-date="${k}" data-i="${i}" value="${esc(x.text)}" placeholder="${holders[i]}" maxlength="80" enterkeyhint="${i < 2 ? 'next' : 'done'}" aria-label="Priority ${i + 1}">
          </div>`)
          .join('')}</div>
        ${carry.length && free ? `<button class="btn btn-plain sm carry" data-act="t3-carry">${E.icon('reset', 14)}Carry over ${E.plural(Math.min(carry.length, free), 'unfinished item')} from yesterday</button>` : ''}
      </section>`;
    },

    dayBar(blocks, isToday) {
      const S = 360, R = 1080, x = (m) => E.clamp(((m - S) / R) * 100, 0, 100), now = E.day.nowMins();
      return `<div class="daybar" aria-hidden="true">
        <div class="db-track">${blocks
          .map((b) => {
            const a = x(E.day.mins(b.start)), z = x(E.day.mins(b.end));
            return z > a ? `<i style="left:${a}%;width:${z - a}%;background:${b.color}" data-tip="${esc(b.title)} · ${b.start}–${b.end}"></i>` : '';
          })
          .join('')}${isToday && now >= S ? `<span class="db-now" style="left:${x(now)}%"></span>` : ''}</div>
        <div class="db-scale">${[6, 12, 18, 24].map((h) => `<span style="left:${x(h * 60)}%">${h}</span>`).join('')}</div>
      </div>`;
    },

    planCard(k, title = 'Plan') {
      const blocks = E.day.blocks(k), isToday = k === E.today(), now = E.day.nowMins();
      const prev = E.day.blocks(E.addDays(k, -1));
      const list = blocks
        .map((b) => {
          const s = E.day.mins(b.start), e = E.day.mins(b.end);
          const state = !isToday ? '' : now >= e ? 'past' : now >= s ? 'now' : '';
          return `<button class="blk ${state}" data-act="block-edit" data-date="${k}" data-id="${b.id}" style="--c:${b.color}">
            <span class="blk-time">${b.start}<small>${b.end}</small></span><span class="blk-title">${esc(b.title)}</span>${state === 'now' ? '<span class="blk-now">Now</span>' : ''}</button>`;
        })
        .join('');
      return `<section class="card plan-card">
        <header class="card-head"><h2>${E.icon('clock', 18)}${title}</h2><button class="btn btn-plain sm" data-act="block-add" data-date="${k}">${E.icon('plus', 15)}Add</button></header>
        ${
          blocks.length
            ? `${this.dayBar(blocks, isToday)}<div class="blks">${list}</div>`
            : `<div class="card-empty">Split the day into blocks: deep work, meetings, gym, reading…</div>
               <div class="btn-row"><button class="btn btn-tinted sm" data-act="block-add" data-date="${k}">${E.icon('plus', 14)}Add a block</button>${
                 prev.length ? `<button class="btn btn-plain sm" data-act="plan-copy" data-date="${k}">${E.icon('reset', 14)}Copy the previous day</button>` : ''
               }</div>`
        }
      </section>`;
    },

    /* ---------- day ---------- */
    nowCard(T) {
      const blocks = E.day.blocks(T), now = E.day.nowMins();
      const cur = blocks.find((b) => E.day.mins(b.start) <= now && now < E.day.mins(b.end));
      const next = blocks.find((b) => E.day.mins(b.start) > now);
      const f = E.focus.t();
      const main = cur
        ? (() => {
            const s = E.day.mins(cur.start), e = E.day.mins(cur.end);
            return `<div class="now-blk" style="--c:${cur.color}"><div class="now-lbl">Now</div><div class="now-title">${esc(cur.title)}</div>
              <div class="row-sub">${cur.start}–${cur.end} · ${E.fmtMin(e - now)} left</div>${ui.progress((now - s) / (e - s), cur.color)}</div>`;
          })()
        : `<div class="now-blk free"><div class="now-lbl">Now</div><div class="now-title">${blocks.length ? 'Free time' : 'Nothing planned'}</div>
            <div class="row-sub">${blocks.length ? 'No block right now.' : 'Add time blocks to see what is now and next.'}</div></div>`;
      return `<section class="card now-card">
        <header class="card-head"><h2>${E.icon('clock', 18)}Now & next</h2><button class="btn btn-plain sm" data-act="block-add" data-date="${T}">${E.icon('plus', 15)}Block</button></header>
        ${main}
        ${next ? `<div class="now-next" style="--c:${next.color}"><i></i>Next: <b>${esc(next.title)}</b> at ${next.start}<span class="muted"> · in ${E.fmtMin(E.day.mins(next.start) - now)}</span></div>` : ''}
        ${blocks.length ? this.dayBar(blocks, true) : ''}
        <div class="now-focus">
          <div><span class="now-focus-time" data-focus-time>${E.focus.fmt(E.focus.left())}</span><span class="muted small">${E.focus.MODES[f.mode]} · ${E.fmtMin(E.focusStats.minutesOn(T))} today</span></div>
          <button class="btn ${f.running ? 'btn-tinted' : 'btn-primary'} sm" data-act="focus-start">${E.icon(f.running ? 'pause' : 'play', 14)}${f.running ? 'Pause' : 'Focus'}</button>
        </div>
      </section>`;
    },

    /* ---------- evening ---------- */
    summaryCard(T) {
      const s = E.db(), H = E.health;
      const habits = E.habit.dueToday(), hDone = habits.filter((h) => E.habit.done(h, T)).length;
      const due = s.tasks.filter((t) => t.due && t.due <= T && (!t.done || (t.doneAt && E.dkey(new Date(t.doneAt)) === T)));
      const tDone = s.tasks.filter((t) => t.done && t.doneAt && E.dkey(new Date(t.doneAt)) === T).length;
      const focusMin = E.focusStats.minutesOn(T), focusGoal = s.settings.focus.work * 4;
      const t3 = E.day.top3(T).filter((x) => x.text.trim()), t3done = t3.filter((x) => x.done).length;
      const steps = H.val(T, 'steps'), stress = H.val(T, 'stress');
      const stat = (label, val, dot) => `<div class="sum-stat"><i style="background:${dot || 'transparent'}"></i><span>${label}</span><b>${val}</b></div>`;
      return `<section class="card sum-card">
        <header class="card-head"><h2>${E.icon('insights', 18)}Your day</h2></header>
        <div class="sum">
          <div class="sum-rings">${ui.rings([
            { pct: habits.length ? hDone / habits.length : 0, color: RING.habits },
            { pct: due.length ? due.filter((t) => t.done).length / due.length : 0, color: RING.tasks },
            { pct: focusMin / focusGoal, color: RING.focus },
          ], 112, 12, 3)}</div>
          <div class="sum-grid">
            ${stat('Habits', `${hDone}/${habits.length}`, RING.habits)}
            ${stat('Tasks done', tDone, RING.tasks)}
            ${stat('Focus', E.fmtMin(focusMin), RING.focus)}
            ${stat('Top 3', t3.length ? `${t3done}/${t3.length}` : '—')}
            ${steps != null ? stat('Steps', steps.toLocaleString('en-US')) : ''}
            ${stress != null ? stat('Stress', stress) : ''}
          </div>
        </div>
      </section>`;
    },

    reviewCard(T) {
      const d = E.day.get(T), wins = [0, 1, 2].map((i) => (d.wins || [])[i] || '');
      const mood = E.journal.moodOn(T);
      const wrote = E.journal.forDay(T).some((j) => (j.title || j.body || '').trim());
      const holders = ['Something that went well', 'Something you are proud of', 'Something you are grateful for'];
      return `<section class="card review-card">
        <header class="card-head"><h2>${E.icon('sparkles', 18)}Evening review</h2></header>
        <p class="card-q">Three wins today</p>
        <div class="wins">${wins
          .map((w, i) => `<label class="win-row"><span class="win-n">${i + 1}</span><input data-field="win" data-date="${T}" data-i="${i}" value="${esc(w)}" placeholder="${holders[i]}" maxlength="120" enterkeyhint="${i < 2 ? 'next' : 'done'}" aria-label="Win ${i + 1}"></label>`)
          .join('')}</div>
        <p class="card-q">How was your day?</p>
        <div class="mood-row">${E.MOODS.map(
          (m) => `<button class="mood-btn ${mood === m.v ? 'on' : ''}" data-act="mood" data-value="${m.v}" aria-pressed="${mood === m.v}"><span class="mood-emoji">${m.emoji}</span><span>${m.label}</span></button>`
        ).join('')}</div>
        <button class="btn btn-tinted wide" data-act="review-journal">${E.icon('edit', 16)}${wrote ? "Open today's journal entry" : 'Write in your journal'}</button>
      </section>`;
    },

    habitsLeftCard(T) {
      const all = E.habit.dueToday(), left = all.filter((h) => !E.habit.done(h, T));
      if (!all.length) return '';
      if (!left.length)
        return `<section class="card"><header class="card-head"><h2>${E.icon('habits', 18)}Habits</h2></header><div class="card-empty">Every habit done today. 🎉</div></section>`;
      return this.habitsCard(left, T, 'Habits left today');
    },

    /* ---------- shared cards ---------- */
    habitsCard(habits, T, title = 'Habits') {
      const body = habits.length
        ? `<div class="rows">${habits
            .map((h) => {
              const c = E.habit.count(h, T), st = E.habit.streak(h);
              return `<div class="row">
                <span class="emoji-badge" style="--c:${h.color}">${esc(h.emoji)}</span>
                <div class="row-main"><div class="row-title">${esc(h.name)}</div>
                  <div class="row-sub">${h.target > 1 ? `${c} of ${h.target}` : E.habit.done(h, T) ? 'Done' : 'Not done yet'}${st ? ` · <span class="streak">${E.icon('flame', 12)}${st}</span>` : ''}</div></div>
                ${ui.habitCell(h, T, { size: 38 })}
              </div>`;
            })
            .join('')}</div>`
        : `<div class="card-empty">No habits scheduled today. <a href="#/habits">Add a habit</a></div>`;
      return `<section class="card">
        <header class="card-head"><h2>${E.icon('habits', 18)}${title}</h2><a class="link" href="#/habits">See all${E.icon('right', 15)}</a></header>
        ${body}</section>`;
    },

    tasksCard(T) {
      const s = E.db();
      const tasks = s.tasks.filter((t) => t.due && t.due <= T && (!t.done || (t.doneAt && E.dkey(new Date(t.doneAt)) === T)));
      const open = tasks.filter((t) => !t.done).sort(E.task.sort);
      const rows = open
        .slice(0, 6)
        .map((t) => {
          const l = E.task.list(t.listId), overdue = t.due < T;
          return `<div class="row task-row" data-id="${t.id}">
            ${ui.check(false, `data-act="task-done" data-id="${t.id}"`, l ? l.color : 'var(--accent)')}
            <div class="row-main"><div class="row-title">${t.priority ? `<span class="prio">${'!'.repeat(t.priority)}</span> ` : ''}${esc(t.title)}</div>
              <div class="row-sub ${overdue ? 'danger' : ''}">${overdue ? `Overdue · ${E.relDay(t.due)}` : 'Today'}${l ? ` · ${esc(l.name)}` : ''}</div></div>
            ${t.flagged ? `<span class="flag-ic">${E.icon('flag', 15)}</span>` : ''}
          </div>`;
        })
        .join('');
      return `<section class="card">
        <header class="card-head"><h2>${E.icon('tasks', 18)}Tasks</h2><a class="link" href="#/tasks/today">See all${E.icon('right', 15)}</a></header>
        ${open.length ? `<div class="rows">${rows}</div>` : `<div class="card-empty">${tasks.length ? 'All done for today. Nice! 🎉' : 'Nothing due today.'}</div>`}
        ${open.length > 6 ? `<a class="more-link" href="#/tasks/today">+${open.length - 6} more</a>` : ''}
        <div class="quick-add">${E.icon('plus', 17)}<input type="text" data-field="quick-task" placeholder="Add a task for today" aria-label="Add a task for today" enterkeyhint="done"></div>
      </section>`;
    },

    moodCard(T, question = 'How are you feeling today?') {
      const entries = E.journal.forDay(T), mood = E.journal.moodOn(T);
      const main = entries.find((j) => (j.title || j.body || '').trim());
      return `<section class="card">
        <header class="card-head"><h2>${E.icon('journal', 18)}Check-in</h2><a class="link" href="#/journal">Journal${E.icon('right', 15)}</a></header>
        <p class="card-q">${question}</p>
        <div class="mood-row">${E.MOODS.map(
          (m) => `<button class="mood-btn ${mood === m.v ? 'on' : ''}" data-act="mood" data-value="${m.v}" aria-pressed="${mood === m.v}"><span class="mood-emoji">${m.emoji}</span><span>${m.label}</span></button>`
        ).join('')}</div>
        ${
          main
            ? `<a class="entry-peek" href="#/journal/${main.id}"><div class="entry-peek-title">${esc(main.title || 'Untitled entry')}</div><div class="entry-peek-body">${esc((main.body || '').slice(0, 160))}</div></a>`
            : `<button class="btn btn-tinted wide" data-act="write">${E.icon('edit', 16)}Write a few lines</button>`
        }
      </section>`;
    },

    readingCard() {
      const reading = E.db().books.filter((b) => b.status === 'reading');
      if (!reading.length) return '';
      return `<section class="card">
        <header class="card-head"><h2>${E.icon('books', 18)}Currently reading</h2><a class="link" href="#/books">Library${E.icon('right', 15)}</a></header>
        <div class="rows">${reading
          .slice(0, 2)
          .map(
            (b) => `<div class="read-row">
              <button class="cover-btn" data-act="book-open" data-id="${b.id}" aria-label="Open ${esc(b.title)}">${ui.cover(b, 'sm')}</button>
              <div class="row-main">
                <div class="row-title">${esc(b.title)}</div><div class="row-sub">${esc(b.author)}</div>
                ${ui.progress(E.book.pct(b))}
                <div class="row-sub">${b.pages ? `Page ${b.currentPage || 0} of ${b.pages} · ${E.pct(E.book.pct(b))}` : 'No page count'}</div>
              </div>
              <button class="btn btn-tinted sm" data-act="book-progress" data-id="${b.id}">Update</button>
            </div>`
          )
          .join('')}</div></section>`;
    },

    goalsCard() {
      const goals = E.db().goals.filter((g) => g.status === 'active').sort((a, b) => ((a.deadline || '9999') > (b.deadline || '9999') ? 1 : -1)).slice(0, 3);
      if (!goals.length) return '';
      return `<section class="card">
        <header class="card-head"><h2>${E.icon('goals', 18)}Goals in progress</h2><a class="link" href="#/goals">Board${E.icon('right', 15)}</a></header>
        <div class="rows">${goals
          .map((g) => {
            const p = E.goal.progress(g) / 100, dl = E.goal.daysLeft(g);
            return `<button class="row goal-row" data-act="goal-open" data-id="${g.id}">
              <span class="emoji-badge" style="--c:${E.cat(g.category).color}">${esc(g.emoji)}</span>
              <div class="row-main"><div class="row-title">${esc(g.title)}</div>${ui.progress(p, E.cat(g.category).color)}
              <div class="row-sub">${g.kind === 'amount' ? `${E.goal.amt(g, E.goal.saved(g))} of ${E.goal.amt(g, g.target || 0)} · ` : ''}${Math.round(p * 100)}%${dl != null ? ` · ${dl < 0 ? `<span class="danger">${-dl} days overdue</span>` : `${E.plural(dl, 'day')} left`}` : ''}</div></div>
            </button>`;
          })
          .join('')}</div>
      </section>`;
    },

    quoteCard() {
      const q = E.QUOTES[E.dayOfYear() % E.QUOTES.length];
      return `<section class="card quote-card"><span class="quote-ic">${E.icon('quote', 22)}</span><blockquote>${esc(q[0])}</blockquote><cite>— ${esc(q[1])}</cite></section>`;
    },

    /* ---------- time block sheet ---------- */
    blockSheet(k, id) {
      const day = E.day.get(k);
      const existing = id ? (day.blocks || []).find((b) => b.id === id) : null;
      let b;
      if (existing) b = { ...existing };
      else {
        const ends = E.day.blocks(k).map((x) => E.day.mins(x.end));
        let start = k === E.today() ? Math.ceil(E.day.nowMins() / 30) * 30 : 9 * 60;
        if (ends.length) start = Math.max(start, Math.max(...ends));
        start = Math.min(start, 22 * 60);
        b = { id: E.uid(), title: '', start: hhmm(start), end: hhmm(Math.min(start + 60, 23 * 60 + 59)), color: BLOCK_COLORS[(day.blocks || []).length % BLOCK_COLORS.length] };
      }
      const body = () => `
        <input class="field-input big" data-f="title" placeholder="What is this block for?" value="${esc(b.title)}" ${existing ? '' : 'autofocus'} maxlength="50" aria-label="Block title">
        <div class="chips-row">${BLOCK_IDEAS.map((t) => `<button class="chip" data-act="idea" data-value="${t}">${t}</button>`).join('')}</div>
        <div class="form-group list-group-inset">
          <div class="form-row"><span class="form-row-title">${E.icon('clock', 16)} Starts</span><input type="time" class="field-date" data-f="start" value="${b.start}" step="300" aria-label="Start time"></div>
          <div class="form-row"><span class="form-row-title">${E.icon('clock', 16)} Ends</span><input type="time" class="field-date" data-f="end" value="${b.end}" step="300" aria-label="End time"></div>
        </div>
        <div class="form-label">Color</div>
        <div class="color-row">${BLOCK_COLORS.map((c) => `<button type="button" class="color-opt ${c === b.color ? 'on' : ''}" data-act="color" data-value="${c}" style="--c:${c}" aria-label="Color ${c}"></button>`).join('')}</div>
        ${existing ? `<button class="btn btn-danger wide" data-act="delete">${E.icon('trash', 16)}Delete block</button>` : ''}`;
      ui.sheet({
        title: existing ? 'Edit Block' : k === E.today() ? 'New Block' : `New Block · ${E.relDay(k)}`,
        size: 'sm',
        done: existing ? 'Save' : 'Add',
        body: body(),
        onInput(el) {
          if (el.dataset.f === 'title') b.title = el.value;
        },
        onChange(el) {
          if (el.dataset.f === 'start' || el.dataset.f === 'end') b[el.dataset.f] = el.value;
        },
        actions: {
          idea(el, e, api) {
            b.title = el.dataset.value;
            api.$('[data-f="title"]').value = b.title;
          },
          color(el, e, api) {
            b.color = el.dataset.value;
            api.$$('.color-opt').forEach((x) => x.classList.toggle('on', x === el));
          },
          delete(el, e, api) {
            api.close();
            E.commit(() => {
              const d = E.day.get(k, true);
              d.blocks = d.blocks.filter((x) => x.id !== b.id);
            });
            ui.toast('Block deleted', 'trash');
          },
        },
        onDone() {
          if (!b.title.trim()) {
            ui.toast('Give the block a name', 'info');
            return false;
          }
          if (!b.start || !b.end || E.day.mins(b.end) <= E.day.mins(b.start)) {
            ui.toast('The block has to end after it starts', 'info');
            return false;
          }
          b.title = b.title.trim();
          E.commit(() => {
            const d = E.day.get(k, true);
            d.blocks = (d.blocks || []).filter((x) => x.id !== b.id).concat(b);
          });
        },
      });
    },

    actions: {
      phase(el) {
        V.st.phase = el.dataset.value === V.lastAuto ? null : el.dataset.value;
        E.app.render({ resetScroll: true });
      },
      'habit-tap': (el) => E.shared.habitTap(el),
      'task-done': (el) => E.shared.completeTask(el),
      'focus-toggle': () => E.focus.toggle(),
      'focus-start'() {
        const t = E.focus.t();
        if (!t.running && t.mode === 'work' && !(t.label || '').trim()) {
          const now = E.day.nowMins();
          const cur = E.day.blocks(E.today()).find((b) => E.day.mins(b.start) <= now && now < E.day.mins(b.end));
          if (cur) t.label = cur.title;
        }
        E.focus.toggle();
      },
      'health-log': () => E.health.logSheet(),
      'night-restore': () => E.health.toggleBadNight(E.today()),
      cloud: () => E.health.cloudSheet(),
      async 'sync-now'(el) {
        el.disabled = true;
        const r = await E.health.cloud.pull({ force: true });
        if (!r.ok) ui.toast(r.error, 'info');
        else if (!r.changed) ui.toast('No new Garmin data yet', 'watch');
        E.app.render();
      },
      spotlight: () => E.spotlight.open(),
      'book-open': (el) => E.views.books.openBook(el.dataset.id),
      'book-progress': (el) => E.views.books.progressSheet(el.dataset.id),
      'goal-open': (el) => E.views.goals.openGoal(el.dataset.id),
      async 'wx-locate'(el) {
        el.disabled = true;
        const r = await E.weather.locate();
        if (!r.ok) ui.toast(r.error, 'info');
        else await E.weather.refresh();
        E.app.render();
      },
      'wx-city': () => E.views.settings.citySheet(),
      't3-toggle'(el) {
        const k = el.dataset.date, i = +el.dataset.i;
        let allDone = false;
        E.commit(() => {
          const d = E.day.get(k, true);
          d.top3 = E.day.top3(k);
          d.top3[i].done = !d.top3[i].done;
          const filled = d.top3.filter((x) => x.text.trim());
          allDone = d.top3[i].done && filled.length === 3 && filled.every((x) => x.done);
        });
        if (allDone) {
          ui.confetti();
          ui.toast('All three priorities done!', 'target');
        }
      },
      't3-carry'() {
        const T = E.today();
        const carry = E.day.top3(E.addDays(T, -1)).filter((x) => x.text.trim() && !x.done);
        E.commit(() => {
          const d = E.day.get(T, true);
          d.top3 = E.day.top3(T);
          d.top3.forEach((x) => {
            if (!x.text.trim() && carry.length) x.text = carry.shift().text;
          });
        });
      },
      'block-add': (el) => V.blockSheet(el.dataset.date),
      'block-edit': (el) => V.blockSheet(el.dataset.date, el.dataset.id),
      'plan-copy'(el) {
        const k = el.dataset.date;
        E.commit(() => {
          const d = E.day.get(k, true);
          d.blocks = E.day.blocks(E.addDays(k, -1)).map((b) => ({ ...b, id: E.uid() }));
        });
        ui.toast('Plan copied');
      },
      mood(el) {
        const v = +el.dataset.value, T = E.today();
        E.commit((s) => {
          const list = s.journal.filter((j) => j.date === T).sort((a, b) => b.createdAt - a.createdAt);
          if (list.length) list.forEach((j, i) => (j.mood = i === 0 ? (j.mood === v ? null : v) : j.mood));
          else s.journal.push({ id: E.uid(), date: T, title: '', body: '', mood: v, tags: [], favorite: false, createdAt: Date.now(), updatedAt: Date.now() });
        });
      },
      write() {
        const id = E.shared.todayEntry();
        E.app.focusAfter('.ed-body');
        E.app.go(`#/journal/${id}`);
      },
      'review-journal'() {
        const T = E.today(), id = E.shared.todayEntry();
        const wins = (E.day.get(T).wins || []).map((w) => (w || '').trim()).filter(Boolean);
        E.commit((s) => {
          const j = s.journal.find((x) => x.id === id);
          if (!j.body.trim() && wins.length) j.body = `Wins today:\n${wins.map((w) => `• ${w}`).join('\n')}\n\n`;
          if (!j.title.trim()) j.title = 'Evening review';
          j.updatedAt = Date.now();
        }, { silent: true });
        E.app.focusAfter('.ed-body');
        E.app.go(`#/journal/${id}`);
      },
    },

    onInput(el) {
      const f = el.dataset.field;
      if (f === 't3') {
        const k = el.dataset.date, i = +el.dataset.i;
        const d = E.day.get(k, true);
        d.top3 = E.day.top3(k);
        d.top3[i].text = el.value;
        if (!el.value.trim()) d.top3[i].done = false;
        E.commit(null, { silent: true });
        const chk = el.parentElement.querySelector('.check');
        if (chk) chk.disabled = !el.value.trim();
      } else if (f === 'win') {
        const d = E.day.get(el.dataset.date, true);
        d.wins = [0, 1, 2].map((i) => (d.wins || [])[i] || '');
        d.wins[+el.dataset.i] = el.value;
        E.commit(null, { silent: true });
      }
    },

    onKey(el, e) {
      const f = el.dataset.field;
      if (f === 'quick-task' && e.key === 'Enter' && el.value.trim()) {
        const title = el.value.trim();
        E.app.focusAfter('[data-field="quick-task"]');
        E.commit((s) => s.tasks.push({ id: E.uid(), title, notes: '', listId: s.lists[0].id, due: E.today(), priority: 0, flagged: false, done: false, doneAt: null, createdAt: Date.now() }));
        ui.toast('Task added');
      } else if ((f === 't3' || f === 'win') && e.key === 'Enter') {
        e.preventDefault();
        const next = document.querySelector(`[data-field="${f}"][data-date="${el.dataset.date}"][data-i="${+el.dataset.i + 1}"]`);
        if (next) next.focus();
        else el.blur();
      }
    },
  });
})();
