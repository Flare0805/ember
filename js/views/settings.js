/* Ember — Settings & More */
(function () {
  'use strict';
  const E = window.Ember, esc = E.esc, ui = E.ui;

  const row = (icon, color, title, right, attrs = '') =>
    `<div class="set-row" ${attrs}><span class="set-ic" style="--c:${color}">${E.icon(icon, 16)}</span><span class="set-title">${title}</span><span class="set-right">${right}</span></div>`;

  const V = (E.views.settings = {
    title: 'Settings',

    render() {
      const s = E.db(), st = s.settings;
      const initial = (st.name || 'E').trim().charAt(0).toUpperCase() || 'E';
      const bytes = new Blob([JSON.stringify(s)]).size;
      const counts = [
        [s.journal.length, 'entries'], [s.habits.length, 'habits'], [s.goals.length, 'goals'],
        [s.books.length, 'books'], [s.tasks.length, 'tasks'], [s.focus.sessions.length, 'focus sessions'], [Object.keys(s.health).length, 'health days'],
      ];
      const backupAge = st.lastBackup ? E.timeAgo(st.lastBackup) : 'never';
      const needsBackup = !st.lastBackup || Date.now() - st.lastBackup > 30 * 864e5;

      return `<div class="page page-settings">
        <header class="page-head"><div><h1 class="large-title">Settings</h1></div></header>
        <div class="settings-wrap">
          <section class="card profile-card">
            <div class="avatar">${esc(initial)}</div>
            <div class="profile-main">
              <input class="field-input bare big" data-field="name" value="${esc(st.name)}" placeholder="Your name" aria-label="Your name" maxlength="40">
              <div class="row-sub">Used for your daily greeting</div>
            </div>
          </section>

          <div class="set-label">Appearance</div>
          <section class="set-group">
            ${row('moon', '#5E5CE6', 'Background', ui.seg('theme', [{ value: 'graphite', label: 'Graphite' }, { value: 'midnight', label: 'Midnight' }], st.theme, 'small'))}
            ${row('palette', 'var(--accent)', 'Accent color', `<div class="accent-opts">${Object.entries(E.ACCENTS)
              .map(([k, a]) => `<button class="accent-opt ${st.accent === k ? 'on' : ''}" data-act="accent" data-value="${k}" style="--c:${a.c}" data-tip="${a.label}" aria-label="${a.label}"></button>`)
              .join('')}</div>`)}
          </section>

          <div class="set-label">General</div>
          <section class="set-group">
            ${row('calendar', '#FF453A', 'Week starts on', ui.seg('weekstart', [{ value: '1', label: 'Monday' }, { value: '0', label: 'Sunday' }], String(st.weekStart), 'small'))}
            ${row('books', '#FF9F0A', 'Yearly reading goal', ui.stepper('reading', st.readingGoal, ' books'))}
            ${row('focus', '#FF5E3A', 'Focus timer', `<span class="muted">${st.focus.work} / ${st.focus.short} / ${st.focus.long} min</span>${E.icon('right', 16)}`, 'data-act="focus-settings" role="button" tabindex="0"')}
            ${row('watch', '#FF375F', 'Garmin sync', `<span class="muted">${st.healthImportedAt ? `imported ${E.timeAgo(st.healthImportedAt)}` : 'not set up'}</span>${E.icon('right', 16)}`, 'data-act="garmin" role="button" tabindex="0"')}
          </section>

          <div class="set-label">Your data</div>
          <section class="set-group">
            <div class="set-note ${needsBackup ? 'warn' : ''}">
              ${E.icon(needsBackup ? 'info' : 'database', 16)}
              <span>Everything is stored privately in this browser (${(bytes / 1024).toFixed(1)} KB). Last backup: <b>${backupAge}</b>. ${needsBackup ? 'Export a backup now and then so you never lose anything.' : ''}</span>
            </div>
            ${row('download', '#30D158', 'Export backup', `<span class="muted">.json</span>${E.icon('right', 16)}`, 'data-act="export" role="button" tabindex="0"')}
            ${row('upload', '#0A84FF', 'Import backup', `${E.icon('right', 16)}`, 'data-act="import" role="button" tabindex="0"')}
            ${row('sparkles', '#BF5AF2', 'Load sample data', `${E.icon('right', 16)}`, 'data-act="sample" role="button" tabindex="0"')}
            ${row('trash', '#FF453A', '<span class="danger">Erase all data</span>', '', 'data-act="erase" role="button" tabindex="0"')}
            <input type="file" accept="application/json,.json" class="hidden-file" data-field="import-file" tabindex="-1" aria-hidden="true">
          </section>
          <div class="set-foot">${counts.map(([n, l]) => `${n} ${l}`).join(' · ')}</div>

          <div class="set-label kbd-section">Keyboard shortcuts</div>
          <section class="set-group shortcuts kbd-section">
            ${[['Ctrl', 'K'], ['N'], ['1', '–', '9'], ['Space'], ['Esc']]
              .map((keys, i) => `<div class="set-row"><span class="set-title">${['Search everything', 'New item on the current page', 'Jump to a section', 'Start / pause the focus timer (Focus page)', 'Close a sheet or dialog'][i]}</span><span class="set-right">${keys.map((k) => (k === '–' ? '–' : `<kbd>${k}</kbd>`)).join(' ')}</span></div>`)
              .join('')}
          </section>

          <div class="about">
            <div class="about-logo">${E.icon('flame', 26)}</div>
            <b>Ember</b><span>Version 1.0 · Journal, habits, goals, books, tasks & focus in one place.</span>
          </div>
        </div>
      </div>`;
    },

    actions: {
      theme: (el) => E.commit((s) => (s.settings.theme = el.dataset.value)),
      accent: (el) => E.commit((s) => (s.settings.accent = el.dataset.value)),
      weekstart: (el) => E.commit((s) => (s.settings.weekStart = +el.dataset.value)),
      reading: (el) => E.commit((s) => (s.settings.readingGoal = E.clamp(s.settings.readingGoal + +el.dataset.delta, 1, 365))),
      'focus-settings': () => E.views.focus.settingsSheet(),
      garmin: () => E.health.helpSheet(),
      async export() {
        const name = `ember-backup-${E.today()}.json`, json = E.store.exportData();
        const done = () => {
          E.commit((s) => (s.settings.lastBackup = Date.now()));
          ui.toast('Backup exported', 'download');
        };
        // Phones: use the share sheet (Save to Files, iCloud Drive, AirDrop…) — downloads are awkward there
        const file = typeof File === 'function' ? new File([json], name, { type: 'application/json' }) : null;
        if (file && matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: 'Ember backup' });
            done();
          } catch (e) {
            if (e.name !== 'AbortError') ui.toast('Could not share the backup', 'info');
          }
          return;
        }
        ui.download(name, json);
        done();
      },
      import() {
        document.querySelector('[data-field="import-file"]').click();
      },
      async sample() {
        const ok = await ui.confirm({ title: 'Load sample data?', message: 'This replaces everything currently in Ember with example entries, habits, goals and books. Export a backup first if you want to keep your data.', ok: 'Load Sample', destructive: true });
        if (!ok) return;
        E.store.loadSample();
        E.app.render();
        ui.toast('Sample data loaded', 'sparkles');
      },
      async erase() {
        const ok = await ui.confirm({ title: 'Erase all data?', message: 'Every journal entry, habit, goal, book, task and focus session will be permanently deleted from this browser.', ok: 'Erase Everything', destructive: true });
        if (!ok) return;
        E.store.reset(true);
        E.app.render();
        ui.toast('All data erased', 'trash');
      },
    },

    onInput(el) {
      if (el.dataset.field === 'name') {
        E.db().settings.name = el.value;
        E.commit(null, { silent: true });
        const av = document.querySelector('.avatar');
        if (av) av.textContent = (el.value || 'E').trim().charAt(0).toUpperCase() || 'E';
        E.app.paintProfile();
      }
    },

    onChange(el) {
      if (el.dataset.field !== 'import-file' || !el.files[0]) return;
      const file = el.files[0];
      el.value = '';
      file.text().then(async (txt) => {
        let data;
        try {
          data = JSON.parse(txt);
        } catch (e) {
          return ui.toast('That file is not valid JSON', 'info');
        }
        const ok = await ui.confirm({ title: 'Restore this backup?', message: `All current data will be replaced with “${file.name}”.`, ok: 'Restore', destructive: true });
        if (!ok) return;
        try {
          E.store.importData(data);
          E.app.render();
          ui.toast('Backup restored', 'upload');
        } catch (err) {
          ui.toast(err.message, 'info');
        }
      });
    },
  });

  /* ---------- More (phone tab) ---------- */
  E.views.more = {
    title: 'More',
    render() {
      const s = E.db(), T = E.today();
      const lastSleep = E.health.val(T, 'sleep');
      const items = [
        ['#/health', 'health', '#FF375F', 'Health', lastSleep != null ? `${E.health.hm(lastSleep)} sleep` : ''],
        ['#/books', 'books', '#FF9F0A', 'Books', `${s.books.filter((b) => b.status === 'reading').length} reading`],
        ['#/tasks', 'tasks', '#0A84FF', 'Tasks', `${s.tasks.filter((t) => !t.done && t.due && t.due <= T).length} due`],
        ['#/focus', 'focus', '#FF5E3A', 'Focus', E.fmtMin(E.focusStats.minutesOn(T)) + ' today'],
        ['#/insights', 'insights', '#BF5AF2', 'Insights', ''],
        ['#/settings', 'settings', '#8E8E93', 'Settings', ''],
      ];
      return `<div class="page page-more">
        <header class="page-head"><div><h1 class="large-title">More</h1></div>
          <div class="head-actions"><button class="icon-btn" data-act="spotlight" aria-label="Search">${E.icon('search', 19)}</button></div></header>
        <section class="set-group">
          ${items.map(([href, icon, c, label, sub]) => `<a class="set-row" href="${href}"><span class="set-ic" style="--c:${c}">${E.icon(icon, 16)}</span><span class="set-title">${label}</span><span class="set-right"><span class="muted">${sub}</span>${E.icon('right', 16)}</span></a>`).join('')}
        </section>
      </div>`;
    },
    actions: { spotlight: () => E.spotlight.open() },
  };
})();
