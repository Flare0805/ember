/* Ember — Spotlight search (Ctrl/⌘ K) */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc;

  const hl = (text, q) => {
    const t = esc(text);
    if (!q) return t;
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return t;
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
  };

  const snippet = (body, q) => {
    const b = (body || '').replace(/\s+/g, ' ');
    const i = b.toLowerCase().indexOf(q);
    if (i < 0) return b.slice(0, 80);
    const s = Math.max(0, i - 30);
    return (s ? '…' : '') + b.slice(s, s + 90);
  };

  function commands() {
    const go = (h) => () => (location.hash = h);
    return [
      { icon: 'journal', title: 'New journal entry', sub: 'Action', run: () => E.views.journal.newEntry() },
      { icon: 'tasks', title: 'New task', sub: 'Action', run: () => { location.hash = '#/tasks'; setTimeout(() => E.views.tasks.edit(), 50); } },
      { icon: 'habits', title: 'New habit', sub: 'Action', run: () => { location.hash = '#/habits'; setTimeout(() => E.views.habits.open(), 50); } },
      { icon: 'goals', title: 'New goal', sub: 'Action', run: () => { location.hash = '#/goals'; setTimeout(() => E.views.goals.openGoal(), 50); } },
      { icon: 'books', title: 'Add a book', sub: 'Action', run: () => { location.hash = '#/books'; setTimeout(() => E.views.books.addBook(), 50); } },
      { icon: 'focus', title: E.focus.t().running ? 'Pause focus timer' : 'Start focus timer', sub: 'Action', run: () => { E.focus.toggle(); location.hash = '#/focus'; } },
      { icon: 'health', title: 'Log sleep & health', sub: 'Action', run: () => { location.hash = '#/health'; setTimeout(() => E.health.logSheet(), 50); } },
      { icon: 'watch', title: 'Import Garmin data', sub: 'Action', run: () => E.health.pickFile() },
      ...E.app.NAV.concat([{ id: 'settings', label: 'Settings', icon: 'settings' }]).map((n) => ({ icon: n.icon, title: `Go to ${n.label}`, sub: 'Navigation', run: go('#/' + n.id) })),
    ];
  }

  function search(q) {
    const s = E.db();
    const groups = [];
    const add = (label, items) => items.length && groups.push({ label, items: items.slice(0, 5) });
    const cmds = commands().filter((c) => !q || c.title.toLowerCase().includes(q));
    add(q ? 'Actions' : 'Suggestions', q ? cmds : cmds.slice(0, 8));
    if (!q) return groups;
    add('Journal', E.journal.sorted()
      .filter((j) => `${j.title} ${j.body} ${(j.tags || []).join(' ')}`.toLowerCase().includes(q))
      .map((j) => ({ emoji: (E.mood(j.mood) || {}).emoji, icon: 'journal', title: j.title || snippet(j.body, '').slice(0, 50) || 'Untitled', sub: `${E.fmtShort(j.date)} · ${snippet(j.body, q)}`, run: () => (location.hash = `#/journal/${j.id}`) })));
    add('Goals', s.goals.filter((g) => `${g.title} ${g.description}`.toLowerCase().includes(q))
      .map((g) => ({ emoji: g.emoji, title: g.title, sub: `${E.cat(g.category).label} · ${E.goal.progress(g)}%`, run: () => { location.hash = '#/goals'; setTimeout(() => E.views.goals.openGoal(g.id), 50); } })));
    add('Habits', s.habits.filter((h) => h.name.toLowerCase().includes(q))
      .map((h) => ({ emoji: h.emoji, title: h.name, sub: `${E.habit.scheduleText(h)} · ${E.habit.streak(h)} day streak`, run: () => { location.hash = '#/habits'; setTimeout(() => E.views.habits.open(h.id), 50); } })));
    add('Books', s.books.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(q))
      .map((b) => ({ icon: 'books', title: b.title, sub: `${b.author} · ${{ want: 'Want to read', reading: 'Reading', finished: 'Finished' }[b.status]}`, run: () => { location.hash = '#/books'; setTimeout(() => E.views.books.openBook(b.id), 50); } })));
    add('Tasks', s.tasks.filter((t) => `${t.title} ${t.notes}`.toLowerCase().includes(q))
      .map((t) => ({ icon: t.done ? 'check' : 'tasks', title: t.title, sub: `${t.done ? 'Completed' : t.due ? E.relDay(t.due) : 'No date'} · ${(E.task.list(t.listId) || {}).name || ''}`, run: () => { location.hash = `#/tasks/${t.listId}`; setTimeout(() => E.views.tasks.edit(t.id), 50); } })));
    return groups;
  }

  E.spotlight = {
    open() {
      if (document.querySelector('.spot-wrap')) return;
      const wrap = document.createElement('div');
      wrap.className = 'spot-wrap';
      wrap.innerHTML = `<div class="spot" role="dialog" aria-modal="true" aria-label="Search">
        <div class="spot-input">${E.icon('search', 20)}<input type="text" placeholder="Search entries, goals, books, tasks…" autocomplete="off" spellcheck="false" aria-label="Search"><kbd>esc</kbd></div>
        <div class="spot-results" role="listbox"></div></div>`;
      document.getElementById('overlay-root').appendChild(wrap);
      const input = wrap.querySelector('input'), box = wrap.querySelector('.spot-results');
      let flat = [], idx = 0;

      const paint = () => {
        const q = input.value.trim().toLowerCase();
        const groups = search(q);
        flat = [];
        box.innerHTML = groups.length
          ? groups
              .map((g) => `<div class="spot-group">${esc(g.label)}</div>` + g.items
                .map((it) => {
                  const i = flat.push(it) - 1;
                  return `<button class="spot-item" data-i="${i}" role="option">
                    <span class="spot-ic">${it.emoji ? it.emoji : E.icon(it.icon || 'right', 17)}</span>
                    <span class="spot-txt"><span class="spot-title">${hl(it.title, q)}</span><span class="spot-sub">${hl(it.sub || '', q)}</span></span>
                  </button>`;
                })
                .join(''))
              .join('')
          : `<div class="spot-empty">No results for “${esc(input.value)}”</div>`;
        idx = 0;
        mark();
      };
      const mark = () => {
        box.querySelectorAll('.spot-item').forEach((b) => b.classList.toggle('on', +b.dataset.i === idx));
        const on = box.querySelector('.spot-item.on');
        if (on) on.scrollIntoView({ block: 'nearest' });
      };
      const close = () => {
        document.removeEventListener('keydown', key, true);
        wrap.classList.remove('open');
        setTimeout(() => wrap.remove(), 180);
      };
      const run = (i) => {
        const it = flat[i];
        if (!it) return;
        close();
        it.run();
      };
      const key = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(flat.length - 1, idx + 1); mark(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); mark(); }
        else if (e.key === 'Enter') { e.preventDefault(); run(idx); }
      };
      document.addEventListener('keydown', key, true);
      input.addEventListener('input', paint);
      box.addEventListener('mousemove', (e) => {
        const b = e.target.closest('.spot-item');
        if (b && +b.dataset.i !== idx) { idx = +b.dataset.i; mark(); }
      });
      box.addEventListener('click', (e) => {
        const b = e.target.closest('.spot-item');
        if (b) run(+b.dataset.i);
      });
      wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
      paint();
      requestAnimationFrame(() => { wrap.classList.add('open'); input.focus(); });
    },
  };
})();
