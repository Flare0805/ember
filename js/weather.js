/* Ember — weather from Open-Meteo (free, no account). Location stays on this device; only rounded coordinates are sent. */
(function () {
  'use strict';
  const E = window.Ember;

  const CACHE = 'ember:weather', GEO = 'ember:geo';
  const read = (k) => {
    try {
      return JSON.parse(localStorage.getItem(k));
    } catch (e) {
      return null;
    }
  };
  const write = (k, v) => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { /* storage blocked: weather just refetches */ }
  };

  // WMO weather codes → emoji + label (night variants for clear skies)
  const CODES = {
    0: ['☀️', 'Clear', '🌙'], 1: ['🌤️', 'Mostly clear', '🌙'], 2: ['⛅', 'Partly cloudy', '☁️'], 3: ['☁️', 'Cloudy'],
    45: ['🌫️', 'Fog'], 48: ['🌫️', 'Fog'], 51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Heavy drizzle'],
    56: ['🌧️', 'Freezing drizzle'], 57: ['🌧️', 'Freezing drizzle'], 61: ['🌦️', 'Light rain'], 63: ['🌧️', 'Rain'], 65: ['🌧️', 'Heavy rain'],
    66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'], 71: ['🌨️', 'Light snow'], 73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'],
    77: ['🌨️', 'Snow grains'], 80: ['🌦️', 'Showers'], 81: ['🌧️', 'Showers'], 82: ['⛈️', 'Heavy showers'], 85: ['🌨️', 'Snow showers'],
    86: ['🌨️', 'Snow showers'], 95: ['⛈️', 'Thunderstorm'], 96: ['⛈️', 'Thunderstorm, hail'], 99: ['⛈️', 'Thunderstorm, hail'],
  };

  const W = (E.weather = {
    loading: false,
    look(code, isDay = 1) {
      const c = CODES[code] || ['🌡️', 'Weather'];
      return { icon: !isDay && c[2] ? c[2] : c[0], label: c[1] };
    },
    /** Where to get weather for: {lat, lon, name} or null (location not chosen / not allowed yet). */
    place() {
      const w = E.db().settings.weather || {};
      if (w.mode === 'city' && w.city) return w.city;
      const g = read(GEO);
      return g ? { lat: g.lat, lon: g.lon, name: 'Current location' } : null;
    },
    needsPermission() {
      const w = E.db().settings.weather || {};
      return w.mode !== 'city' && !read(GEO);
    },
    /** Ask the phone for its location (call from a tap), round it to ~1 km and remember it. */
    locate() {
      return new Promise((resolve) => {
        if (!navigator.geolocation) return resolve({ ok: false, error: 'This device cannot share its location.' });
        navigator.geolocation.getCurrentPosition(
          (p) => {
            write(GEO, { lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2), at: Date.now() });
            resolve({ ok: true });
          },
          (err) => resolve({ ok: false, error: err.code === 1 ? 'Location permission was denied. You can pick a city in Settings instead.' : 'Could not get your location right now.' }),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 3 * 3600e3 }
        );
      });
    },
    cached() {
      const c = read(CACHE), p = W.place();
      return c && p && c.lat === p.lat && c.lon === p.lon ? c : null;
    },
    /** Returns cached data immediately; refreshes in the background when older than 30 min, then re-renders. */
    get() {
      const c = W.cached();
      if ((!c || Date.now() - c.at > 30 * 60e3) && !W.loading && W.place()) W.refresh();
      return c ? c.data : null;
    },
    async refresh() {
      const p = W.place();
      if (!p) return;
      W.loading = true;
      try {
        const q = new URLSearchParams({
          latitude: p.lat, longitude: p.lon, timezone: 'auto', forecast_days: '2',
          current: 'temperature_2m,apparent_temperature,weather_code,is_day',
          hourly: 'temperature_2m,weather_code,precipitation_probability,is_day',
          daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
        });
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
        if (!res.ok) throw new Error(res.status);
        write(CACHE, { at: Date.now(), lat: p.lat, lon: p.lon, data: await res.json() });
        // Refresh the location every few hours too, silently, if permission was already given
        const g = read(GEO);
        if (g && Date.now() - g.at > 3 * 3600e3 && navigator.permissions) {
          navigator.permissions.query({ name: 'geolocation' }).then((st) => st.state === 'granted' && W.locate()).catch(() => {});
        }
        if (E.app && E.app.current() && E.app.current().view === 'today') E.app.render();
      } catch (e) {
        /* offline: keep showing the last forecast */
      } finally {
        W.loading = false;
      }
    },
    async searchCity(name) {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name, count: '6', language: 'en' })}`);
      const j = await res.json();
      return (j.results || []).map((r) => ({ name: r.name, lat: +r.latitude.toFixed(2), lon: +r.longitude.toFixed(2), region: [r.admin1, r.country].filter(Boolean).join(', ') }));
    },
    /** Next `n` hours from now: [{time:'14', temp, icon, rain}] */
    hours(data, n = 12) {
      if (!data || !data.hourly) return [];
      const h = data.hourly, now = data.current ? data.current.time.slice(0, 13) : '';
      const start = Math.max(0, h.time.findIndex((t) => t.slice(0, 13) >= now));
      return h.time.slice(start, start + n).map((t, i) => ({
        time: t.slice(11, 13),
        temp: Math.round(h.temperature_2m[start + i]),
        rain: h.precipitation_probability ? h.precipitation_probability[start + i] : null,
        ...W.look(h.weather_code[start + i], h.is_day ? h.is_day[start + i] : 1),
      }));
    },
    day(data, i = 0) {
      if (!data || !data.daily) return null;
      const d = data.daily;
      return {
        hi: Math.round(d.temperature_2m_max[i]), lo: Math.round(d.temperature_2m_min[i]),
        rain: d.precipitation_probability_max ? d.precipitation_probability_max[i] : null,
        sunrise: d.sunrise[i].slice(11, 16), sunset: d.sunset[i].slice(11, 16),
        ...W.look(d.weather_code[i], 1),
      };
    },
  });
})();
