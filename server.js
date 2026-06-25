import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local (no external deps needed)
const envFile = path.join(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const eq = line.indexOf('=');
    if (eq > 0 && !line.trimStart().startsWith('#')) {
      const k = line.slice(0, eq).trim();
      const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      process.env[k] = v;
    }
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);
  const pathname = url.pathname;

  // ── API routes ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    const name = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
    const apiPath = path.join(__dirname, 'api', name + '.js');

    if (!fs.existsSync(apiPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'API route not found' }));
    }

    let body = '';
    for await (const chunk of req) body += chunk;

    const mockReq = {
      method: req.method,
      headers: req.headers,
      body: body ? (() => { try { return JSON.parse(body); } catch { return {}; } })() : {},
    };

    let responded = false;
    const mockRes = {
      _status: 200,
      _headers: {},
      status(code) { this._status = code; return this; },
      setHeader(k, v) { this._headers[k] = v; },
      json(data) {
        if (responded) return;
        responded = true;
        this._headers['Content-Type'] = 'application/json';
        res.writeHead(this._status, this._headers);
        res.end(JSON.stringify(data));
      },
      send(data) {
        if (responded) return;
        responded = true;
        res.writeHead(this._status, this._headers);
        res.end(data);
      },
      end(data) {
        if (responded) return;
        responded = true;
        res.writeHead(this._status, this._headers);
        res.end(data);
      },
    };

    try {
      // Bust module cache by appending a timestamp query (ESM workaround)
      const mod = await import(`${apiPath}?t=${Date.now()}`);
      await mod.default(mockReq, mockRes);
    } catch (err) {
      console.error('[API error]', err);
      if (!responded) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────────
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Allow /page/ and /images/ etc.
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('404 Not Found: ' + pathname);
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n✅  Dev server running at http://localhost:${PORT}`);
  console.log(`   Open: http://localhost:${PORT}/page/image-buddy.html\n`);
});
