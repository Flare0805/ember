/* Ember — Journal */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  const V = (E.views.journal = {
    title: 'Journal',
    st: { q: '', mode: 'list', month: null, prompt: null },
    currentId: null,

    /** Drop entries that were created but never written in (keeps the one being edited). */
    cleanup(exceptId) {
      const s = E.db(), n = s.journal.length;
      s.journal = s.journal.filter((j) => j.id === exceptId || (j.title || '').trim() || (j.body || '').trim() || j.mood || (j.tags || []).length);
      if (s.journal.length !== n) E.store.save();
    },

    render(params) {
      const wide = E.app.wide();
      const id = params[0];
      this.cleanup(id);
      const all = E.journal.sorted();
      let sel = id ? all.find((j) => j.id === id) : null;
      if (!sel && wide) sel = all[0] || null;
      if (sel && sel.id !== this.currentId) this.st.prompt = null;
      this.currentId = sel ? sel.id : null;
      if (!wide) {
        return sel
          ? `<div class="page page-journal narrow">${this.editor(sel, true)}</div>`
          : `<div class="page page-journal narrow">${this.head(all)}${this.listPane(all)}</div>`;
      }
      return `<div class="page page-journal">
        ${this.head(all)}
        <div class="split">
          <aside class="split-list card">${this.listPane(all)}</aside>
          <section class="split-detail card" data-scroll-id="jdetail">${sel ? this.editor(sel, false) : this.emptyDetail(all)}</section>
        </div>
      </div>`;
    },

    head(all) {
      const streak = E.journal.streak();
      const words = all.reduce((a, j) => a + E.words(j.body), 0);
      return `<header class="page-head">
        <div><h1 class="large-title">Journal</h1>
          <div class="subtitle">${E.plural(all.length, 'entry', 'entries')} · ${streak}-day streak · ${words.toLocaleString('en-US')} words</div></div>
        <div class="head-actions"><button class="btn btn-primary" data-act="new">${E.icon('plus', 17)}<span>New Entry</span></button></div>
      </header>`;
    },

    listPane(all) {
      return `<div class="jl-tools">
          <label class="search-field">${E.icon('search', 16)}<input type="search" data-field="jsearch" placeholder="Search entries or #tags" value="${esc(this.st.q)}" aria-label="Search entries"></label>
          ${ui.seg('jmode', [{ value: 'list', label: 'List' }, { value: 'cal', label: 'Calendar' }], this.st.mode, 'full')}
        </div>
        <div class="jl-scroll" data-scroll-id="jlist">
          ${this.st.mode === 'cal' ? this.calendar(all) : ''}
          <div class="jlist">${this.listItems(all)}</div>
        </div>`;
    },

    filtered(all) {
      let list = all;
      const q = this.st.q.trim().toLowerCase();
      if (q) {
        if (q.startsWith('#')) list = list.filter((j) => (j.tags || []).some((t) => t.includes(q.slice(1))));
        else list = list.filter((j) => `${j.title} ${j.body} ${(j.tags || []).join(' ')}`.toLowerCase().includes(q));
      }
      if (this.st.mode === 'cal') list = list.filter((j) => j.date.startsWith(this.month()));
      return list;
    },

    listItems(all) {
      const list = this.filtered(all);
      if (!all.length) return `<div class="list-empty">${E.icon('journal', 22)}<p>Your journal is empty.<br>Tap <b>New Entry</b> to write your first page.</p></div>`;
      if (!list.length) return `<div class="list-empty"><p>${this.st.mode === 'cal' ? 'No entries this month.' : 'No matching entries.'}</p></div>`;
      let lastMonth = '', out = '';
      for (const j of list) {
        const m = j.date.slice(0, 7);
        if (m !== lastMonth && this.st.mode !== 'cal') {
          const d = E.parse(j.date);
          out += `<div class="list-group">${E.MONTHS[d.getMonth()]} ${d.getFullYear()}</div>`;
          lastMonth = m;
        }
        out += this.item(j);
      }
      return out;
    },

    item(j) {
      const d = E.parse(j.date), mood = E.mood(j.mood);
      const excerpt = (j.body || '').replace(/\s+/g, ' ').slice(0, 120);
      return `<a class="jitem ${j.id === this.currentId ? 'sel' : ''}" href="#/journal/${j.id}" data-id="${j.id}">
        <div class="jdate"><span class="jday">${d.getDate()}</span><span class="jwd">${E.DAY_SHORT[d.getDay()]}</span></div>
        <div class="jmain">
          <div class="jtitle">${esc(j.title || (excerpt ? excerpt.split(' ').slice(0, 6).join(' ') : 'Untitled'))}${j.favorite ? `<span class="jfav">${E.icon('star', 12)}</span>` : ''}</div>
          <div class="jexcerpt">${esc(excerpt) || '<span class="muted">No text</span>'}</div>
          ${(j.tags || []).length ? `<div class="jtags">${j.tags.slice(0, 3).map((t) => `<span>#${esc(t)}</span>`).join('')}</div>` : ''}
        </div>
        ${mood ? `<span class="jmood" title="${mood.label}">${mood.emoji}</span>` : ''}
      </a>`;
    },

    month() {
      return this.st.month || E.today().slice(0, 7);
    },

    calendar(all) {
      const m = this.month();
      const first = E.parse(m + '-01');
      const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      const off = (first.getDay() - E.weekStart() + 7) % 7;
      const byDay = {};
      all.forEach((j) => j.date.startsWith(m) && (byDay[j.date] = byDay[j.date] || []).push(j));
      const T = E.today();
      let cells = E.weekdayOrder().map((d) => `<span class="cal-wd">${E.DAY_LETTER[d]}</span>`).join('');
      for (let i = 0; i < off; i++) cells += '<span></span>';
      for (let d = 1; d <= days; d++) {
        const k = `${m}-${String(d).padStart(2, '0')}`;
        const has = byDay[k];
        const mood = E.journal.moodOn(k);
        const sel = has && has.some((j) => j.id === this.currentId);
        cells += `<button class="cal-day ${has ? 'has' : ''} ${k === T ? 'today' : ''} ${sel ? 'sel' : ''} ${k > T ? 'future' : ''}" data-act="cal-day" data-date="${k}"
          data-tip="${esc(E.fmt(k, { weekday: 'short', month: 'short', day: 'numeric' }))}${has ? ` · ${E.plural(has.length, 'entry', 'entries')}` : ' · Write'}">
          <span>${d}</span>${has ? `<i style="background:${mood ? E.mood(mood).color : 'var(--text-3)'}"></i>` : ''}</button>`;
      }
      return `<div class="cal">
        <div class="cal-head">
          <button class="icon-btn sm" data-act="cal-shift" data-delta="-1" aria-label="Previous month">${E.icon('left', 18)}</button>
          <span>${E.MONTHS[first.getMonth()]} ${first.getFullYear()}</span>
          <button class="icon-btn sm" data-act="cal-shift" data-delta="1" aria-label="Next month">${E.icon('right', 18)}</button>
        </div>
        <div class="cal-grid">${cells}</div>
      </div>`;
    },

    emptyDetail(all) {
      return ui.empty({
        icon: 'journal',
        title: all.length ? 'Select an entry' : 'Start your journal',
        text: all.length ? 'Pick an entry on the left, or start a new one.' : 'A few lines a day is enough. Capture moods, moments and ideas — it all stays on this device.',
        action: 'New Entry',
        actAttr: 'data-act="new"',
      });
    },

    editor(j, narrow) {
      const words = E.words(j.body);
      return `<div class="editor" data-id="${j.id}">
        <div class="ed-bar">
          ${narrow ? `<a class="back-btn" href="#/journal">${E.icon('left', 20)}Journal</a>` : ''}
          <span class="chip-btn date-chip">${E.icon('calendar', 15)}<span>${E.fmt(j.date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <input type="date" class="hidden-date" data-field="date" data-act="pick-date" value="${j.date}" aria-label="Entry date"></span>
          <div class="ed-bar-right">
            <button class="icon-btn ${j.favorite ? 'on' : ''}" data-act="fav" data-tip="${j.favorite ? 'Remove from favorites' : 'Add to favorites'}" aria-label="Favorite">${E.icon('star', 18)}</button>
            <button class="icon-btn" data-act="prompt" data-tip="Writing prompt" aria-label="Writing prompt">${E.icon('bulb', 18)}</button>
            <button class="icon-btn" data-act="more" aria-label="More options">${E.icon('dots', 20)}</button>
          </div>
        </div>
        <div class="ed-mood" role="group" aria-label="Mood">${E.MOODS.map(
          (m) => `<button class="mood-pill ${j.mood === m.v ? 'on' : ''}" data-act="emood" data-value="${m.v}" aria-pressed="${j.mood === m.v}"><span>${m.emoji}</span>${m.label}</button>`
        ).join('')}</div>
        ${this.st.prompt != null ? this.promptCard() : ''}
        <textarea class="ed-title" data-field="title" rows="1" placeholder="Title" autocomplete="off" aria-label="Title">${esc(j.title)}</textarea>
        <textarea class="ed-body" data-field="body" placeholder="What's on your mind today?" aria-label="Entry text">${esc(j.body)}</textarea>
        <div class="ed-tags">
          ${(j.tags || []).map((t) => `<span class="tag">#${esc(t)}<button data-act="rm-tag" data-value="${esc(t)}" aria-label="Remove tag ${esc(t)}">${E.icon('x', 12)}</button></span>`).join('')}
          <input class="tag-input" data-field="tag" placeholder="Add tag…" aria-label="Add tag">
        </div>
        <div class="ed-foot"><span data-wc>${E.plural(words, 'word')}</span><span class="sep">·</span><span data-saved>Edited ${E.timeAgo(j.updatedAt || j.createdAt)}</span></div>
      </div>`;
    },

    promptCard() {
      return `<div class="prompt-card">
        <span class="prompt-ic">${E.icon('bulb', 18)}</span>
        <div class="prompt-text">${esc(E.PROMPTS[this.st.prompt])}</div>
        <div class="prompt-actions">
          <button class="btn btn-plain sm" data-act="prompt-shuffle">Shuffle</button>
          <button class="btn btn-tinted sm" data-act="prompt-use">Use</button>
          <button class="icon-btn sm" data-act="prompt-close" aria-label="Close prompt">${E.icon('x', 16)}</button>
        </div>
      </div>`;
    },

    cur() {
      return E.db().journal.find((j) => j.id === this.currentId);
    },

    newEntry(date) {
      const j = { id: E.uid(), date: date || E.today(), title: '', body: '', mood: null, tags: [], favorite: false, createdAt: Date.now(), updatedAt: Date.now() };
      E.db().journal.push(j);
      E.store.save();
      E.app.focusAfter('.ed-title');
      E.app.go(`#/journal/${j.id}`);
    },

    after(page) {
      page.querySelectorAll('.ed-body, .ed-title').forEach(ui.autoGrow);
    },

    markSaved: E.debounce(() => {
      const el = document.querySelector('[data-saved]');
      if (el) el.textContent = 'Saved';
    }, 700),

    actions: {
      new: () => V.newEntry(),
      jmode(el) {
        V.st.mode = el.dataset.value;
        if (V.st.mode === 'cal' && V.currentId) {
          const j = V.cur();
          if (j) V.st.month = j.date.slice(0, 7);
        }
        E.app.render();
      },
      'cal-shift'(el) {
        const d = E.parse(V.month() + '-01');
        d.setMonth(d.getMonth() + +el.dataset.delta);
        V.st.month = E.dkey(d).slice(0, 7);
        E.app.render();
      },
      'cal-day'(el) {
        const k = el.dataset.date;
        const list = E.journal.forDay(k);
        if (list.length) location.hash = `#/journal/${list[0].id}`;
        else V.newEntry(k);
      },
      fav() {
        E.commit(() => {
          const j = V.cur();
          j.favorite = !j.favorite;
        });
      },
      emood(el) {
        const v = +el.dataset.value;
        E.commit(() => {
          const j = V.cur();
          j.mood = j.mood === v ? null : v;
          j.updatedAt = Date.now();
        });
      },
      'pick-date'(el) {
        // The transparent date input covers the chip: phones open their native picker on tap,
        // desktop browsers need showPicker() because clicking the text part only focuses it.
        try {
          el.showPicker();
        } catch (e) { /* picker already open or unsupported */ }
      },
      'rm-tag'(el) {
        E.commit(() => {
          const j = V.cur();
          j.tags = j.tags.filter((t) => t !== el.dataset.value);
        });
      },
      prompt() {
        V.st.prompt = V.st.prompt == null ? Math.floor(Math.random() * E.PROMPTS.length) : null;
        E.app.render();
      },
      'prompt-shuffle'() {
        let n;
        do n = Math.floor(Math.random() * E.PROMPTS.length);
        while (n === V.st.prompt && E.PROMPTS.length > 1);
        V.st.prompt = n;
        E.app.render();
      },
      'prompt-use'() {
        const p = E.PROMPTS[V.st.prompt];
        V.st.prompt = null;
        E.commit(() => {
          const j = V.cur();
          j.body = (j.body.trim() ? j.body.replace(/\s+$/, '') + '\n\n' : '') + p + '\n';
          if (!j.title.trim()) j.title = p.replace(/\?$/, '');
          j.updatedAt = Date.now();
        });
        const ta = document.querySelector('.ed-body');
        if (ta) {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
      },
      'prompt-close'() {
        V.st.prompt = null;
        E.app.render();
      },
      more(el) {
        const j = V.cur();
        ui.menu(el, [
          {
            label: 'Copy text', icon: 'journal',
            onClick: () => {
              navigator.clipboard && navigator.clipboard.writeText(`${j.title}\n${E.fmtLong(j.date)}\n\n${j.body}`).then(() => ui.toast('Copied to clipboard'));
            },
          },
          { label: 'New entry for this day', icon: 'plus', onClick: () => V.newEntry(j.date) },
          '-',
          {
            label: 'Delete entry', icon: 'trash', danger: true,
            onClick: async () => {
              const ok = await ui.confirm({ title: 'Delete this entry?', message: 'This cannot be undone.', ok: 'Delete', destructive: true });
              if (!ok) return;
              E.db().journal = E.db().journal.filter((x) => x.id !== j.id);
              E.store.save();
              V.currentId = null;
              E.app.go('#/journal');
              E.app.render();
              ui.toast('Entry deleted', 'trash');
            },
          },
        ]);
      },
    },

    onInput(el) {
      const f = el.dataset.field;
      if (f === 'jsearch') {
        this.st.q = el.value;
        const box = document.querySelector('.jlist');
        if (box) box.innerHTML = this.listItems(E.journal.sorted());
        return;
      }
      if (f === 'title' || f === 'body') {
        const j = this.cur();
        if (!j) return;
        j[f] = el.value;
        j.updatedAt = Date.now();
        E.commit(null, { silent: true });
        ui.autoGrow(el);
        if (f === 'body') {
          const wc = document.querySelector('[data-wc]');
          if (wc) wc.textContent = E.plural(E.words(j.body), 'word');
        }
        const saved = document.querySelector('[data-saved]');
        if (saved) saved.textContent = 'Saving…';
        this.markSaved();
        const item = document.querySelector(`.jitem[data-id="${j.id}"]`);
        if (item) {
          const tmp = document.createElement('div');
          tmp.innerHTML = this.item(j);
          item.replaceWith(tmp.firstElementChild);
        }
      }
    },

    onChange(el) {
      if (el.dataset.field === 'date' && el.value) {
        E.commit(() => {
          const j = this.cur();
          j.date = el.value;
          if (this.st.mode === 'cal') this.st.month = el.value.slice(0, 7);
        });
      }
    },

    onKey(el, e) {
      if (el.dataset.field === 'tag') {
        if ((e.key === 'Enter' || e.key === ',') && el.value.trim()) {
          e.preventDefault();
          const tag = el.value.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
          E.app.focusAfter('.tag-input');
          E.commit(() => {
            const j = this.cur();
            if (tag && !j.tags.includes(tag)) j.tags.push(tag);
          });
        } else if (e.key === 'Backspace' && !el.value) {
          const j = this.cur();
          if (j.tags.length) {
            E.app.focusAfter('.tag-input');
            E.commit(() => j.tags.pop());
          }
        }
      } else if (el.dataset.field === 'title' && e.key === 'Enter') {
        e.preventDefault();
        const ta = document.querySelector('.ed-body');
        if (ta) ta.focus();
      }
    },

    destroy() {
      this.cleanup(null);
    },
  });
})();
