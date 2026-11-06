// Serve the hosted game and account API on loopback for Tailscale Funnel.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createRooms } = require('./rooms.cjs');
const { connect } = require('../server/database');
const { createApp } = require('../server/app');

const root = path.resolve(__dirname, 'build');
const index = path.join(root, 'index.html');
if (!fs.existsSync(index) || !fs.existsSync(path.join(root, '.hosted-build'))) {
  console.error('Build the hosted client first; see README.md.');
  process.exit(1);
}
const port = Number(process.env.PORT || 3100);
const rooms = createRooms(path.resolve(process.env.MONOPOLY_ROOM_FILE || path.join(__dirname, '..', 'data', 'online-rooms.json')));
const attempts = new Map();
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };
async function start() {
const stores = await connect();
const accounts = createApp({ ...stores, sameOrigin: true, secureCookies: 'proxy', onPasswordChanged:email=>rooms.revokeAccountSeats(email) });
http.createServer((req, res) => {
  if (req.url === '/api/account' || req.url.startsWith('/api/account/')) {
    req.url = req.url.slice('/api/account'.length) || '/';
    return accounts(req, res);
  }
  if (req.url.startsWith('/api/rooms')) {
    const send = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
    if (req.method !== 'GET') {
      const key = req.headers.authorization || req.socket.remoteAddress;
      const now = Date.now();
      for (const [id, entry] of attempts) if (entry.until < now) attempts.delete(id);
      const entry = attempts.get(key) || { count: 0, until: now + 60000 };
      if (++entry.count > 60) return send(429, { error: 'Too many requests. Please wait a minute.' });
      attempts.set(key, entry);
    }
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 16384) req.destroy(); });
    req.on('end', async () => {
      try {
        const url = new URL(req.url, 'http://localhost');
        const parts = url.pathname.split('/').filter(Boolean);
        const input = body ? JSON.parse(body) : {};
        const secret = (req.headers.authorization || '').replace(/^Bearer /, '');
        const needsAccount = (req.method === 'POST' && (parts.length===2 || (parts.length===4 && ['join','link','rejoin'].includes(parts[3])))) || (req.method==='GET' && parts.length===3 && parts[2]==='mine');
        const session = needsAccount ? await accounts.locals.currentSession(req) : null;
        const account = session?.user?.email || null;
        let result;
        if (req.method === 'POST' && parts.length === 2) result = rooms.create(input.name, account);
        else if (req.method === 'POST' && parts.length === 4 && parts[3] === 'join') result = rooms.join(parts[2], input.name, account);
        else if (req.method === 'POST' && parts.length === 4 && parts[3] === 'link') result = rooms.link(parts[2], secret, account);
        else if (req.method === 'POST' && parts.length === 4 && parts[3] === 'rejoin') result = rooms.rejoin(parts[2], account);
        else if (req.method === 'GET' && parts.length === 3 && parts[2] === 'mine') result = rooms.analytics(account);
        else if (req.method === 'GET' && parts.length === 3) result = rooms.read(parts[2], secret);
        else if (req.method === 'POST' && parts.length === 4 && parts[3] === 'start') result = rooms.start(parts[2], secret);
        else if (req.method === 'POST' && parts.length === 4 && parts[3] === 'decide') result = rooms.decide(parts[2], secret, input.seat, input.approve === true);
        else if (req.method === 'POST' && parts.length === 4 && parts[3] === 'action') result = rooms.perform(parts[2], secret, input.type, input.payload, input.revision);
        else return send(404, { error: 'Not found.' });
        send(200, result);
      } catch (error) { send(400, { error: error.message }); }
    });
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end(); }
  if (pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(404); return res.end(); }
  const file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
  fs.stat(file, (error, stat) => {
    const target = !error && stat.isFile() ? file : path.extname(pathname) ? null : index;
    if (!target) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': target === index ? 'no-cache' : 'public, max-age=3600' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(target).on('error', () => res.destroy()).pipe(res);
  });
}).listen(port, '127.0.0.1', () => console.log(`Local game available at http://127.0.0.1:${port}`));
}
start().catch(error => { console.error(`Could not connect to local MongoDB: ${error.message}`); process.exitCode = 1; });
