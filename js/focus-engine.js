/* Ember — focus (pomodoro) timer engine, sounds and ambient noise */
(function () {
  'use strict';
  const E = window.Ember;
  const F = (E.focus = {});
  F.MODES = { work: 'Focus', short: 'Short Break', long: 'Long Break' };
  let tick = null;
  let audio = null;

  F.t = () => {
    const s = E.db();
    if (!s.focus.timer) s.focus.timer = { mode: 'work', running: false, endAt: 0, remaining: s.settings.focus.work * 60, label: '', cycle: 0, startedAt: null };
    return s.focus.timer;
  };
  F.duration = (mode) => E.db().settings.focus[mode] * 60;
  F.left = () => {
    const t = F.t();
    return t.running ? Math.max(0, Math.ceil((t.endAt - Date.now()) / 1000)) : t.remaining;
  };
  F.fmt = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

  F.start = () => {
    const t = F.t();
    if (t.running) return;
    if (t.remaining <= 0) t.remaining = F.duration(t.mode);
    t.running = true;
    t.endAt = Date.now() + t.remaining * 1000;
    if (!t.startedAt) t.startedAt = Date.now();
    ctx();
    E.commit();
    ensureTick();
  };
  F.pause = () => {
    const t = F.t();
    if (!t.running) return;
    t.remaining = F.left();
    t.running = false;
    E.commit();
    paint();
  };
  F.toggle = () => (F.t().running ? F.pause() : F.start());
  F.reset = () => {
    const t = F.t();
    t.running = false;
    t.remaining = F.duration(t.mode);
    t.startedAt = null;
    E.commit();
    paint();
  };
  F.setMode = (mode) => {
    const t = F.t();
    t.mode = mode;
    t.running = false;
    t.remaining = F.duration(mode);
    t.startedAt = null;
    E.commit();
    paint();
  };
  F.skip = () => complete(false, true);
  /** Called when durations change in settings: refresh an idle timer. */
  F.refreshIdle = () => {
    const t = F.t();
    if (!t.running && !t.startedAt) t.remaining = F.duration(t.mode);
  };

  function complete(natural, loud) {
    const t = F.t(), s = E.db(), cfg = s.settings.focus;
    let next;
    if (t.mode === 'work') {
      if (natural) {
        s.focus.sessions.push({ id: E.uid(), start: t.startedAt || Date.now() - cfg.work * 60000, minutes: cfg.work, label: (t.label || '').trim() });
        t.cycle = (t.cycle || 0) + 1;
      }
      next = t.cycle > 0 && t.cycle % cfg.every === 0 ? 'long' : 'short';
    } else {
      if (t.mode === 'long') t.cycle = 0;
      next = 'work';
    }
    const finished = t.mode;
    t.mode = next;
    t.remaining = F.duration(next);
    t.running = false;
    t.startedAt = null;
    if (natural && loud) {
      if (cfg.sound) chime();
      notify(finished === 'work' ? 'Focus session complete' : 'Break is over', finished === 'work' ? `Nice work! Time for a ${next === 'long' ? 'long' : 'short'} break.` : 'Ready for the next focus session?');
      E.ui.toast(finished === 'work' ? `Session done — ${E.fmtMin(cfg.work)} focused` : 'Break over — back to it', finished === 'work' ? 'check' : 'focus');
    }
    E.commit();
    if (natural && loud && cfg.autoBreak && finished === 'work') F.start();
    paint();
  }

  function ensureTick() {
    if (tick) return;
    tick = setInterval(() => {
      const t = F.t();
      if (!t.running) {
        clearInterval(tick);
        tick = null;
        paint();
        return;
      }
      if (F.left() <= 0) complete(true, true);
      else paint();
    }, 250);
  }

  /** Update every live timer element on screen without re-rendering. */
  function paint() {
    const t = F.t(), left = F.left(), txt = F.fmt(left);
    document.querySelectorAll('[data-focus-time]').forEach((el) => (el.textContent = txt));
    const total = F.duration(t.mode) || 1;
    document.querySelectorAll('[data-focus-ring]').forEach((el) => {
      const c = parseFloat(el.getAttribute('stroke-dasharray'));
      el.setAttribute('stroke-dashoffset', (c * (1 - left / total)).toFixed(2));
    });
    const badge = document.getElementById('focus-badge');
    if (badge) {
      badge.textContent = t.running ? txt : '';
      badge.hidden = !t.running;
    }
    document.title = t.running ? `${txt} · ${F.MODES[t.mode]} — Ember` : 'Ember';
  }
  F.paint = paint;

  F.init = () => {
    const t = F.t();
    if (t.running && t.endAt <= Date.now()) complete(true, false);
    if (t.running) ensureTick();
    paint();
  };

  /* ---------- sound ---------- */
  function ctx() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) {
      audio = null;
    }
    return audio;
  }
  function chime() {
    const a = ctx();
    if (!a) return;
    const now = a.currentTime;
    [0, 0.18, 0.36, 1.1, 1.28, 1.46].forEach((d, i) => {
      const o = a.createOscillator(), g = a.createGain();
      o.type = 'sine';
      o.frequency.value = [880, 1175, 1568][i % 3];
      g.gain.setValueAtTime(0, now + d);
      g.gain.linearRampToValueAtTime(0.18, now + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + d + 0.9);
      o.connect(g).connect(a.destination);
      o.start(now + d);
      o.stop(now + d + 1);
    });
  }
  F.testSound = chime;

  function notify(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted' && document.hidden) new Notification(title, { body });
    } catch (e) { /* notifications unsupported here */ }
  }

  /* ---------- ambient noise ---------- */
  let noise = null;
  F.noiseKind = null;
  F.setNoise = (kind) => {
    if (noise) {
      const n = noise;
      n.g.gain.linearRampToValueAtTime(0, n.a.currentTime + 0.4);
      setTimeout(() => n.src.stop(), 450);
      noise = null;
    }
    F.noiseKind = kind;
    if (!kind) return;
    const a = ctx();
    if (!a) return;
    const len = a.sampleRate * 4, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    let last = 0, b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else if (kind === 'rain') {
        b0 = 0.997 * b0 + w * 0.029591;
        b1 = 0.985 * b1 + w * 0.032534;
        b2 = 0.95 * b2 + w * 0.048056;
        d[i] = (b0 + b1 + b2 + w * 0.05) * 0.9;
      } else d[i] = w * 0.35;
    }
    const src = a.createBufferSource(), g = a.createGain();
    src.buffer = buf;
    src.loop = true;
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(kind === 'white' ? 0.12 : 0.35, a.currentTime + 0.8);
    src.connect(g).connect(a.destination);
    src.start();
    noise = { src, g, a };
  };
})();
