/* Ember — core utilities, dates, icons and constants */
(function () {
  'use strict';
  const E = (window.Ember = window.Ember || {});
  E.views = {};

  /* ---------- small helpers ---------- */
  E.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  E.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  E.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  E.debounce = (fn, ms) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  E.plural = (n, word, pl) => `${n} ${n === 1 ? word : pl || word + 's'}`;
  E.hash = (str) => {
    let h = 7;
    for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(h);
  };
  E.words = (s) => (String(s || '').trim().match(/\S+/g) || []).length;
  E.pct = (v) => Math.round(v * 100) + '%';

  /* ---------- dates (day keys are local 'YYYY-MM-DD') ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  E.dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  E.today = () => E.dkey(new Date());
  E.parse = (k) => {
    const [y, m, d] = String(k).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };
  E.addDays = (k, n) => {
    const d = E.parse(k);
    d.setDate(d.getDate() + n);
    return E.dkey(d);
  };
  E.diffDays = (a, b) => Math.round((E.parse(a) - E.parse(b)) / 864e5);
  E.dow = (k) => E.parse(k).getDay();
  E.fmt = (k, o) => E.parse(k).toLocaleDateString('en-US', o);
  E.fmtShort = (k) => {
    const sameYear = E.parse(k).getFullYear() === new Date().getFullYear();
    return E.fmt(k, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
  };
  E.fmtLong = (k) => E.fmt(k, { weekday: 'long', month: 'long', day: 'numeric' });
  E.relDay = (k) => {
    const d = E.diffDays(k, E.today());
    if (d === 0) return 'Today';
    if (d === -1) return 'Yesterday';
    if (d === 1) return 'Tomorrow';
    if (d > 1 && d < 7) return E.fmt(k, { weekday: 'long' });
    return E.fmtShort(k);
  };
  E.fmtTime = (ts) => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  E.fmtMin = (m) => {
    m = Math.round(m);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h ${r}m` : `${h}h`;
  };
  E.timeAgo = (ts) => {
    const s = (Date.now() - ts) / 1000;
    if (s < 45) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    const d = Math.round(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  };
  E.weekStart = () => (E.store && E.store.state ? E.store.state.settings.weekStart : 1);
  E.weekStartKey = (k) => {
    const off = (E.dow(k) - E.weekStart() + 7) % 7;
    return E.addDays(k, -off);
  };
  E.weekdayOrder = () => (E.weekStart() === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6]);
  E.DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  E.DAY_LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  E.MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  E.dayOfYear = (d = new Date()) => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);

  /* ---------- constants ---------- */
  E.ACCENTS = {
    orange: { label: 'Orange', c: '#FF9F0A', c2: '#FF7A00' },
    tangerine: { label: 'Tangerine', c: '#FF8A3D', c2: '#FF5E1A' },
    amber: { label: 'Amber', c: '#FFB340', c2: '#FF9500' },
    ember: { label: 'Ember', c: '#FF6B3D', c2: '#F2451D' },
  };

  E.COLORS = ['#FF9F0A', '#FF453A', '#FF375F', '#BF5AF2', '#5E5CE6', '#0A84FF', '#64D2FF', '#66D4CF', '#30D158', '#FFD60A', '#AC8E68', '#8E8E93'];

  // Mood is ordinal, so it uses one sequential hue: dim → bright orange
  E.MOODS = [
    { v: 1, emoji: '😞', label: 'Awful', color: '#6B4A2B' },
    { v: 2, emoji: '😕', label: 'Bad', color: '#94602A' },
    { v: 3, emoji: '😐', label: 'Okay', color: '#C47A1E' },
    { v: 4, emoji: '🙂', label: 'Good', color: '#FF9F0A' },
    { v: 5, emoji: '😄', label: 'Great', color: '#FFC56B' },
  ];
  E.mood = (v) => E.MOODS.find((m) => m.v === v);

  E.CATEGORIES = [
    { id: 'health', label: 'Health', emoji: '💪', color: '#30D158' },
    { id: 'career', label: 'Career', emoji: '💼', color: '#0A84FF' },
    { id: 'personal', label: 'Personal', emoji: '🌱', color: '#FF9F0A' },
    { id: 'finance', label: 'Finance', emoji: '💰', color: '#FFD60A' },
    { id: 'learning', label: 'Learning', emoji: '🎓', color: '#BF5AF2' },
    { id: 'relationships', label: 'Relationships', emoji: '❤️', color: '#FF375F' },
    { id: 'travel', label: 'Travel', emoji: '✈️', color: '#64D2FF' },
    { id: 'creative', label: 'Creative', emoji: '🎨', color: '#FF6B4A' },
  ];
  E.cat = (id) => E.CATEGORIES.find((c) => c.id === id) || E.CATEGORIES[2];

  E.EMOJIS = [
    '💧', '📖', '💪', '🧘', '🚶', '🏃', '😴', '🍎', '🥗', '☕', '🍬', '🚭',
    '✍️', '🗣️', '🎸', '🎨', '💻', '🧠', '💊', '🦷', '🌅', '🌙', '🧹', '💰',
    '📵', '🙏', '❤️', '🌱', '🎯', '⭐', '🔥', '🏋️', '🚴', '🏊', '⚽', '🧗',
    '📚', '🎓', '💼', '✈️', '🏠', '🎹', '📷', '🌍', '🧩', '🍳', '🐶', '🏆',
  ];

  E.QUOTES = [
    ['We suffer more often in imagination than in reality.', 'Seneca'],
    ['The journey of a thousand miles begins with one step.', 'Lao Tzu'],
    ['You have power over your mind, not outside events. Realize this, and you will find strength.', 'Marcus Aurelius'],
    ['Well begun is half done.', 'Aristotle'],
    ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
    ['Luck is what happens when preparation meets opportunity.', 'Seneca'],
    ['Waste no more time arguing what a good man should be. Be one.', 'Marcus Aurelius'],
    ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt'],
    ['The best time to plant a tree was twenty years ago. The second best time is now.', 'Proverb'],
    ['Fall seven times, stand up eight.', 'Japanese proverb'],
    ['He who has a why to live can bear almost any how.', 'Friedrich Nietzsche'],
    ['Knowing yourself is the beginning of all wisdom.', 'Aristotle'],
    ['Little by little, one travels far.', 'Proverb'],
    ['Energy and persistence conquer all things.', 'Benjamin Franklin'],
    ['Well done is better than well said.', 'Benjamin Franklin'],
    ['Dwell on the beauty of life. Watch the stars, and see yourself running with them.', 'Marcus Aurelius'],
    ['While we are postponing, life speeds by.', 'Seneca'],
    ['Nature does not hurry, yet everything is accomplished.', 'Lao Tzu'],
  ];

  E.PROMPTS = [
    'What made you smile today?',
    'Name three things you are grateful for right now.',
    'What did you learn today?',
    'What is one thing you would do differently if you could redo today?',
    'Describe a moment from today you want to remember.',
    'What is taking up most of your mental space lately?',
    'Who made a difference in your day, and how?',
    'What are you looking forward to tomorrow?',
    'What challenged you today, and how did you respond?',
    'What would make tomorrow a great day?',
    'How did you take care of yourself today?',
    'What small win is worth celebrating?',
    'What is something you are proud of this week?',
    'If today had a title, what would it be?',
    'What drained your energy today, and what gave it back?',
  ];

  /* ---------- icons (24×24 line icons) ---------- */
  const P = {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    journal: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M9 7h6M9 11h4"/>',
    goals: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    habits: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    books: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
    tasks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8M13 12h8M13 18h8"/>',
    focus: '<path d="M10 2h4"/><path d="M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    insights: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    more: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    right: '<path d="m9 18 6-6-6-6"/>',
    left: '<path d="m15 18-6-6 6-6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    star: '<path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95z"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    dots: '<circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/><circle cx="5" cy="12" r="1.2"/>',
    play: '<path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    skip: '<path d="M5 4l10 8-10 8z"/><path d="M19 5v14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    tag: '<path d="M12 2H2v10l9.29 9.29a2.41 2.41 0 0 0 3.42 0l6.58-6.58a2.41 2.41 0 0 0 0-3.42L12 2Z"/><path d="M7 7h.01"/>',
    quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    volume: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.7"/>',
    waves: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    keyboard: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    health: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    battery: '<rect x="2" y="7" width="16" height="10" rx="2.5"/><path d="M22 11v2"/><path d="M6 11v2M10 11v2"/>',
    pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    steps: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4M4 13h4"/>',
    watch: '<circle cx="12" cy="12" r="6"/><path d="M12 10v2l1 1"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/>',
    scatter: '<path d="M3 3v18h18"/><circle cx="8" cy="15" r="1.2"/><circle cx="12" cy="11" r="1.2"/><circle cx="16" cy="12" r="1.2"/><circle cx="18" cy="7" r="1.2"/><circle cx="11" cy="16" r="1.2"/>',
  };
  const FILLED = new Set(['play', 'star']);
  E.icon = (name, size = 20, cls = '') => {
    const filled = FILLED.has(name);
    return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${filled ? 1.5 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
  };
})();
