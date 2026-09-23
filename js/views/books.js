/* Ember — Books (reading list) */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  const STATUS = [
    { value: 'reading', label: 'Reading' },
    { value: 'want', label: 'Want to Read' },
    { value: 'finished', label: 'Finished' },
  ];

  const find = (id) => E.db().books.find((b) => b.id === id);

  function celebrateFinish(b) {
    ui.confetti();
    const Y = new Date().getFullYear();
    const n = E.book.finishedIn(Y).length, goal = E.db().settings.readingGoal;
    ui.toast(n === goal ? `Reading goal reached — ${goal} books in ${Y}!` : `Finished “${b.title}”`, 'trophy');
  }

  function applyStatus(d, status) {
    const T = E.today();
    d.status = status;
    if (status === 'reading' && !d.startedAt) d.startedAt = T;
    if (status === 'finished') {
      if (!d.finishedAt) d.finishedAt = T;
      if (!d.startedAt) d.startedAt = T;
      if (d.pages) d.currentPage = d.pages;
    }
    if (status !== 'finished') d.finishedAt = null;
    if (status === 'want') {
      d.startedAt = null;
      d.currentPage = 0;
    }
  }

  const V = (E.views.books = {
    title: 'Books',
    st: { tab: 'reading', q: '' },

    render() {
      const s = E.db(), Y = new Date().getFullYear();
      const finishedY = E.book.finishedIn(Y);
      const goal = s.settings.readingGoal;
      const yearDays = (Y % 4 === 0 && Y % 100 !== 0) || Y % 400 === 0 ? 366 : 365;
      const expected = (goal * E.dayOfYear()) / yearDays;
      const ahead = Math.round(finishedY.length - expected);
      const pagesY = finishedY.reduce((a, b) => a + (b.pages || 0), 0);
      const counts = { reading: 0, want: 0, finished: 0 };
      s.books.forEach((b) => counts[b.status]++);
      if (!s.books.some((b) => b.status === this.st.tab) && s.books.length && !this.st.touched) this.st.tab = counts.reading ? 'reading' : counts.want ? 'want' : 'finished';

      const q = this.st.q.trim().toLowerCase();
      let list = s.books.filter((b) => b.status === this.st.tab && (!q || `${b.title} ${b.author}`.toLowerCase().includes(q)));
      const sorters = {
        reading: (a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''),
        want: (a, b) => b.createdAt - a.createdAt,
        finished: (a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''),
      };
      list.sort(sorters[this.st.tab]);

      const note =
        finishedY.length >= goal ? 'Goal complete — anything more is a bonus 🎉'
        : !finishedY.length ? `${E.plural(goal, 'book')} to go — finish one to get started`
        : ahead > 0 ? `${E.plural(ahead, 'book')} ahead of schedule`
        : ahead < 0 ? `${E.plural(-ahead, 'book')} behind schedule`
        : 'Right on schedule';

      let content;
      if (!s.books.length) {
        content = `<section class="card">${ui.empty({ icon: 'books', title: 'Build your library', text: 'Track what you are reading, what you want to read next, and everything you have finished.', action: 'Add a Book', actAttr: 'data-act="add"' })}</section>`;
      } else if (!list.length) {
        content = `<div class="card card-empty center">${q ? 'No books match your search.' : { reading: 'You are not reading anything right now. Pick something from Want to Read!', want: 'Your want-to-read list is empty.', finished: 'No finished books yet.' }[this.st.tab]}</div>`;
      } else if (this.st.tab === 'reading') {
        content = `<div class="read-cards">${list.map((b) => this.readCard(b)).join('')}</div>`;
      } else {
        content = `<div class="book-grid">${list.map((b) => this.tile(b)).join('')}</div>`;
      }

      return `<div class="page page-books">
        <header class="page-head">
          <div><h1 class="large-title">Books</h1><div class="subtitle">${E.plural(s.books.length, 'book')} in your library · ${pagesY.toLocaleString('en-US')} pages read in ${Y}</div></div>
          <div class="head-actions"><button class="btn btn-primary" data-act="add">${E.icon('plus', 17)}<span>Add Book</span></button></div>
        </header>

        <section class="card challenge">
          <div class="ch-ring">${ui.ring(finishedY.length / goal, { size: 104, stroke: 11 })}<div class="ch-ring-txt"><b>${finishedY.length}</b><span>of ${goal}</span></div></div>
          <div class="ch-main">
            <div class="eyebrow">${Y} Reading Challenge</div>
            <div class="ch-title">${finishedY.length} of ${E.plural(goal, 'book')} read</div>
            <div class="row-sub">${note}</div>
            <button class="btn btn-plain sm" data-act="goal">${E.icon('edit', 14)}Change goal</button>
          </div>
          ${finishedY.length ? `<div class="ch-covers">${finishedY.slice(-6).reverse().map((b) => `<button class="cover-btn" data-act="open" data-id="${b.id}" data-tip="${esc(b.title)}">${ui.cover(b, 'xs')}</button>`).join('')}</div>` : ''}
        </section>

        <div class="toolbar">
          ${ui.seg('tab', STATUS.map((x) => ({ value: x.value, label: `${x.label} <span class="seg-n">${counts[x.value]}</span>` })), this.st.tab)}
          <label class="search-field">${E.icon('search', 16)}<input type="search" data-field="bsearch" placeholder="Search library" value="${esc(this.st.q)}" aria-label="Search library"></label>
        </div>
        <div class="books-content">${content}</div>
      </div>`;
    },

    readCard(b) {
      const p = E.book.pct(b);
      return `<article class="read-card card">
        <button class="cover-btn" data-act="open" data-id="${b.id}" aria-label="Open ${esc(b.title)}">${ui.cover(b, 'md')}</button>
        <div class="rc-main">
          <div class="rc-title">${esc(b.title)}</div>
          <div class="rc-author">${esc(b.author)}</div>
          <div class="rc-progress">${ui.progress(p)}<span>${E.pct(p)}</span></div>
          <div class="row-sub">${b.pages ? `Page ${b.currentPage || 0} of ${b.pages}` : 'Add a page count to track progress'}${b.startedAt ? ` · Started ${E.fmtShort(b.startedAt)}` : ''}</div>
          <div class="rc-btns">
            <button class="btn btn-tinted sm" data-act="progress" data-id="${b.id}">${E.icon('edit', 14)}Update progress</button>
            <button class="btn btn-plain sm" data-act="finish" data-id="${b.id}">${E.icon('check', 14)}Finished</button>
          </div>
        </div>
      </article>`;
    },

    tile(b) {
      return `<button class="book-tile" data-act="open" data-id="${b.id}">
        ${ui.cover(b)}
        <div class="bt-title">${esc(b.title)}</div>
        <div class="bt-author">${esc(b.author)}</div>
        ${b.status === 'finished' ? `<div class="bt-meta">${b.rating ? ui.stars(b.rating, '', 12) : '<span class="muted small">Not rated</span>'}</div>` : ''}
      </button>`;
    },

    /* ----- Add book (with Open Library search) ----- */
    addBook(status) {
      const d = { title: '', author: '', pages: '', cover: '', status: status || (V.st.tab === 'finished' ? 'finished' : V.st.tab) || 'want' };
      let results = [], ctrl = null;

      const resultsHtml = (state, msg) => {
        if (state === 'loading') return `<div class="ol-msg"><span class="spinner"></span>Searching Open Library…</div>`;
        if (state === 'error') return `<div class="ol-msg">${esc(msg)}</div>`;
        if (!results.length) return state === 'none' ? `<div class="ol-msg">No results. You can add the book manually below.</div>` : '';
        return results
          .map(
            (r, i) => `<button class="ol-item" data-act="pick" data-i="${i}">
            ${ui.cover(r, 'xs')}
            <div class="row-main"><div class="row-title">${esc(r.title)}</div><div class="row-sub">${esc([r.author, r.year, r.pages ? r.pages + ' pages' : ''].filter(Boolean).join(' · '))}</div></div>
            ${E.icon('plus', 18)}
          </button>`
          )
          .join('');
      };

      const search = E.debounce(async (q, api) => {
        const box = api.$('.ol-results');
        if (!q || q.length < 2) {
          results = [];
          box.innerHTML = '';
          return;
        }
        if (ctrl) ctrl.abort();
        ctrl = new AbortController();
        box.innerHTML = resultsHtml('loading');
        try {
          const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,first_publish_year,number_of_pages_median,cover_i`, { signal: ctrl.signal });
          const json = await res.json();
          results = (json.docs || []).map((x) => ({
            title: x.title,
            author: (x.author_name || [])[0] || '',
            year: x.first_publish_year || '',
            pages: x.number_of_pages_median || '',
            cover: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg` : '',
          }));
          box.innerHTML = resultsHtml(results.length ? 'ok' : 'none');
        } catch (err) {
          if (err.name === 'AbortError') return;
          results = [];
          box.innerHTML = resultsHtml('error', 'Could not reach Open Library (are you offline?). Add the book manually below.');
        }
      }, 380);

      const preview = () => `<div class="add-preview">${ui.cover(d, 'md')}</div>`;

      ui.sheet({
        title: 'Add Book',
        done: 'Add',
        size: 'md',
        body: `
          <label class="search-field big">${E.icon('search', 18)}<input type="search" data-f="q" placeholder="Search by title, author or ISBN" autofocus aria-label="Search Open Library"></label>
          <div class="ol-results"></div>
          <div class="add-grid">
            <div class="add-preview-wrap">${preview()}</div>
            <div class="form-group list-group-inset grow">
              <div class="form-row"><span class="form-row-title">Title</span><input class="row-input" data-f="title" placeholder="Required"></div>
              <div class="form-row"><span class="form-row-title">Author</span><input class="row-input" data-f="author" placeholder="Optional"></div>
              <div class="form-row"><span class="form-row-title">Pages</span><input class="row-input" type="number" min="0" data-f="pages" placeholder="0"></div>
            </div>
          </div>
          <div class="form-label">Shelf</div>
          <div class="status-seg">${ui.seg('status', STATUS, d.status, 'full')}</div>`,
        onInput(el, e, api) {
          const f = el.dataset.f;
          if (f === 'q') return search(el.value.trim(), api);
          if (f === 'title' || f === 'author' || f === 'pages') {
            d[f] = el.value;
            if (f !== 'pages') api.$('.add-preview-wrap').innerHTML = preview();
          }
        },
        actions: {
          pick(el, e, api) {
            const r = results[+el.dataset.i];
            Object.assign(d, { title: r.title, author: r.author, pages: r.pages, cover: r.cover });
            api.$('[data-f="title"]').value = d.title;
            api.$('[data-f="author"]').value = d.author;
            api.$('[data-f="pages"]').value = d.pages;
            api.$('.add-preview-wrap').innerHTML = preview();
            api.$$('.ol-item').forEach((x) => x.classList.toggle('on', x === el));
          },
          status(el, e, api) {
            d.status = el.dataset.value;
            api.$('.status-seg').innerHTML = ui.seg('status', STATUS, d.status, 'full');
          },
        },
        onDone() {
          if (!String(d.title).trim()) {
            ui.toast('Add a title (or pick a search result)', 'info');
            return false;
          }
          const b = { id: E.uid(), title: String(d.title).trim(), author: String(d.author).trim(), pages: Math.max(0, parseInt(d.pages, 10) || 0), currentPage: 0, status: 'want', rating: 0, cover: d.cover, startedAt: null, finishedAt: null, notes: '', quotes: [], createdAt: Date.now() };
          applyStatus(b, d.status);
          V.st.tab = b.status;
          E.commit((s) => s.books.push(b));
          ui.toast('Added to your library');
          if (b.status === 'finished') setTimeout(() => V.openBook(b.id), 350);
        },
      });
    },

    /* ----- Book detail ----- */
    openBook(id) {
      const b = find(id);
      if (!b) return;
      const d = JSON.parse(JSON.stringify(b));
      d.quotes = d.quotes || [];

      const progressBlock = () => {
        const p = d.pages ? d.currentPage / d.pages : 0;
        return `<div class="progress-block">
          <div class="pb-top"><span>Page <b data-cp>${d.currentPage || 0}</b> of ${d.pages || '—'}</span><span data-pp>${E.pct(p)}</span></div>
          ${d.pages ? `<input type="range" class="range" min="0" max="${d.pages}" value="${d.currentPage || 0}" data-f="currentPage" style="--p:${(p * 100).toFixed(1)}%" aria-label="Current page">` : '<div class="form-note">Set the number of pages below to track progress.</div>'}
          <div class="pb-btns">${[10, 25, 50].map((n) => `<button class="chip" data-act="pages" data-delta="${n}">+${n}</button>`).join('')}<button class="chip chip-on" data-act="finish">${E.icon('check', 14)}Mark finished</button></div>
        </div>`;
      };

      const body = () => `
        <div class="book-hero">
          ${ui.cover(d, 'lg')}
          <div class="bh-info">
            <input class="field-input bare big" data-f="title" value="${esc(d.title)}" aria-label="Title">
            <input class="field-input bare sub" data-f="author" value="${esc(d.author)}" placeholder="Author" aria-label="Author">
            <div class="rate-row"><span class="muted small">Your rating</span>${ui.stars(d.rating || 0, 'rate', 22)}</div>
          </div>
        </div>
        ${ui.seg('status', STATUS, d.status, 'full')}
        ${d.status === 'reading' ? progressBlock() : ''}
        <div class="form-group list-group-inset">
          <div class="form-row"><span class="form-row-title">Pages</span><input class="row-input" type="number" min="0" data-f="pages" value="${d.pages || ''}" placeholder="0"></div>
          ${d.status !== 'want' ? `<div class="form-row"><span class="form-row-title">Started</span><input type="date" class="field-date" data-f="startedAt" value="${d.startedAt || ''}"></div>` : ''}
          ${d.status === 'finished' ? `<div class="form-row"><span class="form-row-title">Finished</span><input type="date" class="field-date" data-f="finishedAt" value="${d.finishedAt || ''}"></div>` : ''}
          <div class="form-row"><span class="form-row-title">Cover URL</span><input class="row-input" data-f="cover" value="${esc(d.cover || '')}" placeholder="https://…"></div>
        </div>
        <div class="form-label">Notes</div>
        <textarea class="field-input" data-f="notes" rows="4" placeholder="Thoughts, takeaways, favorite moments…">${esc(d.notes || '')}</textarea>
        <div class="form-label">Favorite quotes</div>
        <div class="quotes">${d.quotes.map((q, i) => `<blockquote class="bq"><span>${esc(q)}</span><button class="icon-btn sm" data-act="rm-quote" data-i="${i}" aria-label="Remove quote">${E.icon('x', 14)}</button></blockquote>`).join('')}</div>
        <div class="ms-row add"><span class="ms-plus">${E.icon('quote', 15)}</span><input class="ms-input" data-f="quote-new" placeholder="Add a quote and press Enter" aria-label="New quote"></div>
        <button class="btn btn-danger wide" data-act="delete">${E.icon('trash', 16)}Remove from Library</button>`;

      const syncProgress = (api) => {
        const p = d.pages ? d.currentPage / d.pages : 0;
        const r = api.$('[data-f="currentPage"]');
        if (r) {
          r.value = d.currentPage;
          r.style.setProperty('--p', (p * 100).toFixed(1) + '%');
        }
        const cp = api.$('[data-cp]'), pp = api.$('[data-pp]');
        if (cp) cp.textContent = d.currentPage;
        if (pp) pp.textContent = E.pct(p);
      };

      ui.sheet({
        title: 'Book',
        body: body(),
        done: 'Save',
        size: 'md',
        mount(api) {
          api.wrap.addEventListener('keydown', (e) => {
            if (e.target.dataset.f === 'quote-new' && e.key === 'Enter' && e.target.value.trim()) {
              e.preventDefault();
              d.quotes.push(e.target.value.trim());
              api.setBody(body());
              api.$('[data-f="quote-new"]').focus();
            }
          });
        },
        onInput(el, e, api) {
          const f = el.dataset.f;
          if (['title', 'author', 'notes', 'cover'].includes(f)) d[f] = el.value;
          if (f === 'pages') d.pages = Math.max(0, parseInt(el.value, 10) || 0);
          if (f === 'currentPage') {
            d.currentPage = +el.value;
            syncProgress(api);
          }
        },
        onChange(el, e, api) {
          const f = el.dataset.f;
          if (f === 'startedAt' || f === 'finishedAt') d[f] = el.value || null;
          if (f === 'pages' || f === 'cover') {
            d.currentPage = Math.min(d.currentPage || 0, d.pages || 0);
            api.setBody(body());
          }
        },
        actions: {
          status(el, e, api) {
            applyStatus(d, el.dataset.value);
            api.setBody(body());
          },
          rate(el, e, api) {
            const v = +el.dataset.value;
            d.rating = d.rating === v ? 0 : v;
            api.$$('.stars .star').forEach((s, i) => s.classList.toggle('on', i < d.rating));
          },
          pages(el, e, api) {
            d.currentPage = E.clamp((d.currentPage || 0) + +el.dataset.delta, 0, d.pages || Infinity);
            syncProgress(api);
          },
          finish(el, e, api) {
            applyStatus(d, 'finished');
            api.setBody(body());
          },
          'rm-quote'(el, e, api) {
            d.quotes.splice(+el.dataset.i, 1);
            api.setBody(body());
          },
          async delete(el, e, api) {
            const ok = await ui.confirm({ title: 'Remove this book?', message: `“${b.title}” and your notes will be removed.`, ok: 'Remove', destructive: true });
            if (!ok) return;
            api.close();
            E.commit((s) => (s.books = s.books.filter((x) => x.id !== b.id)));
            ui.toast('Book removed', 'trash');
          },
        },
        onDone(api) {
          const q = api.$('[data-f="quote-new"]');
          if (q && q.value.trim()) d.quotes.push(q.value.trim());
          if (!String(d.title).trim()) {
            ui.toast('A book needs a title', 'info');
            return false;
          }
          const finishedNow = d.status === 'finished' && b.status !== 'finished';
          E.commit(() => Object.assign(b, d, { title: d.title.trim(), author: (d.author || '').trim() }));
          if (finishedNow) celebrateFinish(b);
          else ui.toast('Saved');
        },
      });
    },

    /* ----- Quick progress update ----- */
    progressSheet(id) {
      const b = find(id);
      if (!b) return;
      let cp = b.currentPage || 0;
      const body = () => {
        const p = b.pages ? cp / b.pages : 0;
        return `<div class="prog-sheet">
          ${ui.cover(b, 'md')}
          <div class="ps-title">${esc(b.title)}</div>
          <div class="ps-page"><input type="number" class="ps-input" min="0" ${b.pages ? `max="${b.pages}"` : ''} value="${cp}" data-f="cp" aria-label="Current page"><span>/ ${b.pages || '?'}</span></div>
          ${b.pages ? `<input type="range" class="range" min="0" max="${b.pages}" value="${cp}" data-f="range" style="--p:${(p * 100).toFixed(1)}%" aria-label="Current page">` : ''}
          <div class="pb-btns center">${[5, 10, 25, 50].map((n) => `<button class="chip" data-act="add" data-delta="${n}">+${n}</button>`).join('')}</div>
          <div class="muted small" data-pp>${b.pages ? `${E.pct(p)} · ${Math.max(0, b.pages - cp)} pages left` : ''}</div>
        </div>`;
      };
      const sync = (api) => {
        const p = b.pages ? cp / b.pages : 0;
        const inp = api.$('[data-f="cp"]'), r = api.$('[data-f="range"]'), pp = api.$('[data-pp]');
        if (inp && document.activeElement !== inp) inp.value = cp;
        if (r) {
          r.value = cp;
          r.style.setProperty('--p', (p * 100).toFixed(1) + '%');
        }
        if (pp && b.pages) pp.textContent = `${E.pct(p)} · ${Math.max(0, b.pages - cp)} pages left`;
      };
      ui.sheet({
        title: 'Update Progress',
        body: body(),
        size: 'sm',
        onInput(el, e, api) {
          cp = Math.max(0, parseInt(el.value, 10) || 0);
          if (b.pages) cp = Math.min(cp, b.pages);
          sync(api);
        },
        actions: {
          add(el, e, api) {
            cp = b.pages ? Math.min(b.pages, cp + +el.dataset.delta) : cp + +el.dataset.delta;
            sync(api);
          },
        },
        onDone() {
          const finished = b.pages && cp >= b.pages;
          E.commit(() => {
            b.currentPage = cp;
            if (b.status === 'want' && cp > 0) applyStatus(b, 'reading');
            if (finished) applyStatus(b, 'finished');
          });
          if (finished) celebrateFinish(b);
          else ui.toast(`Page ${cp} — keep going!`, 'books');
        },
      });
    },

    actions: {
      add: () => V.addBook(),
      open: (el) => V.openBook(el.dataset.id),
      progress: (el) => V.progressSheet(el.dataset.id),
      finish(el) {
        const b = find(el.dataset.id);
        E.commit(() => applyStatus(b, 'finished'));
        celebrateFinish(b);
        setTimeout(() => V.openBook(b.id), 600);
      },
      tab(el) {
        V.st.tab = el.dataset.value;
        V.st.touched = true;
        E.app.render();
      },
      goal() {
        let g = E.db().settings.readingGoal;
        ui.sheet({
          title: 'Reading Goal',
          size: 'sm',
          body: `<div class="goal-sheet"><p class="muted">How many books do you want to read in ${new Date().getFullYear()}?</p><div class="big-stepper">${ui.stepper('g', g)}</div></div>`,
          actions: {
            g(el, e, api) {
              g = E.clamp(g + +el.dataset.delta * (e.shiftKey ? 5 : 1), 1, 365);
              api.$('.stepper-val').textContent = g;
            },
          },
          onDone() {
            E.commit((s) => (s.settings.readingGoal = g));
          },
        });
      },
    },

    onInput(el) {
      if (el.dataset.field === 'bsearch') {
        this.st.q = el.value;
        E.app.focusAfter('[data-field="bsearch"]');
        E.app.render();
      }
    },
  });
})();
