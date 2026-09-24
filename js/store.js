/* Ember — data store, persistence and domain helpers */
(function () {
  'use strict';
  const E = window.Ember;
  const KEY = 'ember:data:v1';

  const defaults = () => ({
    version: 1,
    settings: {
      name: '',
      weekStart: 1,
      theme: 'graphite',
      accent: 'orange',
      readingGoal: 12,
      onboarded: false,
      showDoneTasks: false,
      focus: { work: 25, short: 5, long: 15, every: 4, sound: true, autoBreak: false },
    },
    journal: [],
    goals: [],
    habits: [],
    books: [],
    lists: [
      { id: 'personal', name: 'Personal', color: '#FF9F0A' },
      { id: 'work', name: 'Work', color: '#0A84FF' },
    ],
    tasks: [],
    focus: { sessions: [], timer: null },
    health: {}, // { 'YYYY-MM-DD': { sleep, sleepScore, stress, bb, rhr, hrv, steps, src, at } }
  });

  function merge(base, data) {
    const out = { ...base, ...data };
    out.settings = { ...base.settings, ...(data.settings || {}) };
    out.settings.focus = { ...base.settings.focus, ...((data.settings || {}).focus || {}) };
    out.focus = { ...base.focus, ...(data.focus || {}) };
    for (const k of ['journal', 'goals', 'habits', 'books', 'lists', 'tasks']) if (!Array.isArray(out[k])) out[k] = base[k];
    if (!out.lists.length) out.lists = base.lists;
    if (!out.health || typeof out.health !== 'object' || Array.isArray(out.health)) out.health = {};
    return out;
  }

  const store = (E.store = {
    key: KEY,
    state: null,
    lastSaved: 0,
    load() {
      let data = null;
      try {
        data = JSON.parse(localStorage.getItem(KEY));
      } catch (e) {
        data = null;
      }
      store.state = merge(defaults(), data || {});
    },
    saveNow() {
      try {
        localStorage.setItem(KEY, JSON.stringify(store.state));
        store.lastSaved = Date.now();
      } catch (e) {
        E.ui && E.ui.toast('Could not save — browser storage is full or blocked', 'info');
      }
    },
    reset(keepName) {
      const name = store.state.settings.name;
      store.state = defaults();
      if (keepName) store.state.settings.name = name;
      store.state.settings.onboarded = true;
      store.saveNow();
    },
    importData(obj) {
      if (!obj || typeof obj !== 'object' || !obj.settings) throw new Error('This file is not an Ember backup.');
      store.state = merge(defaults(), obj);
      store.state.settings.onboarded = true;
      store.saveNow();
    },
    exportData() {
      return JSON.stringify({ ...store.state, exportedAt: new Date().toISOString() }, null, 2);
    },
  });
  store.save = E.debounce(store.saveNow, 250);
  window.addEventListener('beforeunload', () => store.saveNow());
  window.addEventListener('storage', (e) => {
    if (e.key === KEY && Date.now() - store.lastSaved > 500) {
      store.load();
      E.app && E.app.render();
    }
  });

  E.db = () => store.state;
  /** Mutate state, persist, and (unless silent) re-render the current page. */
  E.commit = (fn, opts = {}) => {
    if (fn) fn(store.state);
    store.save();
    if (!opts.silent && E.app) E.app.render();
  };

  /* ---------- habits ---------- */
  E.habit = {
    isDue: (h, k) => h.days.includes(E.dow(k)),
    count: (h, k) => h.log[k] || 0,
    done: (h, k) => (h.log[k] || 0) >= (h.target || 1),
    start(h) {
      const keys = Object.keys(h.log).sort();
      return keys.length && keys[0] < h.start ? keys[0] : h.start;
    },
    toggle(h, k) {
      const c = h.log[k] || 0, t = h.target || 1;
      if (c >= t) delete h.log[k];
      else h.log[k] = c + 1;
    },
    streak(h) {
      const today = E.today(), start = E.habit.start(h);
      let k = today, s = 0;
      for (let i = 0; i < 3660 && k >= start; i++, k = E.addDays(k, -1)) {
        if (!E.habit.isDue(h, k)) continue;
        if (E.habit.done(h, k)) s++;
        else if (k !== today) break;
      }
      return s;
    },
    best(h) {
      const today = E.today();
      let k = E.habit.start(h), cur = 0, best = 0;
      for (let i = 0; i < 3660 && k <= today; i++, k = E.addDays(k, 1)) {
        if (!E.habit.isDue(h, k)) continue;
        if (E.habit.done(h, k)) best = Math.max(best, ++cur);
        else if (k !== today) cur = 0;
      }
      return best;
    },
    rate(h, days = 30) {
      const today = E.today(), start = E.habit.start(h);
      let due = 0, done = 0;
      for (let i = 0; i < days; i++) {
        const k = E.addDays(today, -i);
        if (k < start) break;
        if (!E.habit.isDue(h, k)) continue;
        const d = E.habit.done(h, k);
        if (k === today && !d) continue;
        due++;
        if (d) done++;
      }
      return due ? done / due : 0;
    },
    total: (h) => Object.keys(h.log).filter((k) => E.habit.done(h, k)).length,
    scheduleText(h) {
      const d = h.days.slice().sort();
      if (d.length === 7) return 'Every day';
      if (d.join() === '1,2,3,4,5') return 'Weekdays';
      if (d.join() === '0,6') return 'Weekends';
      return E.weekdayOrder().filter((x) => d.includes(x)).map((x) => E.DAY_SHORT[x]).join(', ');
    },
    active: () => E.db().habits.filter((h) => !h.archived),
    dueToday: () => E.habit.active().filter((h) => E.habit.isDue(h, E.today())),
  };

  /* ---------- goals ---------- */
  E.goal = {
    progress(g) {
      if (g.status === 'done') return 100;
      if (g.milestones && g.milestones.length) return Math.round((g.milestones.filter((m) => m.done).length / g.milestones.length) * 100);
      return g.progress || 0;
    },
    daysLeft: (g) => (g.deadline ? E.diffDays(g.deadline, E.today()) : null),
  };

  /* ---------- books ---------- */
  E.book = {
    pct: (b) => (b.status === 'finished' ? 1 : b.pages ? E.clamp((b.currentPage || 0) / b.pages, 0, 1) : 0),
    finishedIn: (year) => E.db().books.filter((b) => b.status === 'finished' && b.finishedAt && b.finishedAt.startsWith(String(year))),
  };

  /* ---------- journal ---------- */
  E.journal = {
    sorted: () => E.db().journal.slice().sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)),
    streak() {
      const days = new Set(E.db().journal.filter((j) => (j.title || j.body || '').trim()).map((j) => j.date));
      let k = E.today();
      if (!days.has(k)) k = E.addDays(k, -1);
      let s = 0;
      while (days.has(k)) {
        s++;
        k = E.addDays(k, -1);
      }
      return s;
    },
    forDay: (k) => E.db().journal.filter((j) => j.date === k),
    moodOn(k) {
      const m = E.journal.forDay(k).filter((j) => j.mood);
      return m.length ? Math.round(m.reduce((a, j) => a + j.mood, 0) / m.length) : null;
    },
  };

  /* ---------- tasks ---------- */
  E.task = {
    smart: {
      today: { label: 'Today', icon: 'calendar', color: '#FF9F0A', filter: (t) => t.due && t.due <= E.today() },
      scheduled: { label: 'Scheduled', icon: 'clock', color: '#FF453A', filter: (t) => !!t.due },
      all: { label: 'All', icon: 'inbox', color: '#8E8E93', filter: () => true },
      flagged: { label: 'Flagged', icon: 'flag', color: '#FFD60A', filter: (t) => t.flagged },
    },
    list: (id) => E.db().lists.find((l) => l.id === id),
    openCount: (filter) => E.db().tasks.filter((t) => !t.done && filter(t)).length,
    sort: (a, b) =>
      (a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : (b.priority || 0) - (a.priority || 0) || a.createdAt - b.createdAt,
  };

  /* ---------- focus ---------- */
  E.focusStats = {
    minutesOn: (k) => E.db().focus.sessions.filter((s) => E.dkey(new Date(s.start)) === k).reduce((a, s) => a + s.minutes, 0),
    sessionsOn: (k) => E.db().focus.sessions.filter((s) => E.dkey(new Date(s.start)) === k),
  };

  /* ---------- sample data ---------- */
  store.loadSample = function () {
    const s = defaults();
    s.settings = { ...s.settings, ...store.state.settings, onboarded: true };
    const T = E.today();
    const ago = (n) => E.addDays(T, -n);
    const ts = (k, h = 20, m = 0) => {
      const d = E.parse(k);
      d.setHours(h, m);
      return d.getTime();
    };
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
    const clamp = E.clamp;

    // Health (as if synced from a Garmin watch). Sleep drives the rest, so the comparisons show real patterns.
    s.health = {};
    for (let i = 0; i < 120; i++) {
      const k = ago(i), dw = E.dow(k), weekend = dw === 0 || dw === 6;
      const sleep = Math.round(clamp(425 + gauss() * 45 + (weekend ? 30 : 0), 290, 560));
      const sleepScore = Math.round(clamp(38 + ((sleep - 290) / 270) * 52 + gauss() * 6, 30, 97));
      const stress = Math.round(clamp(36 - (sleep - 420) / 10 + gauss() * 6 + (weekend ? -6 : 4), 12, 72));
      const day = {
        sleep, sleepScore, stress,
        bb: Math.round(clamp(30 + sleepScore * 0.6 - stress * 0.25 + gauss() * 5, 12, 100)),
        rhr: Math.round(50 + stress * 0.1 + gauss() * 1.4),
        hrv: Math.round(clamp(66 - stress * 0.4 + gauss() * 5, 20, 110)),
        steps: Math.round(clamp(7200 + gauss() * 2300 + ([1, 3, 5].includes(dw) ? 3500 : 0), 1200, 23000)),
        src: 'garmin', at: Date.now(),
      };
      if (i === 0) delete day.steps; // today isn't over yet
      s.health[k] = day;
    }
    // Make a few days match the sample journal entries
    Object.assign(s.health[ago(2)], { sleep: 318, sleepScore: 41, stress: 52, bb: 34 });
    Object.assign(s.health[ago(5)], { sleep: 352, sleepScore: 48, stress: 61, bb: 29 });
    Object.assign(s.health[ago(25)], { sleep: 540, sleepScore: 58, stress: 58, bb: 22, rhr: 61, hrv: 31 });
    Object.assign(s.health[ago(8)], { sleep: 505, sleepScore: 88, steps: 24100 });
    [1, 21, 0].forEach((d) => Object.assign(s.health[ago(d)], { sleep: 492, sleepScore: 90, stress: 22, bb: 91 }));
    s.settings.healthImportedAt = Date.now() - 3 * 3600e3;
    const hd = (k) => s.health[k] || { bb: 60, sleep: 420 };

    // Habits
    const mk = (name, emoji, color, days, target, p, startAgo) => {
      const h = { id: E.uid(), name, emoji, color, days, target, log: {}, start: ago(startAgo), archived: false, createdAt: ts(ago(startAgo)) };
      for (let i = 1; i <= startAgo; i++) {
        const k = ago(i);
        if (days.includes(E.dow(k)) && rnd() < p + (hd(k).bb - 60) / 160) h.log[k] = target;
        else if (target > 1 && rnd() < 0.5) h.log[k] = Math.max(1, Math.floor(target * rnd()));
      }
      return h;
    };
    s.habits = [
      mk('Drink water', '💧', '#64D2FF', [0, 1, 2, 3, 4, 5, 6], 8, 0.8, 120),
      mk('Read 20 pages', '📖', '#FF9F0A', [0, 1, 2, 3, 4, 5, 6], 1, 0.75, 150),
      mk('Workout', '💪', '#FF453A', [1, 3, 5], 1, 0.85, 110),
      mk('Meditate', '🧘', '#BF5AF2', [0, 1, 2, 3, 4, 5, 6], 1, 0.6, 90),
      mk('No phone after 22:00', '📵', '#30D158', [0, 1, 2, 3, 4, 5, 6], 1, 0.55, 60),
    ];
    s.habits[0].log[T] = 5;
    s.habits[1].log[T] = 1;

    // Journal
    const entries = [
      [0, 4, 'A calm, productive Wednesday', 'Woke up early and actually used the morning. Went for a short walk before work — the air already smells like autumn.\n\nFinished the draft I had been avoiding for a week. Funny how the dread is always bigger than the task itself.', ['work', 'morning']],
      [1, 5, 'Dinner with friends', 'Cooked risotto for everyone. It was a little too salty but nobody complained. We laughed so much about the camping trip from last summer.\n\nGrateful for: good people, a warm kitchen, and a slow evening.', ['friends', 'gratitude']],
      [2, 3, 'Tired but okay', 'Slept badly. Got through the day on coffee. Need to stop scrolling in bed — adding that to my habits.', ['sleep']],
      [3, 4, 'Gym streak', 'Third workout this week. Deadlifts felt strong. Small wins add up.', ['health']],
      [5, 2, 'Rough day', 'Things at work did not go as planned and I let it get to me. Tomorrow I want to start with the hardest task first and not check messages until 10.', ['work']],
      [6, 4, 'Sunday reset', 'Cleaned the flat, planned the week, and read on the balcony for two hours. This is what weekends should feel like.', ['reset', 'reading']],
      [8, 5, 'Hiking!', 'Twelve kilometres through the forest. Found a viewpoint I had never seen before. My legs hate me, my head loves me.', ['outdoors', 'travel']],
      [10, 3, '', 'Quiet day. Worked, cooked, slept. Nothing special, and that is fine.', []],
      [12, 4, 'New book', 'Started a new novel and already stayed up too late with it. Worth it.', ['reading']],
      [15, 4, 'Learning Spanish', 'Finished the first unit of my Spanish course. Pronunciation is harder than I thought but it is fun.', ['learning']],
      [18, 3, 'Midweek', 'Busy, slightly stressed, but on track. Need to remember to drink more water.', ['work']],
      [21, 5, 'Promotion talk', 'Had the conversation with my manager. It went better than I imagined. Proud of myself for asking.', ['work', 'win']],
      [25, 2, 'Sick', 'Caught a cold. Tea, blanket, series. Being kind to myself today.', ['health']],
      [29, 4, 'Month review', 'Looking back at this month: more consistent with habits, read three books, and saved more than planned.', ['review']],
    ];
    s.journal = entries.map(([d, mood, title, body, tags]) => ({
      id: E.uid(), date: ago(d), title, body, mood, tags, favorite: d === 8 || d === 21, createdAt: ts(ago(d), 21, 10), updatedAt: ts(ago(d), 21, 30),
    }));

    // Goals
    const ms = (arr) => arr.map(([title, done]) => ({ id: E.uid(), title, done }));
    s.goals = [
      { title: 'Run a half marathon', emoji: '🏃', category: 'health', status: 'active', deadline: E.addDays(T, 70), description: 'Prove to myself I can stick with a long training plan.', milestones: ms([['Run 5 km without stopping', 1], ['Run 10 km', 1], ['Run 15 km', 0], ['Register for the race', 0]]) },
      { title: 'Save an emergency fund', emoji: '💰', category: 'finance', status: 'active', deadline: E.addDays(T, 160), description: 'Three months of expenses for peace of mind.', progress: 45, milestones: [] },
      { title: 'Learn Spanish (A2)', emoji: '🗣️', category: 'learning', status: 'active', deadline: E.addDays(T, 200), description: 'For the trip next summer.', milestones: ms([['Finish unit 1', 1], ['Finish unit 2', 0], ['First conversation with a native speaker', 0]]) },
      { title: 'Visit Japan', emoji: '✈️', category: 'travel', status: 'planned', deadline: E.addDays(T, 400), description: 'Tokyo, Kyoto and the countryside.', milestones: ms([['Save for flights', 0], ['Plan the route', 0]]) },
      { title: 'Build a personal website', emoji: '💻', category: 'career', status: 'planned', deadline: null, description: '', milestones: [] },
      { title: 'Read 12 books this year', emoji: '📚', category: 'personal', status: 'done', deadline: null, description: '', milestones: [], completedAt: ts(ago(12)) },
    ].map((g, i) => ({ id: E.uid(), progress: 0, createdAt: ts(ago(40 - i)), order: i, completedAt: null, ...g }));

    // Books
    const Y = new Date().getFullYear();
    const book = (title, author, isbn, pages, status, cur, rating, finishedAgo) => ({
      id: E.uid(), title, author, pages, status, currentPage: cur, rating,
      cover: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false` : '',
      startedAt: status !== 'want' ? ago((finishedAgo || 0) + 14) : null,
      finishedAt: status === 'finished' ? ago(finishedAgo) : null,
      notes: '', quotes: [], createdAt: ts(ago((finishedAgo || 0) + 20)),
    });
    s.books = [
      book('Project Hail Mary', 'Andy Weir', '9780593135204', 476, 'reading', 212, 0),
      book('Atomic Habits', 'James Clear', '9780735211292', 320, 'reading', 88, 0),
      book('Dune', 'Frank Herbert', '9780441172719', 688, 'want', 0, 0),
      book('Sapiens', 'Yuval Noah Harari', '9780062316097', 443, 'want', 0, 0),
      book('Meditations', 'Marcus Aurelius', '9780812968255', 304, 'finished', 304, 5, 12),
      book('The Hobbit', 'J.R.R. Tolkien', '9780547928227', 300, 'finished', 300, 4, 40),
      book('Deep Work', 'Cal Newport', '9781455586691', 296, 'finished', 296, 4, 75),
      book('The Little Prince', 'Antoine de Saint-Exupéry', '9780156012195', 96, 'finished', 96, 5, 130),
    ];
    s.books.forEach((b) => {
      if (b.finishedAt && !b.finishedAt.startsWith(String(Y))) b.finishedAt = `${Y}-01-15`;
    });

    // Tasks
    const task = (title, list, due, extra = {}) => ({ id: E.uid(), title, notes: '', listId: list, due, priority: 0, flagged: false, done: false, doneAt: null, createdAt: Date.now() - Math.floor(rnd() * 1e8), ...extra });
    s.tasks = [
      task('Call the dentist', 'personal', T, { priority: 2 }),
      task('Buy running shoes', 'personal', E.addDays(T, 2)),
      task('Pay electricity bill', 'personal', ago(1), { flagged: true, priority: 3 }),
      task('Prepare slides for Monday', 'work', E.addDays(T, 3), { priority: 2, notes: '10 slides max, focus on results' }),
      task('Reply to Anna about the project', 'work', T),
      task('Plan weekend hike', 'personal', null, { flagged: true }),
      task('Update CV', 'work', null),
      task('Water the plants', 'personal', ago(2), { done: true, doneAt: Date.now() - 1.5e8 }),
    ];

    // Focus sessions
    const labels = ['Deep work', 'Spanish', 'Reading', 'Project', 'Emails'];
    s.focus.sessions = [];
    for (let d = 59; d >= 0; d--) {
      // Well-rested days get more focus sessions
      const n = d === 0 ? 2 : Math.round(clamp((hd(ago(d)).sleep - 330) / 45 + gauss() * 0.9, 0, 6));
      for (let i = 0; i < n; i++) s.focus.sessions.push({ id: E.uid(), start: ts(ago(d), 9 + i * 2, 0), minutes: 25, label: labels[Math.floor(rnd() * labels.length)] });
    }

    store.state = s;
    store.saveNow();
  };
})();
