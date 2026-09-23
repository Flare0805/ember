/* Ember — Today (dashboard) */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  const RING = { habits: 'var(--accent)', tasks: '#FFD60A', focus: '#FF5E3A' };

  E.views.today = {
    title: 'Today',
    render() {
      const s = E.db(), T = E.today(), hour = new Date().getHours();
      const greet = hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
      const name = (s.settings.name || '').trim().split(/\s+/)[0];

      const habits = E.habit.dueToday();
      const hDone = habits.filter((h) => E.habit.done(h, T)).length;
      const tasksToday = s.tasks.filter((t) => t.due && t.due <= T && (!t.done || (t.doneAt && E.dkey(new Date(t.doneAt)) === T)));
      const tDone = tasksToday.filter((t) => t.done).length;
      const focusMin = E.focusStats.minutesOn(T);
      const focusGoal = s.settings.focus.work * 4;
      const jStreak = E.journal.streak();
      const wroteToday = E.journal.forDay(T).some((j) => (j.title || j.body || '').trim());

      const pH = habits.length ? hDone / habits.length : 0;
      const pT = tasksToday.length ? tDone / tasksToday.length : 0;
      const pF = focusMin / focusGoal;
      // Average only the rings that have something planned today
      const parts = [pF];
      if (habits.length) parts.push(pH);
      if (tasksToday.length) parts.push(pT);
      const overall = Math.round((parts.reduce((a, p) => a + E.clamp(p, 0, 1), 0) / parts.length) * 100);

      const legend = (key, label, val, sub) => `
        <div class="legend-row">
          <span class="legend-dot" style="background:${RING[key]}"></span>
          <div><div class="legend-label">${label}</div><div class="legend-val">${val}<small>${sub}</small></div></div>
        </div>`;

      return `
      <div class="page page-today">
        <header class="page-head">
          <div>
            <div class="eyebrow">${esc(E.fmtLong(T))}</div>
            <h1 class="large-title">${greet}${name ? `, ${esc(name)}` : ''}</h1>
          </div>
          <div class="head-actions">
            <button class="icon-btn" data-act="spotlight" data-tip="Search (Ctrl K)" aria-label="Search">${E.icon('search', 19)}</button>
          </div>
        </header>

        <section class="card hero">
          <div class="hero-rings">${ui.rings([{ pct: pH, color: RING.habits }, { pct: pT, color: RING.tasks }, { pct: pF, color: RING.focus }], 140, 15, 3)}</div>
          <div class="hero-legend">
            ${legend('habits', 'Habits', `${hDone}/${habits.length}`, habits.length ? ' done' : ' today')}
            ${legend('tasks', 'Tasks', `${tDone}/${tasksToday.length}`, ' done')}
            ${legend('focus', 'Focus', focusMin, `/${focusGoal} min`)}
          </div>
          <div class="hero-side">
            <div class="hero-pct">${overall}<span>%</span></div>
            <div class="hero-note">of today's plan</div>
            <div class="hero-chips">
              <a href="#/journal" class="chip ${wroteToday ? 'chip-on' : ''}">${E.icon(wroteToday ? 'check' : 'edit', 14)}${wroteToday ? 'Journaled' : 'Not journaled yet'}</a>
              ${jStreak ? `<span class="chip">${E.icon('flame', 14)}${jStreak}-day journal streak</span>` : ''}
            </div>
          </div>
        </section>

        <div class="cols-2">
          <div class="col">
            ${this.habitsCard(habits, T)}
            ${this.tasksCard(tasksToday, T)}
            ${this.focusCard(focusMin)}
          </div>
          <div class="col">
            ${this.moodCard(T)}
            ${this.readingCard()}
            ${this.goalsCard()}
            ${this.quoteCard()}
          </div>
        </div>
      </div>`;
    },

    habitsCard(habits, T) {
      const body = habits.length
        ? `<div class="rows">${habits
            .map((h) => {
              const c = E.habit.count(h, T), st = E.habit.streak(h);
              return `<div class="row">
                <span class="emoji-badge" style="--c:${h.color}">${h.emoji}</span>
                <div class="row-main"><div class="row-title">${esc(h.name)}</div>
                  <div class="row-sub">${h.target > 1 ? `${c} of ${h.target}` : E.habit.done(h, T) ? 'Done' : 'Not done yet'}${st ? ` · <span class="streak">${E.icon('flame', 12)}${st}</span>` : ''}</div></div>
                ${ui.habitCell(h, T, { size: 36 })}
              </div>`;
            })
            .join('')}</div>`
        : `<div class="card-empty">No habits scheduled today. <a href="#/habits">Add a habit</a></div>`;
      return `<section class="card">
        <header class="card-head"><h2>${E.icon('habits', 18)}Habits</h2><a class="link" href="#/habits">See all${E.icon('right', 15)}</a></header>
        ${body}</section>`;
    },

    tasksCard(tasks, T) {
      const open = tasks.filter((t) => !t.done).sort(E.task.sort);
      const rows = open
        .slice(0, 6)
        .map((t) => {
          const l = E.task.list(t.listId);
          const overdue = t.due < T;
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
        <div class="quick-add">${E.icon('plus', 17)}<input type="text" data-field="quick-task" placeholder="Add a task for today" aria-label="Add a task for today"></div>
      </section>`;
    },

    focusCard(focusMin) {
      const t = E.focus.t();
      const running = t.running;
      return `<section class="card focus-mini">
        <header class="card-head"><h2>${E.icon('focus', 18)}Focus</h2><a class="link" href="#/focus">Open${E.icon('right', 15)}</a></header>
        <div class="focus-mini-body">
          <div>
            <div class="focus-mini-time" data-focus-time>${E.focus.fmt(E.focus.left())}</div>
            <div class="row-sub">${E.focus.MODES[t.mode]} · ${E.fmtMin(focusMin)} focused today</div>
          </div>
          <button class="round-btn ${running ? 'pause' : ''}" data-act="focus-toggle" aria-label="${running ? 'Pause' : 'Start'}">${E.icon(running ? 'pause' : 'play', 20)}</button>
        </div>
      </section>`;
    },

    moodCard(T) {
      const entries = E.journal.forDay(T);
      const mood = E.journal.moodOn(T);
      const main = entries.find((j) => (j.title || j.body || '').trim());
      return `<section class="card">
        <header class="card-head"><h2>${E.icon('journal', 18)}Journal</h2><a class="link" href="#/journal">All entries${E.icon('right', 15)}</a></header>
        <p class="card-q">How are you feeling today?</p>
        <div class="mood-row">${E.MOODS.map(
          (m) => `<button class="mood-btn ${mood === m.v ? 'on' : ''}" data-act="mood" data-value="${m.v}" aria-pressed="${mood === m.v}"><span class="mood-emoji">${m.emoji}</span><span>${m.label}</span></button>`
        ).join('')}</div>
        ${
          main
            ? `<a class="entry-peek" href="#/journal/${main.id}"><div class="entry-peek-title">${esc(main.title || 'Untitled entry')}</div><div class="entry-peek-body">${esc((main.body || '').slice(0, 160))}</div></a>`
            : `<button class="btn btn-tinted wide" data-act="write">${E.icon('edit', 16)}Write about your day</button>`
        }
      </section>`;
    },

    readingCard() {
      const reading = E.db().books.filter((b) => b.status === 'reading');
      if (!reading.length)
        return `<section class="card"><header class="card-head"><h2>${E.icon('books', 18)}Reading</h2><a class="link" href="#/books">Library${E.icon('right', 15)}</a></header>
          <div class="card-empty">You're not reading anything right now. <a href="#/books">Pick a book</a></div></section>`;
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
      const goals = E.db()
        .goals.filter((g) => g.status === 'active')
        .sort((a, b) => (a.deadline || '9999') > (b.deadline || '9999') ? 1 : -1)
        .slice(0, 3);
      return `<section class="card">
        <header class="card-head"><h2>${E.icon('goals', 18)}Goals in progress</h2><a class="link" href="#/goals">Board${E.icon('right', 15)}</a></header>
        ${
          goals.length
            ? `<div class="rows">${goals
                .map((g) => {
                  const p = E.goal.progress(g) / 100, dl = E.goal.daysLeft(g);
                  return `<button class="row goal-row" data-act="goal-open" data-id="${g.id}">
                    <span class="emoji-badge" style="--c:${E.cat(g.category).color}">${g.emoji}</span>
                    <div class="row-main"><div class="row-title">${esc(g.title)}</div>${ui.progress(p, E.cat(g.category).color)}
                    <div class="row-sub">${Math.round(p * 100)}%${dl != null ? ` · ${dl < 0 ? `<span class="danger">${-dl} days overdue</span>` : `${E.plural(dl, 'day')} left`}` : ''}</div></div>
                  </button>`;
                })
                .join('')}</div>`
            : `<div class="card-empty">No goals in progress. <a href="#/goals">Set a goal</a></div>`
        }
      </section>`;
    },

    quoteCard() {
      const q = E.QUOTES[E.dayOfYear() % E.QUOTES.length];
      return `<section class="card quote-card">
        <span class="quote-ic">${E.icon('quote', 22)}</span>
        <blockquote>${esc(q[0])}</blockquote>
        <cite>— ${esc(q[1])}</cite>
      </section>`;
    },

    actions: {
      'habit-tap': (el) => E.shared.habitTap(el),
      'task-done': (el) => E.shared.completeTask(el),
      'focus-toggle': () => E.focus.toggle(),
      spotlight: () => E.spotlight.open(),
      'book-open': (el) => E.views.books.openBook(el.dataset.id),
      'book-progress': (el) => E.views.books.progressSheet(el.dataset.id),
      'goal-open': (el) => E.views.goals.openGoal(el.dataset.id),
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
    },

    onKey(el, e) {
      if (el.dataset.field === 'quick-task' && e.key === 'Enter' && el.value.trim()) {
        const title = el.value.trim();
        E.commit((s) => s.tasks.push({ id: E.uid(), title, notes: '', listId: s.lists[0].id, due: E.today(), priority: 0, flagged: false, done: false, doneAt: null, createdAt: Date.now() }));
        E.ui.toast('Task added');
        const inp = document.querySelector('[data-field="quick-task"]');
        if (inp) inp.focus();
      }
    },
  };
})();
