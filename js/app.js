/* Ember — app shell, router, global events, onboarding */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  const NAV = [
    { id: 'today', label: 'Today', icon: 'today', group: 'Overview' },
    { id: 'insights', label: 'Insights', icon: 'insights', group: 'Overview' },
    { id: 'journal', label: 'Journal', icon: 'journal', group: 'Life' },
    { id: 'habits', label: 'Habits', icon: 'habits', group: 'Life' },
    { id: 'goals', label: 'Goals', icon: 'goals', group: 'Life' },
    { id: 'tasks', label: 'Tasks', icon: 'tasks', group: 'Life' },
    { id: 'books', label: 'Books', icon: 'books', group: 'Growth' },
    { id: 'focus', label: 'Focus', icon: 'focus', group: 'Growth' },
  ];
  const TABS = [
    { id: 'today', label: 'Today', icon: 'today' },
    { id: 'journal', label: 'Journal', icon: 'journal' },
    { id: 'habits', label: 'Habits', icon: 'habits' },
    { id: 'goals', label: 'Goals', icon: 'goals' },
    { id: 'more', label: 'More', icon: 'more' },
  ];

  let current = null;
  let pendingFocus = null;
  let lastDay = E.today();
  let titleObserver = null;
  const $ = (s) => document.querySelector(s);

  const app = (E.app = { NAV });
  app.wide = () => window.innerWidth >= 1040;
  app.focusAfter = (sel) => (pendingFocus = sel);
  app.current = () => current;
  /** Navigate and render right away instead of waiting for the async hashchange event. */
  app.go = (hash) => {
    if (location.hash !== hash) location.hash = hash;
    route();
  };

  /* ---------- shared actions used by several pages ---------- */
  E.shared = {
    habitTap(el) {
      const h = E.db().habits.find((x) => x.id === el.dataset.id);
      if (!h) return;
      const k = el.dataset.date, T = E.today();
      const allDone = () => {
        const due = E.habit.dueToday();
        return due.length > 0 && due.every((x) => E.habit.done(x, T));
      };
      const before = allDone();
      E.habit.toggle(h, k);
      E.commit();
      const n = document.querySelector(`.hcell[data-id="${h.id}"][data-date="${k}"]`);
      if (n) n.classList.add('pop');
      if (k === T && !before && allDone()) {
        ui.confetti();
        ui.toast('Every habit done today — amazing!', 'flame');
      }
    },
    completeTask(el) {
      const t = E.db().tasks.find((x) => x.id === el.dataset.id);
      if (!t) return;
      if (t.done) {
        E.commit(() => {
          t.done = false;
          t.doneAt = null;
        });
        return;
      }
      const row = el.closest('.task, .task-row');
      if (row && row.classList.contains('completing')) return;
      el.classList.add('on');
      if (row) row.classList.add('completing');
      setTimeout(() => {
        E.commit(() => {
          t.done = true;
          t.doneAt = Date.now();
        });
        ui.toast('Task completed');
      }, 420);
    },
    todayEntry() {
      const T = E.today(), s = E.db();
      const list = s.journal.filter((j) => j.date === T).sort((a, b) => b.createdAt - a.createdAt);
      if (list.length) return list[0].id;
      const j = { id: E.uid(), date: T, title: '', body: '', mood: null, tags: [], favorite: false, createdAt: Date.now(), updatedAt: Date.now() };
      s.journal.push(j);
      E.store.save();
      return j.id;
    },
  };

  /* ---------- shell ---------- */
  function buildShell() {
    let groups = '', last = '';
    NAV.forEach((n, i) => {
      if (n.group !== last) {
        groups += `<div class="sb-label">${n.group}</div>`;
        last = n.group;
      }
      groups += `<a class="sb-item" href="#/${n.id}" data-nav="${n.id}" title="${n.label} (${i + 1})"><span class="sb-ic">${E.icon(n.icon, 18)}</span><span class="sb-text">${n.label}</span><span class="sb-badge" ${n.id === 'focus' ? 'id="focus-badge" hidden' : `data-badge="${n.id}"`}></span></a>`;
    });
    $('#sidebar').innerHTML = `
      <div class="brand"><span class="brand-ic">${E.icon('flame', 18)}</span><span>Ember</span></div>
      <button class="sb-search" data-global="spotlight">${E.icon('search', 16)}<span>Search</span><kbd>Ctrl K</kbd></button>
      <nav class="sb-nav" aria-label="Sections">${groups}</nav>
      <div class="sb-bottom">
        <a class="sb-item" href="#/settings" data-nav="settings"><span class="sb-ic">${E.icon('settings', 18)}</span><span class="sb-text">Settings</span></a>
        <a class="sb-profile" href="#/settings"><span class="avatar sm" id="sb-avatar"></span><span class="sb-prof-txt"><b id="sb-name"></b><span id="sb-date"></span></span></a>
      </div>`;
    $('#tabbar').innerHTML = TABS.map((t) => `<a class="tab" href="#/${t.id}" data-tab="${t.id}">${E.icon(t.icon, 24)}<span>${t.label}</span></a>`).join('');
  }

  app.paintProfile = () => {
    const st = E.db().settings;
    const n = (st.name || '').trim();
    const av = $('#sb-avatar'), nm = $('#sb-name'), dt = $('#sb-date');
    if (av) av.textContent = (n || 'E').charAt(0).toUpperCase();
    if (nm) nm.textContent = n || 'Welcome';
    if (dt) dt.textContent = E.fmt(E.today(), { weekday: 'short', month: 'short', day: 'numeric' });
  };

  function paintNav() {
    const v = current.view, s = E.db(), T = E.today();
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === v));
    const moreViews = ['more', 'books', 'tasks', 'focus', 'insights', 'settings'];
    document.querySelectorAll('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === v || (a.dataset.tab === 'more' && moreViews.includes(v))));
    const habitsLeft = E.habit.dueToday().filter((h) => !E.habit.done(h, T)).length;
    const tasksDue = s.tasks.filter((t) => !t.done && t.due && t.due <= T).length;
    const badges = { habits: habitsLeft, tasks: tasksDue };
    document.querySelectorAll('[data-badge]').forEach((b) => {
      const n = badges[b.dataset.badge];
      b.textContent = n || '';
      b.hidden = !n;
    });
    app.paintProfile();
  }

  function applyTheme() {
    const st = E.db().settings;
    const a = E.ACCENTS[st.accent] || E.ACCENTS.orange;
    const root = document.documentElement;
    root.dataset.theme = st.theme;
    root.style.setProperty('--accent', a.c);
    root.style.setProperty('--accent-2', a.c2);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = st.theme === 'midnight' ? '#000000' : '#161618';
  }

  /* ---------- routing & rendering ---------- */
  function parse() {
    const h = location.hash.replace(/^#\/?/, '');
    const [view, ...params] = h.split('/').filter(Boolean);
    return { view: E.views[view] ? view : 'today', params };
  }

  function route() {
    const r = parse();
    const viewChanged = !current || current.view !== r.view;
    const paramsChanged = !viewChanged && current.params.join('/') !== r.params.join('/');
    if (!viewChanged && !paramsChanged) return; // already rendered (e.g. by app.go)
    if (viewChanged && current && E.views[current.view].destroy) E.views[current.view].destroy();
    current = r;
    document.querySelectorAll('.menu-pop').forEach((m) => m.remove());
    app.render({ enter: viewChanged, resetScroll: viewChanged || (paramsChanged && !app.wide()) });
  }

  app.render = function (opts = {}) {
    if (!current) return;
    applyTheme();
    const v = E.views[current.view];
    const main = $('#main'), view = $('#view');

    const scrollTop = main.scrollTop;
    const inner = {};
    view.querySelectorAll('[data-scroll-id]').forEach((el) => (inner[el.dataset.scrollId] = [el.scrollTop, el.scrollLeft]));

    let focusSel = pendingFocus, selStart = null, selEnd = null;
    pendingFocus = null;
    const ae = document.activeElement;
    if (!focusSel && ae && view.contains(ae) && ae.dataset && ae.dataset.field) focusSel = `[data-field="${ae.dataset.field}"]`;
    if (ae && ae.dataset && focusSel && ae.matches && ae.matches(focusSel) && 'selectionStart' in ae) {
      try {
        selStart = ae.selectionStart;
        selEnd = ae.selectionEnd;
      } catch (e) { /* not a text input */ }
    }

    let html;
    try {
      html = v.render(current.params);
    } catch (err) {
      console.error(err);
      html = `<div class="page">${ui.empty({ icon: 'info', title: 'Something went wrong', text: String(err && err.message) })}</div>`;
    }
    view.innerHTML = html;
    const page = view.firstElementChild;
    if (opts.enter && page) page.classList.add('page-enter');

    main.scrollTop = opts.resetScroll ? 0 : scrollTop;
    if (!opts.resetScroll)
      view.querySelectorAll('[data-scroll-id]').forEach((el) => {
        const p = inner[el.dataset.scrollId];
        if (p) {
          el.scrollTop = p[0];
          el.scrollLeft = p[1];
        }
      });

    if (v.after && page) v.after(page, current.params);

    if (focusSel) {
      const f = view.querySelector(focusSel);
      if (f) {
        f.focus({ preventScroll: true });
        if (selStart != null && 'setSelectionRange' in f) {
          try {
            f.setSelectionRange(selStart, selEnd);
          } catch (e) { /* ignore */ }
        } else if (typeof f.value === 'string' && 'setSelectionRange' in f) {
          try {
            f.setSelectionRange(f.value.length, f.value.length);
          } catch (e) { /* ignore */ }
        }
      }
    }

    paintNav();
    E.focus.paint();
    observeTitle(v.title);
  };

  function observeTitle(title) {
    const bar = $('#compact');
    bar.querySelector('span').textContent = title;
    if (titleObserver) titleObserver.disconnect();
    const t = $('#view .large-title');
    if (!t) {
      bar.classList.remove('show');
      return;
    }
    titleObserver = new IntersectionObserver(([en]) => bar.classList.toggle('show', !en.isIntersecting && en.boundingClientRect.top < 60), { root: $('#main'), threshold: 0 });
    titleObserver.observe(t);
  }

  /* ---------- global events ---------- */
  function bindEvents() {
    const view = $('#view');
    const handler = (name) => (e) => {
      const v = E.views[current.view];
      if (name === 'click') {
        const a = e.target.closest('[data-act]');
        if (!a || !view.contains(a)) return;
        const fn = v.actions && v.actions[a.dataset.act];
        if (fn) fn(a, e);
      } else if (name === 'input' && v.onInput) v.onInput(e.target, e);
      else if (name === 'change' && v.onChange) v.onChange(e.target, e);
      else if (name === 'keydown' && v.onKey) v.onKey(e.target, e);
    };
    ['click', 'input', 'change', 'keydown'].forEach((n) => view.addEventListener(n, handler(n)));

    // role="button" rows: activate with Enter / Space
    view.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button' && e.target.dataset.act) {
        e.preventDefault();
        e.target.click();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('[data-global="spotlight"]')) E.spotlight.open();
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        E.spotlight.open();
        return;
      }
      if ($('#overlay-root').children.length || document.querySelector('.onboard')) return;
      const tag = e.target.tagName;
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.target.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        E.spotlight.open();
      } else if (e.key === 'n' || e.key === 'N') {
        const b = view.querySelector('.page-head [data-act="new"], .page-head [data-act="add"]');
        if (b) {
          e.preventDefault();
          b.click();
        }
      } else if (/^[1-8]$/.test(e.key)) {
        location.hash = '#/' + NAV[+e.key - 1].id;
      } else if (e.key === ' ' && current.view === 'focus' && tag !== 'BUTTON' && tag !== 'A') {
        e.preventDefault();
        E.focus.toggle();
      }
    });

    window.addEventListener('hashchange', route);
    window.addEventListener('resize', E.debounce(() => {
      const w = app.wide();
      if (w !== app._wasWide) {
        app._wasWide = w;
        app.render();
      }
    }, 150));

    const dayCheck = () => {
      if (E.today() !== lastDay) {
        lastDay = E.today();
        app.render();
      }
    };
    setInterval(dayCheck, 60000);
    document.addEventListener('visibilitychange', () => !document.hidden && dayCheck());
  }

  /* ---------- onboarding ---------- */
  function onboarding() {
    const feats = [
      ['journal', 'Journal', 'Capture your days, moods and ideas.'],
      ['habits', 'Habits', 'Build streaks with a quick daily check-in.'],
      ['goals', 'Goals', 'Plan big things and track milestones on a board.'],
      ['books', 'Books', 'Keep a reading list and hit your yearly goal.'],
      ['focus', 'Focus & Tasks', 'A pomodoro timer and simple to-do lists.'],
    ];
    const wrap = document.createElement('div');
    wrap.className = 'onboard';
    wrap.innerHTML = `<div class="ob">
      <div class="ob-logo">${E.icon('flame', 46)}</div>
      <h1>Welcome to Ember</h1>
      <p class="ob-sub">Your personal space for the things that matter.</p>
      <div class="ob-features">${feats.map(([i, t, d]) => `<div class="ob-feat"><span class="ob-feat-ic">${E.icon(i, 24)}</span><div><b>${t}</b><span>${d}</span></div></div>`).join('')}</div>
      <input class="ob-name" placeholder="What should we call you?" aria-label="Your name" maxlength="40">
      <button class="btn btn-primary big wide" data-ob="start">Get Started</button>
      <button class="btn btn-plain" data-ob="sample">Explore with sample data</button>
      <p class="ob-privacy">${E.icon('database', 14)}Your data stays private in this browser.</p>
    </div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('open'));
    const input = wrap.querySelector('.ob-name');
    setTimeout(() => input.focus(), 400);
    const finish = (sample) => {
      E.db().settings.name = input.value.trim();
      if (sample) E.store.loadSample();
      E.db().settings.onboarded = true;
      E.store.saveNow();
      wrap.classList.remove('open');
      wrap.classList.add('closing');
      setTimeout(() => wrap.remove(), 500);
      app.render({ enter: true });
    };
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ob]');
      if (b) finish(b.dataset.ob === 'sample');
    });
    input.addEventListener('keydown', (e) => e.key === 'Enter' && finish(false));
  }

  /* ---------- boot ---------- */
  function boot() {
    E.store.load();
    buildShell();
    bindEvents();
    app._wasWide = app.wide();
    E.focus.init();
    route();
    if (!E.db().settings.onboarded) onboarding();
    if (/^https?:/.test(location.protocol)) {
      const l = document.createElement('link');
      l.rel = 'manifest';
      l.href = 'manifest.webmanifest';
      document.head.appendChild(l);
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
