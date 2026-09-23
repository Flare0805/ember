/* Ember — Tasks (Reminders-style) */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;
  const PRIO = [{ value: '0', label: 'None' }, { value: '1', label: '!' }, { value: '2', label: '!!' }, { value: '3', label: '!!!' }];

  const V = (E.views.tasks = {
    title: 'Tasks',
    currentKey: null,

    resolve(key) {
      const sm = E.task.smart[key];
      if (sm) return { key, smart: true, label: sm.label, color: sm.color, filter: sm.filter };
      if (key === 'completed') return { key, smart: true, label: 'Completed', color: '#8E8E93', filter: () => true, completed: true };
      const l = E.task.list(key);
      if (l) return { key, smart: false, label: l.name, color: l.color, filter: (t) => t.listId === l.id, list: l };
      return null;
    },

    render(params) {
      const wide = E.app.wide();
      let key = params[0];
      if (key && !this.resolve(key)) key = null;
      if (!key && wide) key = 'today';
      this.currentKey = key;
      if (!wide) {
        return key
          ? `<div class="page page-tasks narrow">${this.listView(key, true)}</div>`
          : `<div class="page page-tasks narrow">${this.head()}${this.overview(null)}</div>`;
      }
      return `<div class="page page-tasks">${this.head()}
        <div class="split">
          <aside class="split-list card" data-scroll-id="tlists">${this.overview(key)}</aside>
          <section class="split-detail card" data-scroll-id="tdetail">${this.listView(key, false)}</section>
        </div></div>`;
    },

    head() {
      const s = E.db(), T = E.today();
      const open = s.tasks.filter((t) => !t.done).length;
      const due = s.tasks.filter((t) => !t.done && t.due && t.due <= T).length;
      return `<header class="page-head">
        <div><h1 class="large-title">Tasks</h1><div class="subtitle">${open} open · ${due} due today or overdue</div></div>
        <div class="head-actions"><button class="btn btn-primary" data-act="new">${E.icon('plus', 17)}<span>New Task</span></button></div>
      </header>`;
    },

    overview(sel) {
      const s = E.db();
      const tiles = Object.entries(E.task.smart)
        .map(([k, sm]) => `<a class="smart-tile ${sel === k ? 'sel' : ''}" href="#/tasks/${k}" style="--c:${sm.color}">
          <span class="st-ic">${E.icon(sm.icon, 17)}</span><b>${E.task.openCount(sm.filter)}</b><span class="st-lbl">${sm.label}</span></a>`)
        .join('');
      const doneN = s.tasks.filter((t) => t.done).length;
      return `<div class="smart-grid">${tiles}</div>
        <a class="list-row ${sel === 'completed' ? 'sel' : ''}" href="#/tasks/completed"><span class="lr-ic" style="--c:#8E8E93">${E.icon('check', 15)}</span><span class="lr-name">Completed</span><span class="lr-n">${doneN}</span>${E.icon('right', 16)}</a>
        <div class="list-group">My Lists</div>
        ${s.lists
          .map((l) => `<a class="list-row ${sel === l.id ? 'sel' : ''}" href="#/tasks/${l.id}"><span class="lr-ic" style="--c:${l.color}">${E.icon('list', 15)}</span><span class="lr-name">${esc(l.name)}</span><span class="lr-n">${E.task.openCount((t) => t.listId === l.id)}</span>${E.icon('right', 16)}</a>`)
          .join('')}
        <button class="btn btn-plain add-list" data-act="add-list">${E.icon('plus', 16)}Add List</button>`;
    },

    listView(key, narrow) {
      const r = this.resolve(key);
      const s = E.db(), T = E.today();
      const showDone = r.completed || s.settings.showDoneTasks;
      const all = s.tasks.filter(r.filter);
      const open = r.completed ? [] : all.filter((t) => !t.done).sort(E.task.sort);
      const done = all.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
      const showList = r.smart;

      let body = '';
      if (key === 'scheduled' || key === 'today') {
        const groups = {};
        open.forEach((t) => {
          const g = t.due < T ? 'Overdue' : E.relDay(t.due);
          (groups[g] = groups[g] || []).push(t);
        });
        body = Object.entries(groups)
          .map(([g, list]) => `<div class="task-group ${g === 'Overdue' ? 'danger' : ''}">${g}</div>${list.map((t) => this.row(t, showList)).join('')}`)
          .join('');
      } else body = open.map((t) => this.row(t, showList)).join('');

      const empty = !open.length && !r.completed
        ? `<div class="all-clear"><div class="ac-ic" style="--c:${r.color}">${E.icon('check', 30)}</div><h3>All clear</h3><p>No open tasks here.</p></div>`
        : '';

      return `<div class="tlist" style="--lc:${r.color}">
        <div class="tl-head">
          ${narrow ? `<a class="back-btn" href="#/tasks">${E.icon('left', 20)}Lists</a>` : ''}
          <h2 class="tl-title">${esc(r.label)}</h2>
          <span class="tl-count">${r.completed ? done.length : open.length}</span>
          <button class="icon-btn" data-act="list-menu" aria-label="List options">${E.icon('dots', 20)}</button>
        </div>
        ${r.completed ? '' : `<div class="task-add">${E.icon('plus', 18)}<input data-field="new-task" placeholder="New task — press Enter to add" aria-label="New task"></div>`}
        <div class="tasks">${body}${empty}</div>
        ${
          done.length && showDone
            ? `<div class="task-group">${r.completed ? '' : 'Completed'}</div><div class="tasks done-list">${done.map((t) => this.row(t, true)).join('')}</div>`
            : done.length && !r.completed
              ? `<button class="btn btn-plain sm show-done" data-act="toggle-done">${done.length} completed · Show</button>`
              : r.completed && !done.length
                ? `<div class="card-empty center">Nothing completed yet.</div>`
                : ''
        }
      </div>`;
    },

    row(t, showList) {
      const T = E.today(), l = E.task.list(t.listId);
      const due = t.due
        ? `<span class="due ${!t.done && t.due < T ? 'danger' : t.due === T ? 'accent' : ''}">${E.icon('calendar', 12)}${E.relDay(t.due)}</span>`
        : '';
      return `<div class="task ${t.done ? 'done' : ''}" data-id="${t.id}">
        ${ui.check(t.done, `data-act="toggle" data-id="${t.id}"`, l ? l.color : 'var(--accent)')}
        <button class="task-main" data-act="edit" data-id="${t.id}">
          <div class="task-title">${t.priority ? `<span class="prio">${'!'.repeat(t.priority)}</span>` : ''}${esc(t.title)}</div>
          ${t.notes ? `<div class="task-notes">${esc(t.notes)}</div>` : ''}
          ${due || (showList && l) ? `<div class="task-meta">${due}${showList && l ? `<span class="tm-list"><i style="background:${l.color}"></i>${esc(l.name)}</span>` : ''}</div>` : ''}
        </button>
        ${t.flagged ? `<span class="flag-ic">${E.icon('flag', 15)}</span>` : ''}
      </div>`;
    },

    defaults() {
      const s = E.db(), key = this.currentKey, T = E.today();
      const r = key && this.resolve(key);
      return {
        listId: r && !r.smart ? r.list.id : s.lists[0].id,
        due: key === 'today' || key === 'scheduled' ? T : null,
        flagged: key === 'flagged',
      };
    },

    edit(id) {
      const s = E.db();
      const existing = id ? s.tasks.find((t) => t.id === id) : null;
      const d = existing ? { ...existing } : { id: E.uid(), title: '', notes: '', priority: 0, done: false, doneAt: null, createdAt: Date.now(), ...this.defaults() };
      const T = E.today();
      const quick = [['Today', T], ['Tomorrow', E.addDays(T, 1)], ['Next week', E.addDays(E.weekStartKey(T), 7)], ['None', '']];

      const body = () => `
        <div class="form-group list-group-inset">
          <input class="field-input big bare pad" data-f="title" placeholder="Title" value="${esc(d.title)}" ${existing ? '' : 'autofocus'} aria-label="Title">
          <textarea class="field-input bare pad" data-f="notes" rows="2" placeholder="Notes" aria-label="Notes">${esc(d.notes)}</textarea>
        </div>
        <div class="form-label">Due date</div>
        <div class="form-group list-group-inset">
          <div class="form-row"><span class="form-row-title">${E.icon('calendar', 16)} Date</span><input type="date" class="field-date" data-f="due" value="${d.due || ''}" aria-label="Due date"></div>
        </div>
        <div class="chips-row">${quick.map(([l, v]) => `<button class="chip ${(d.due || '') === v ? 'chip-on' : ''}" data-act="due" data-value="${v}">${l}</button>`).join('')}</div>
        <div class="form-label">Priority</div>
        ${ui.seg('prio', PRIO, String(d.priority || 0), 'full')}
        <div class="form-group list-group-inset">
          <div class="form-row"><span class="form-row-title">${E.icon('flag', 16)} Flagged</span>${ui.toggle('data-f="flagged"', d.flagged)}</div>
        </div>
        <div class="form-label">List</div>
        <div class="chips-row">${s.lists.map((l) => `<button class="chip ${d.listId === l.id ? 'chip-on' : ''}" data-act="list" data-value="${l.id}"><i class="dot" style="background:${l.color}"></i>${esc(l.name)}</button>`).join('')}</div>
        ${existing ? `<button class="btn btn-danger wide" data-act="delete">${E.icon('trash', 16)}Delete Task</button>` : ''}`;

      ui.sheet({
        title: existing ? 'Details' : 'New Task',
        done: existing ? 'Save' : 'Add',
        size: 'sm',
        body: body(),
        onInput(el) {
          if (el.dataset.f === 'title' || el.dataset.f === 'notes') d[el.dataset.f] = el.value;
        },
        onChange(el, e, api) {
          if (el.dataset.f === 'due') {
            d.due = el.value || null;
            api.setBody(body());
          }
          if (el.dataset.f === 'flagged') d.flagged = el.checked;
        },
        actions: {
          due(el, e, api) { d.due = el.dataset.value || null; api.setBody(body()); },
          prio(el, e, api) { d.priority = +el.dataset.value; api.setBody(body()); },
          list(el, e, api) { d.listId = el.dataset.value; api.setBody(body()); },
          async delete(el, e, api) {
            const ok = await ui.confirm({ title: 'Delete this task?', ok: 'Delete', destructive: true });
            if (!ok) return;
            api.close();
            E.commit((st) => (st.tasks = st.tasks.filter((t) => t.id !== existing.id)));
            ui.toast('Task deleted', 'trash');
          },
        },
        onDone() {
          if (!d.title.trim()) {
            ui.toast('Give the task a title', 'info');
            return false;
          }
          d.title = d.title.trim();
          E.commit((st) => {
            if (existing) Object.assign(existing, d);
            else st.tasks.push(d);
          });
          if (!existing) ui.toast('Task added');
        },
      });
    },

    listSheet(list) {
      const d = list ? { ...list } : { id: E.uid(), name: '', color: E.COLORS[E.db().lists.length % E.COLORS.length] };
      const body = () => `
        <div class="list-preview"><span class="lp-ic" style="--c:${d.color}">${E.icon('list', 30)}</span></div>
        <input class="field-input big center" data-f="name" placeholder="List name" value="${esc(d.name)}" autofocus maxlength="40">
        <div class="form-label">Color</div>${ui.colorRow(d.color)}`;
      ui.sheet({
        title: list ? 'Edit List' : 'New List',
        done: list ? 'Save' : 'Add',
        size: 'sm',
        body: body(),
        onInput(el) { d.name = el.value; },
        actions: {
          'pick-color'(el, e, api) {
            d.color = el.dataset.value;
            api.$('.lp-ic').style.setProperty('--c', d.color);
            api.$$('.color-opt').forEach((x) => x.classList.toggle('on', x === el));
          },
        },
        onDone() {
          if (!d.name.trim()) {
            ui.toast('Name your list', 'info');
            return false;
          }
          d.name = d.name.trim();
          E.commit((s) => {
            if (list) Object.assign(list, d);
            else s.lists.push(d);
          });
          if (!list) location.hash = `#/tasks/${d.id}`;
        },
      });
    },

    actions: {
      new: () => V.edit(),
      edit: (el) => V.edit(el.dataset.id),
      toggle: (el) => E.shared.completeTask(el),
      'add-list': () => V.listSheet(),
      'toggle-done'() {
        E.commit((s) => (s.settings.showDoneTasks = !s.settings.showDoneTasks));
      },
      'list-menu'(el) {
        const r = V.resolve(V.currentKey);
        const s = E.db();
        const items = [];
        if (!r.completed)
          items.push({ label: s.settings.showDoneTasks ? 'Hide completed' : 'Show completed', icon: 'check', onClick: () => E.commit((st) => (st.settings.showDoneTasks = !st.settings.showDoneTasks)) });
        items.push({
          label: 'Clear completed', icon: 'archive',
          onClick: async () => {
            const n = s.tasks.filter((t) => t.done && r.filter(t)).length;
            if (!n) return ui.toast('Nothing to clear', 'info');
            const ok = await ui.confirm({ title: `Clear ${E.plural(n, 'completed task')}?`, ok: 'Clear', destructive: true });
            if (ok) E.commit((st) => (st.tasks = st.tasks.filter((t) => !(t.done && r.filter(t)))));
          },
        });
        if (!r.smart) {
          items.push('-', { label: 'Edit list', icon: 'edit', onClick: () => V.listSheet(r.list) });
          if (s.lists.length > 1)
            items.push({
              label: 'Delete list', icon: 'trash', danger: true,
              onClick: async () => {
                const n = s.tasks.filter((t) => t.listId === r.list.id).length;
                const ok = await ui.confirm({ title: `Delete “${r.list.name}”?`, message: n ? `This will also delete ${E.plural(n, 'task')} in this list.` : '', ok: 'Delete', destructive: true });
                if (!ok) return;
                E.commit((st) => {
                  st.lists = st.lists.filter((l) => l.id !== r.list.id);
                  st.tasks = st.tasks.filter((t) => t.listId !== r.list.id);
                });
                location.hash = '#/tasks';
              },
            });
        }
        ui.menu(el, items);
      },
    },

    onKey(el, e) {
      if (el.dataset.field === 'new-task' && e.key === 'Enter' && el.value.trim()) {
        const t = { id: E.uid(), title: el.value.trim(), notes: '', priority: 0, done: false, doneAt: null, createdAt: Date.now(), ...this.defaults() };
        E.app.focusAfter('[data-field="new-task"]');
        E.commit((s) => s.tasks.push(t));
      }
    },
  });
})();
