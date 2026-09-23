/* Ember — Insights (stats & charts) */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  E.views.insights = {
    title: 'Insights',

    render() {
      const s = E.db(), T = E.today(), Y = new Date().getFullYear();
      const habits = E.habit.active();

      /* --- headline numbers --- */
      const entries = s.journal.filter((j) => (j.title || j.body || '').trim());
      const words = entries.reduce((a, j) => a + E.words(j.body), 0);
      const habitRate = habits.length ? habits.reduce((a, h) => a + E.habit.rate(h, 30), 0) / habits.length : 0;
      const booksY = E.book.finishedIn(Y).length;
      const goalsDone = s.goals.filter((g) => g.status === 'done').length;
      const focusMin = s.focus.sessions.reduce((a, x) => a + x.minutes, 0);
      const tasksDone30 = s.tasks.filter((t) => t.done && t.doneAt && Date.now() - t.doneAt < 30 * 864e5).length;

      const tile = (icon, val, lbl) => `<div class="stat-tile"><span class="stat-ic">${E.icon(icon, 20)}</span><div><div class="stat-val">${val}</div><div class="stat-lbl">${lbl}</div></div></div>`;

      /* --- mood, last 30 days --- */
      const mood = Array.from({ length: 30 }, (_, i) => {
        const k = E.addDays(T, i - 29), v = E.journal.moodOn(k);
        return { label: E.fmt(k, { month: 'short', day: 'numeric' }), value: v, tip: v ? `${E.fmt(k, { weekday: 'short', month: 'short', day: 'numeric' })} · ${E.mood(v).emoji} ${E.mood(v).label}` : '' };
      });
      const moodCount = mood.filter((m) => m.value).length;
      const moodAvg = moodCount ? mood.reduce((a, m) => a + (m.value || 0), 0) / moodCount : 0;

      /* --- mood distribution, last 90 days --- */
      const dist = E.MOODS.map((m) => ({ ...m, n: 0 }));
      for (let i = 0; i < 90; i++) {
        const v = E.journal.moodOn(E.addDays(T, -i));
        if (v) dist[v - 1].n++;
      }
      const distMax = Math.max(1, ...dist.map((d) => d.n));

      /* --- habit completion per week, last 12 weeks --- */
      const ws = E.weekStartKey(T);
      const habitWeeks = Array.from({ length: 12 }, (_, i) => {
        const start = E.addDays(ws, (i - 11) * 7);
        let due = 0, done = 0;
        for (let d = 0; d < 7; d++) {
          const k = E.addDays(start, d);
          if (k > T) break;
          habits.forEach((h) => {
            if (E.habit.start(h) > k || !E.habit.isDue(h, k)) return;
            const ok = E.habit.done(h, k);
            if (k === T && !ok) return;
            due++;
            if (ok) done++;
          });
        }
        const v = due ? Math.round((done / due) * 100) : 0;
        return { label: E.fmt(start, { month: 'short', day: 'numeric' }), value: v, tip: `Week of ${E.fmtShort(start)}: ${v}% (${done}/${due})`, hi: i === 11 };
      });

      /* --- focus, last 14 days --- */
      const focus14 = Array.from({ length: 14 }, (_, i) => {
        const k = E.addDays(T, i - 13), m = E.focusStats.minutesOn(k);
        return { label: E.DAY_SHORT[E.dow(k)].slice(0, 2), value: m, tip: `${E.fmt(k, { weekday: 'short', month: 'short', day: 'numeric' })}: ${E.fmtMin(m)}`, hi: k === T };
      });

      /* --- books per month, this year --- */
      const curM = new Date().getMonth();
      const booksM = E.MONTHS.map((m, i) => {
        const n = E.book.finishedIn(Y).filter((b) => +b.finishedAt.slice(5, 7) === i + 1).length;
        return { label: m.slice(0, 1), value: n, tip: `${m}: ${E.plural(n, 'book')}`, hi: i === curM };
      });

      /* --- tags --- */
      const tagCount = {};
      s.journal.forEach((j) => (j.tags || []).forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
      const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 14);

      const observations = this.observations(habits, T);

      return `<div class="page page-insights">
        <header class="page-head"><div><h1 class="large-title">Insights</h1><div class="subtitle">Patterns across your journal, habits, reading and focus</div></div></header>

        <div class="stat-tiles six">
          ${tile('journal', entries.length, 'Journal entries')}
          ${tile('edit', words.toLocaleString('en-US'), 'Words written')}
          ${tile('habits', E.pct(habitRate), 'Habits done · 30d')}
          ${tile('books', booksY, `Books read in ${Y}`)}
          ${tile('trophy', goalsDone, 'Goals achieved')}
          ${tile('focus', E.fmtMin(focusMin), 'Total focus time')}
        </div>

        ${observations.length ? `<section class="card obs-card"><header class="card-head"><h2>${E.icon('sparkles', 18)}Observations</h2></header><ul class="obs">${observations.map((o) => `<li>${o}</li>`).join('')}</ul></section>` : ''}

        <div class="cols-2 charts">
          <div class="col">
            <section class="card">
              <header class="card-head"><h2>${E.icon('smile', 18)}Mood · last 30 days</h2>${moodCount ? `<span class="muted small">Avg ${E.mood(Math.round(moodAvg)).emoji} ${moodAvg.toFixed(1)}</span>` : ''}</header>
              ${moodCount ? E.chart.line(mood, { height: 170, min: 1, max: 5, yLabels: E.MOODS.map((m) => ({ v: m.v, label: m.emoji })), every: 7 }) : `<div class="card-empty">Log your mood in the journal to see it here.</div>`}
            </section>
            <section class="card">
              <header class="card-head"><h2>${E.icon('habits', 18)}Habit completion · 12 weeks</h2></header>
              ${habits.length ? E.chart.bars(habitWeeks, { height: 150, max: 100, fmt: (v) => v + '%', every: 2 }) : `<div class="card-empty">Add habits to track your consistency.</div>`}
            </section>
            <section class="card">
              <header class="card-head"><h2>${E.icon('books', 18)}Books finished · ${Y}</h2><span class="muted small">${E.plural(booksY, 'book')}</span></header>
              ${E.chart.bars(booksM, { height: 120, fmt: (v) => v })}
            </section>
          </div>
          <div class="col">
            <section class="card">
              <header class="card-head"><h2>${E.icon('smile', 18)}Mood breakdown · 90 days</h2></header>
              <div class="hbars">${dist
                .slice()
                .reverse()
                .map((d) => `<div class="hbar" data-tip="${d.label}: ${E.plural(d.n, 'day')}"><span class="hbar-lbl">${d.emoji} ${d.label}</span><div class="hbar-track"><div style="width:${(d.n / distMax) * 100}%"></div></div><span class="hbar-n">${d.n}</span></div>`)
                .join('')}</div>
            </section>
            <section class="card">
              <header class="card-head"><h2>${E.icon('focus', 18)}Focus · 14 days</h2><span class="muted small">${E.fmtMin(focus14.reduce((a, d) => a + d.value, 0))}</span></header>
              ${E.chart.bars(focus14, { height: 150, fmt: (v) => v, every: 1 })}
              <div class="chart-note">Minutes per day</div>
            </section>
            <section class="card">
              <header class="card-head"><h2>${E.icon('tag', 18)}Journal topics</h2><span class="muted small">${tasksDone30} tasks done · 30d</span></header>
              ${tags.length ? `<div class="tag-cloud">${tags.map(([t, n]) => `<a class="chip" href="#/journal" data-act="tag" data-value="${esc(t)}">#${esc(t)} <span class="chip-n">${n}</span></a>`).join('')}</div>` : `<div class="card-empty">Tag your journal entries to see recurring topics.</div>`}
            </section>
          </div>
        </div>
      </div>`;
    },

    observations(habits, T) {
      const out = [];
      // Mood on strong-habit days vs. other days
      const good = [], weak = [];
      for (let i = 0; i < 90; i++) {
        const k = E.addDays(T, -i), m = E.journal.moodOn(k);
        if (!m) continue;
        const due = habits.filter((h) => E.habit.start(h) <= k && E.habit.isDue(h, k));
        if (!due.length) continue;
        const r = due.filter((h) => E.habit.done(h, k)).length / due.length;
        (r >= 0.75 ? good : weak).push(m);
      }
      const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      if (good.length >= 3 && weak.length >= 3) {
        const g = avg(good), w = avg(weak);
        if (g - w >= 0.3) out.push(`Your mood averages <b>${g.toFixed(1)}</b> on days you complete most of your habits, versus <b>${w.toFixed(1)}</b> on other days.`);
        else if (w - g >= 0.3) out.push(`Interesting: your mood is slightly higher on lighter habit days (<b>${w.toFixed(1)}</b> vs <b>${g.toFixed(1)}</b>). Maybe your routine is too packed?`);
      }
      // Best weekday for habits
      if (habits.length) {
        const byDay = Array.from({ length: 7 }, () => [0, 0]);
        for (let i = 1; i <= 56; i++) {
          const k = E.addDays(T, -i), d = E.dow(k);
          habits.forEach((h) => {
            if (E.habit.start(h) > k || !E.habit.isDue(h, k)) return;
            byDay[d][1]++;
            if (E.habit.done(h, k)) byDay[d][0]++;
          });
        }
        const rates = byDay.map(([a, b], d) => ({ d, r: b ? a / b : -1 })).filter((x) => x.r >= 0);
        if (rates.length >= 5) {
          rates.sort((a, b) => b.r - a.r);
          const best = rates[0], worst = rates[rates.length - 1];
          const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          if (best.r - worst.r > 0.1)
            out.push(`You are most consistent with habits on <b>${DAY[best.d]}s</b> (${E.pct(best.r)}) and least on <b>${DAY[worst.d]}s</b> (${E.pct(worst.r)}).`);
        }
      }
      // Focus this week vs last week
      let tw = 0, lw = 0;
      for (let i = 0; i < 7; i++) {
        tw += E.focusStats.minutesOn(E.addDays(T, -i));
        lw += E.focusStats.minutesOn(E.addDays(T, -i - 7));
      }
      if (tw || lw) {
        if (lw && tw > lw) out.push(`You focused <b>${E.pct((tw - lw) / lw)} more</b> in the last 7 days than the week before (${E.fmtMin(tw)} vs ${E.fmtMin(lw)}).`);
        else if (lw && tw < lw) out.push(`Focus time is down to <b>${E.fmtMin(tw)}</b> this week from ${E.fmtMin(lw)} the week before.`);
        else if (!lw) out.push(`You logged <b>${E.fmtMin(tw)}</b> of focus in the last 7 days.`);
      }
      // Journal streak
      const js = E.journal.streak();
      if (js >= 3) out.push(`You have journaled <b>${js} days in a row</b>. Keep the streak alive!`);
      return out;
    },

    actions: {
      tag(el, e) {
        e.preventDefault();
        E.views.journal.st.q = '#' + el.dataset.value;
        E.views.journal.st.mode = 'list';
        location.hash = '#/journal';
      },
    },
  };
})();
