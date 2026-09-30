// Tiny static server for Ember (no dependencies).
//   node serve.js        → http://localhost:5173 (this computer only)
//   node serve.js --lan  → also reachable from your phone on the same Wi-Fi
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PORT = process.env.PORT || 5173;
const LAN = process.argv.includes('--lan');
const ROOT = __dirname;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};
// Only the app itself is served. The folder also holds git-ignored private files (garmin-export/ with the sync key
// and plain health exports, .git/, .venv-garmin/), which must never be reachable — least of all over Wi-Fi.
const PUBLIC = ['index.html', 'sw.js', 'manifest.webmanifest', 'css', 'js', 'assets', 'data'];
const lanIps = () => Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
const HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', ...lanIps()]);

http
  .createServer((req, res) => {
    // Refuse requests addressed to any other name: stops DNS-rebinding pages from reading local files through this server
    const host = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
    if (!HOSTS.has(host)) {
      res.writeHead(403);
      return res.end();
    }
    let urlPath;
    try {
      urlPath = decodeURIComponent(req.url.split('?')[0]);
    } catch (e) {
      urlPath = null;
    }
    if (urlPath === null || urlPath.includes('\0')) {
      res.writeHead(400);
      return res.end();
    }
    const rel = path.relative(ROOT, path.resolve(ROOT, '.' + (urlPath === '/' ? '/index.html' : urlPath)));
    const top = rel.split(path.sep)[0];
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || !PUBLIC.includes(top)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(path.join(ROOT, rel), (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(rel)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(data);
    });
  })
  .listen(PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(`Ember is running at http://localhost:${PORT}`);
    if (!LAN) return;
    console.log('\nOn your iPhone (same Wi-Fi), open Safari and go to:');
    lanIps().forEach((ip) => console.log(`  http://${ip}:${PORT}`));
    console.log('\nThen tap Share → Add to Home Screen. Keep this window open while you use it. Ctrl+C to stop.');
  });
