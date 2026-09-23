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

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    let file = path.normalize(path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  })
  .listen(PORT, LAN ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(`Ember is running at http://localhost:${PORT}`);
    if (!LAN) return;
    const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal);
    console.log('\nOn your iPhone (same Wi-Fi), open Safari and go to:');
    ips.forEach((i) => console.log(`  http://${i.address}:${PORT}`));
    console.log('\nThen tap Share → Add to Home Screen. Keep this window open while you use it. Ctrl+C to stop.');
  });
