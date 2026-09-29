/* Ember — Goals board */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  const COLS = [
    { id: 'planned', label: 'Planned', icon: 'bulb' },
    { id: 'active', label: 'In Progress', icon: 'flame' },
    { id: 'done', label: 'Achieved', icon: 'trophy' },
  ];

  const deadlineText = (g) => {
    const dl = E.goal.daysLeft(g);
    if (dl == null) return '';
    if (dl < 0) return `<span class="danger">${E.icon('calendar', 13)}${-dl}d overdue</span>`;
    if (dl === 0) return `<span class="warn">${E.icon('calendar', 13)}Due today</span>`;
    return `<span class="${dl <= 14 ? 'warn' : ''}">${E.icon('calendar', 13)}${E.fmtShort(g.deadline)} · ${dl}d left</span>`;
  };

  const V = (E.views.goals = {
    title: 'Goals',
    st: { cat: 'all' },

    render() {
      const s = E.db(), year = new Date().getFullYear();
      const goals = s.goals.filter((g) => this.st.cat === 'all' || g.category === this.st.cat).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const active = s.goals.filter((g) => g.status === 'active').length;
      const doneYear = s.goals.filter((g) => g.status === 'done' && g.completedAt && new Date(g.completedAt).getFullYear() === year).length;
      const counts = {};
      s.goals.forEach((g) => (counts[g.category] = (counts[g.category] || 0) + 1));

      const chips = `<div class="chips-scroll filter-chips">
        <button class="chip ${this.st.cat === 'all' ? 'chip-on' : ''}" data-act="cat" data-value="all">All <span class="chip-n">${s.goals.length}</span></button>
        ${E.CATEGORIES.map(
          (c) => `<button class="chip ${this.st.cat === c.id ? 'chip-on' : ''}" data-act="cat" data-value="${c.id}">${c.emoji} ${c.label}${counts[c.id] ? ` <span class="chip-n">${counts[c.id]}</span>` : ''}</button>`
        ).join('')}
      </div>`;

      const board = COLS.map((c) => {
        const list = goals.filter((g) => g.status === c.id);
        return `<section class="board-col" data-status="${c.id}">
          <header class="bc-head"><span class="bc-ic ${c.id}">${E.icon(c.icon, 16)}</span><h3>${c.label}</h3><span class="count-pill">${list.length}</span></header>
          <div class="bc-cards" data-drop="${c.id}">${list.map((g) => this.card(g)).join('') || `<div class="bc-empty">${c.id === 'done' ? 'Achieved goals land here' : 'Drag goals here'}</div>`}</div>
          <button class="bc-add" data-act="new" data-status="${c.id}">${E.icon('plus', 16)}Add goal</button>
        </section>`;
      }).join('');

      return `<div class="page page-goals">
        <header class="page-head">
          <div><h1 class="large-title">Goals</h1><div class="subtitle">${active} in progress · ${E.plural(doneYear, 'goal')} achieved in ${year}</div></div>
          <div class="head-actions"><button class="btn btn-primary" data-act="new">${E.icon('plus', 17)}<span>New Goal</span></button></div>
        </header>
        ${chips}
        ${s.goals.length ? '' : `<section class="card intro-card">${ui.empty({ icon: 'goals', title: 'Dream it, plan it, do it', text: 'Add goals to your board, break them into milestones, and drag them across as you make progress.', action: 'Create your first goal', actAttr: 'data-act="new"' })}</section>`}
        <div class="board" data-scroll-id="board">${board}</div>
      </div>`;
    },

    card(g) {
      const cat = E.cat(g.category), p = E.goal.progress(g);
      const ms = g.milestones || [];
      return `<article class="goal-card ${g.status}" draggable="true" data-id="${g.id}" data-act="open" tabindex="0" style="--c:${cat.color}">
        <div class="gc-top"><span class="gc-emoji">${g.emoji}</span><span class="gc-cat">${cat.label}</span>${g.status === 'done' ? `<span class="gc-trophy">${E.icon('trophy', 15)}</span>` : ''}</div>
        <div class="gc-title">${esc(g.title)}</div>
        ${g.description ? `<div class="gc-desc">${esc(g.description)}</div>` : ''}
        ${
          g.status === 'done'
            ? `<div class="gc-meta"><span class="ok">${E.icon('check', 13)}Achieved${g.completedAt ? ` ${E.fmtShort(E.dkey(new Date(g.completedAt)))}` : ''}</span></div>`
            : g.kind === 'amount'
              ? `<div class="gc-amt"><b>${E.goal.amt(g, E.goal.saved(g))}</b><span>of ${E.goal.amt(g, g.target || 0)}</span></div>
                 ${ui.progress(p / 100, cat.color)}
                 <div class="gc-meta"><span class="gc-pct">${p}%</span>${deadlineText(g)}<button class="gc-add" data-act="add-amount" data-id="${g.id}" aria-label="Add to ${esc(g.title)}">${E.icon('plus', 14)}Add</button></div>`
              : `${ui.progress(p / 100, cat.color)}<div class="gc-meta"><span class="gc-pct">${p}%</span>${ms.length ? `<span>${E.icon('check', 13)}${ms.filter((m) => m.done).length}/${ms.length}</span>` : ''}${deadlineText(g)}</div>`
        }
      </article>`;
    },

    after(page) {
      let dragEl = null;
      page.addEventListener('dragstart', (e) => {
        const c = e.target.closest && e.target.closest('.goal-card');
        if (!c) return;
        dragEl = c;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', c.dataset.id);
        requestAnimationFrame(() => c.classList.add('dragging'));
        page.classList.add('is-dragging');
      });
      page.addEventListener('dragend', () => {
        if (dragEl) dragEl.classList.remove('dragging');
        dragEl = null;
        page.classList.remove('is-dragging');
        page.querySelectorAll('.bc-cards.over').forEach((z) => z.classList.remove('over'));
      });
      page.addEventListener('dragover', (e) => {
        if (!dragEl) return;
        const col = e.target.closest('.board-col');
        if (!col) return;
        e.preventDefault();
        const zone = col.querySelector('.bc-cards');
        page.querySelectorAll('.bc-cards.over').forEach((z) => z !== zone && z.classList.remove('over'));
        zone.classList.add('over');
        const emptyEl = zone.querySelector('.bc-empty');
        if (emptyEl) emptyEl.remove();
        const after = [...zone.querySelectorAll('.goal-card:not(.dragging)')].find((c) => {
          const r = c.getBoundingClientRect();
          return e.clientY < r.top + r.height / 2;
        });
        if (after) {
          if (after.previousElementSibling !== dragEl) zone.insertBefore(dragEl, after);
        } else if (zone.lastElementChild !== dragEl) zone.appendChild(dragEl);
      });
      page.addEventListener('drop', (e) => {
        if (!dragEl) return;
        e.preventDefault();
        const moved = E.db().goals.find((g) => g.id === dragEl.dataset.id);
        const wasDone = moved && moved.status === 'done';
        const zones = [...page.querySelectorAll('.bc-cards')];
        E.commit((s) => {
          zones.forEach((zone) => {
            const status = zone.dataset.drop;
            [...zone.querySelectorAll('.goal-card')].forEach((c, i) => {
              const g = s.goals.find((x) => x.id === c.dataset.id);
              if (!g) return;
              if (g.status !== status) {
                g.status = status;
                g.completedAt = status === 'done' ? Date.now() : null;
              }
              g.order = i;
            });
          });
        });
        if (moved && !wasDone && moved.status === 'done') {
          ui.confetti();
          ui.toast('Goal achieved — well done!', 'trophy');
        }
      });
    },

    openGoal(id, status) {
      const existing = id ? E.db().goals.find((g) => g.id === id) : null;
      const d = existing
        ? JSON.parse(JSON.stringify(existing))
        : { id: E.uid(), title: '', emoji: '🎯', category: V.st.cat !== 'all' ? V.st.cat : 'personal', description: '', deadline: null, status: status || 'planned', milestones: [], progress: 0, createdAt: Date.now(), completedAt: null, order: -1 };
      let showEmoji = false;
      d.entries = d.entries || [];
      if (d.unit == null) d.unit = 'Kč';

      const amountSection = () => {
        const saved = E.goal.saved(d), pct = d.target > 0 ? Math.min(1, saved / d.target) : 0, pace = E.goal.pace(d);
        return `
        <div class="form-group list-group-inset">
          <div class="form-row"><span class="form-row-title">Target</span><input class="row-input" type="number" inputmode="decimal" min="0" data-f="target" value="${d.target || ''}" placeholder="50000"></div>
          <div class="form-row"><span class="form-row-title">Unit</span><input class="row-input" data-f="unit" value="${esc(d.unit)}" placeholder="Kč, €, km, books…" maxlength="12"></div>
        </div>
        <div class="amt-sum" data-amt-sum>${amtSummary(saved, pct, pace)}</div>
        <div class="form-label">Add an amount</div>
        <div class="amt-add">
          <input class="field-input" type="number" inputmode="decimal" data-f="amt-new" placeholder="Amount" aria-label="Amount">
          <input class="field-input" data-f="amt-note" placeholder="Note (optional)" maxlength="60" aria-label="Note">
          <button class="btn btn-tinted" data-act="amt-add">${E.icon('plus', 15)}Add</button>
        </div>
        <div class="form-note">Tip: a negative number (e.g. -500) records a withdrawal.</div>
        ${d.entries.length ? `<div class="form-label">History</div><div class="ms-list">${d.entries
          .slice()
          .sort((a, b) => (b.date + b.at).localeCompare(a.date + a.at))
          .map((x) => `<div class="ms-row amt-row"><span class="amt-date">${E.fmtShort(x.date)}</span><span class="amt-note">${esc(x.note || '')}</span><b class="${x.amount < 0 ? 'danger' : ''}">${x.amount > 0 ? '+' : ''}${E.goal.amt(d, x.amount)}</b><button class="icon-btn sm" data-act="amt-del" data-id="${x.id}" aria-label="Remove entry">${E.icon('x', 14)}</button></div>`)
          .join('')}</div>` : ''}`;
      };
      const amtSummary = (saved, pct, pace) => `
        <div class="amt-top"><b>${E.goal.amt(d, saved)}</b><span>of ${E.goal.amt(d, d.target || 0)} · ${Math.floor(pct * 100)}%</span></div>
        ${ui.progress(pct, E.cat(d.category).color)}
        ${d.target > 0 && saved >= d.target ? '<div class="form-note ok">Target reached! Set the status to Achieved when you are ready.</div>'
          : pace ? `<div class="form-note">${pace.late ? `Deadline passed · ${E.goal.amt(d, pace.perMonth)} still to go` : `About <b>${E.goal.amt(d, Math.ceil(pace.perMonth))}</b> a month to reach it by ${E.fmtShort(d.deadline)}`}</div>` : ''}`;
      const addEntry = (api) => {
        const a = parseFloat(String(api.$('[data-f="amt-new"]').value).replace(',', '.'));
        if (!isFinite(a) || !a) return ui.toast('Type an amount first', 'info');
        d.entries.push({ id: E.uid(), date: E.today(), amount: a, note: api.$('[data-f="amt-note"]').value.trim(), at: String(Date.now()) });
        api.setBody(body());
        api.$('[data-f="amt-new"]').focus();
      };

      const body = () => {
        const ms = d.milestones;
        return `
        <div class="field-row">
          <button class="emoji-big" data-act="toggle-emoji" style="--c:${E.cat(d.category).color}" aria-label="Choose icon">${d.emoji}</button>
          <input class="field-input big" data-f="title" placeholder="What do you want to achieve?" value="${esc(d.title)}" ${existing ? '' : 'autofocus'} maxlength="90">
        </div>
        ${showEmoji ? ui.emojiGrid(d.emoji) : ''}
        <textarea class="field-input" data-f="description" rows="2" placeholder="Why does this matter to you?">${esc(d.description)}</textarea>
        <div class="form-label">Status</div>
        ${ui.seg('status', COLS.map((c) => ({ value: c.id, label: c.label })), d.status, 'full')}
        <div class="form-label">Category</div>
        <div class="cat-grid">${E.CATEGORIES.map((c) => `<button class="cat-opt ${d.category === c.id ? 'on' : ''}" data-act="cat" data-value="${c.id}" style="--c:${c.color}">${c.emoji} ${c.label}</button>`).join('')}</div>
        <div class="form-group list-group-inset">
          <div class="form-row"><div class="form-row-title">${E.icon('calendar', 16)} Deadline</div>
            <div class="row-right"><input type="date" class="field-date" data-f="deadline" value="${d.deadline || ''}" aria-label="Deadline">${d.deadline ? `<button class="icon-btn sm" data-act="clear-deadline" aria-label="Clear deadline">${E.icon('x', 15)}</button>` : ''}</div></div>
        </div>
        <div class="form-label">Track progress by</div>
        ${ui.seg('kind', [{ value: 'milestones', label: 'Milestones' }, { value: 'amount', label: 'Amount (e.g. savings)' }], d.kind || 'milestones', 'full')}
        ${d.kind === 'amount' ? amountSection() : `
        <div class="form-label">Milestones ${ms.length ? `<span class="muted">${ms.filter((m) => m.done).length}/${ms.length}</span>` : ''}</div>
        <div class="ms-list">
          ${ms.map((m) => `<div class="ms-row">${ui.check(m.done, `data-act="ms-toggle" data-id="${m.id}"`, E.cat(d.category).color)}<input class="ms-input ${m.done ? 'done' : ''}" data-ms="${m.id}" value="${esc(m.title)}" aria-label="Milestone"><button class="icon-btn sm" data-act="ms-del" data-id="${m.id}" aria-label="Remove milestone">${E.icon('x', 15)}</button></div>`).join('')}
          <div class="ms-row add"><span class="ms-plus">${E.icon('plus', 16)}</span><input class="ms-input" data-f="ms-new" placeholder="Add a milestone and press Enter" aria-label="New milestone"></div>
        </div>
        ${
          ms.length
            ? `<div class="form-note">Progress is calculated from milestones.</div>`
            : `<div class="form-label">Progress <span class="muted" data-prog>${d.progress}%</span></div>
               <input type="range" class="range" min="0" max="100" step="5" value="${d.progress}" data-f="progress" style="--p:${d.progress}%" aria-label="Progress">`
        }`}
        ${existing ? `<button class="btn btn-danger wide" data-act="delete">${E.icon('trash', 16)}Delete Goal</button>` : ''}`;
      };

      const addMs = (api) => {
        const inp = api.$('[data-f="ms-new"]');
        const t = inp.value.trim();
        if (!t) return;
        d.milestones.push({ id: E.uid(), title: t, done: false });
        api.setBody(body());
        api.$('[data-f="ms-new"]').focus();
      };

      ui.sheet({
        title: existing ? 'Edit Goal' : 'New Goal',
        body: body(),
        done: existing ? 'Save' : 'Add',
        size: 'md',
        mount(api) {
          api.wrap.addEventListener('keydown', (e) => {
            if (e.target.dataset.f === 'ms-new' && e.key === 'Enter') {
              e.preventDefault();
              addMs(api);
            }
            if ((e.target.dataset.f === 'amt-new' || e.target.dataset.f === 'amt-note') && e.key === 'Enter') {
              e.preventDefault();
              addEntry(api);
            }
          });
        },
        onInput(el, e, api) {
          const f = el.dataset.f;
          if (f === 'title' || f === 'description') d[f] = el.value;
          if (f === 'target' || f === 'unit') {
            d[f] = f === 'target' ? Math.max(0, parseFloat(el.value.replace(',', '.')) || 0) : el.value.trim();
            const saved = E.goal.saved(d);
            api.$('[data-amt-sum]').innerHTML = amtSummary(saved, d.target > 0 ? Math.min(1, saved / d.target) : 0, E.goal.pace(d));
          }
          if (f === 'progress') {
            d.progress = +el.value;
            el.style.setProperty('--p', d.progress + '%');
            const l = api.$('[data-prog]');
            if (l) l.textContent = d.progress + '%';
          }
          if (el.dataset.ms) {
            const m = d.milestones.find((x) => x.id === el.dataset.ms);
            if (m) m.title = el.value;
          }
        },
        onChange(el, e, api) {
          if (el.dataset.f === 'deadline') {
            d.deadline = el.value || null;
            api.setBody(body());
          }
        },
        actions: {
          'toggle-emoji'(el, e, api) { showEmoji = !showEmoji; api.setBody(body()); },
          'pick-emoji'(el, e, api) { d.emoji = el.dataset.value; showEmoji = false; api.setBody(body()); },
          status(el, e, api) { d.status = el.dataset.value; api.setBody(body()); },
          kind(el, e, api) { d.kind = el.dataset.value === 'amount' ? 'amount' : undefined; api.setBody(body()); },
          'amt-add'(el, e, api) { addEntry(api); },
          'amt-del'(el, e, api) {
            d.entries = d.entries.filter((x) => x.id !== el.dataset.id);
            api.setBody(body());
          },
          cat(el, e, api) { d.category = el.dataset.value; api.setBody(body()); },
          'clear-deadline'(el, e, api) { d.deadline = null; api.setBody(body()); },
          'ms-toggle'(el, e, api) {
            const m = d.milestones.find((x) => x.id === el.dataset.id);
            m.done = !m.done;
            api.setBody(body());
          },
          'ms-del'(el, e, api) {
            d.milestones = d.milestones.filter((x) => x.id !== el.dataset.id);
            api.setBody(body());
          },
          async delete(el, e, api) {
            const ok = await ui.confirm({ title: 'Delete this goal?', message: `“${existing.title}” will be removed permanently.`, ok: 'Delete', destructive: true });
            if (!ok) return;
            api.close();
            E.commit((s) => (s.goals = s.goals.filter((g) => g.id !== existing.id)));
            ui.toast('Goal deleted', 'trash');
          },
        },
        onDone(api) {
          const pending = api.$('[data-f="ms-new"]');
          if (pending && pending.value.trim()) d.milestones.push({ id: E.uid(), title: pending.value.trim(), done: false });
          if (!d.title.trim()) {
            ui.toast('Give your goal a title', 'info');
            return false;
          }
          if (d.kind === 'amount' && !(d.target > 0)) {
            ui.toast('Set a target amount', 'info');
            return false;
          }
          const pendingAmt = api.$('[data-f="amt-new"]');
          if (pendingAmt && parseFloat(pendingAmt.value)) addEntry(api);
          d.title = d.title.trim();
          d.milestones = d.milestones.filter((m) => m.title.trim());
          const becameDone = d.status === 'done' && (!existing || existing.status !== 'done');
          if (becameDone) d.completedAt = Date.now();
          if (d.status !== 'done') d.completedAt = null;
          E.commit((s) => {
            if (existing) Object.assign(existing, d);
            else s.goals.push(d);
          });
          if (becameDone) {
            ui.confetti();
            ui.toast('Goal achieved — well done!', 'trophy');
          } else ui.toast(existing ? 'Goal saved' : 'Goal added');
        },
      });
    },

    /** Quick sheet: add money (or km, pages…) to an amount goal */
    addAmount(id) {
      const g = E.db().goals.find((x) => x.id === id);
      if (!g) return;
      const quick = [100, 500, 1000, 5000];
      ui.sheet({
        title: `Add to ${g.title}`,
        size: 'sm',
        done: 'Add',
        body: `
          <div class="amt-big"><input type="number" inputmode="decimal" data-f="a" placeholder="0" aria-label="Amount" autofocus><span>${esc(g.unit || '')}</span></div>
          <div class="chips-row center">${quick.map((q) => `<button class="chip" data-act="q" data-value="${q}">+${q.toLocaleString('cs-CZ')}</button>`).join('')}</div>
          <input class="field-input" data-f="note" placeholder="Note (optional), e.g. salary" maxlength="60" aria-label="Note">
          <div class="form-group list-group-inset">
            <div class="form-row"><span class="form-row-title">${E.icon('calendar', 16)} Date</span><input type="date" class="field-date" data-f="date" value="${E.today()}" max="${E.today()}"></div>
            <div class="form-row"><span class="form-row-title">Withdrawal</span>${ui.toggle('data-f="minus"', false)}</div>
          </div>
          <div class="form-note">Saved so far: <b>${E.goal.amt(g, E.goal.saved(g))}</b> of ${E.goal.amt(g, g.target || 0)}</div>`,
        actions: {
          q(el, e, api) {
            const inp = api.$('[data-f="a"]');
            inp.value = (parseFloat(inp.value) || 0) + +el.dataset.value;
          },
        },
        onDone(api) {
          let a = parseFloat(String(api.$('[data-f="a"]').value).replace(',', '.'));
          if (!isFinite(a) || a <= 0) {
            ui.toast('Type an amount', 'info');
            return false;
          }
          if (api.$('[data-f="minus"]').checked) a = -a;
          const before = E.goal.saved(g);
          E.commit(() => {
            g.entries = g.entries || [];
            g.entries.push({ id: E.uid(), date: api.$('[data-f="date"]').value || E.today(), amount: a, note: api.$('[data-f="note"]').value.trim(), at: String(Date.now()) });
          });
          const after = E.goal.saved(g);
          if (g.target > 0 && before < g.target && after >= g.target) {
            ui.confetti();
            ui.toast(`Target reached: ${E.goal.amt(g, after)}!`, 'trophy');
          } else ui.toast(`${a > 0 ? 'Added' : 'Withdrew'} ${E.goal.amt(g, Math.abs(a))} · ${E.goal.progress(g)}%`, 'check');
        },
      });
    },

    actions: {
      new: (el) => V.openGoal(null, el.dataset.status),
      open: (el) => V.openGoal(el.dataset.id),
      'add-amount': (el) => V.addAmount(el.dataset.id),
      cat(el) {
        V.st.cat = el.dataset.value;
        E.app.render();
      },
    },

    onKey(el, e) {
      if (e.key === 'Enter' && el.classList.contains('goal-card')) V.openGoal(el.dataset.id);
    },
  });
})();
