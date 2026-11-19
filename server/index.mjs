/**
 * Production server: serves the built `dist/` plus the /api endpoints.
 *
 * Deploy target is anything that runs Node:
 *   npm run build && PORT=8080 npm start
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './http.mjs';
import { resolveProvider } from './insight.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 8080);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

/** Read the AI settings from the environment, falling back to a local .env file. */
async function loadAiConfig() {
  const fromEnv = {
    openrouterKey: process.env.OPENROUTER_API_KEY,
    groqKey: process.env.GROQ_API_KEY,
    model: process.env.AI_MODEL,
  };
  if (fromEnv.openrouterKey || fromEnv.groqKey) return fromEnv;

  try {
    const raw = await readFile(join(ROOT, '.env'), 'utf8');
    const read = (name) => {
      for (const line of raw.split('\n')) {
        const match = new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)\\s*$`).exec(line);
        if (match) return match[1].trim().replace(/^["']|["']$/g, '');
      }
      return undefined;
    };
    return {
      openrouterKey: read('OPENROUTER_API_KEY'),
      groqKey: read('GROQ_API_KEY'),
      model: read('AI_MODEL'),
    };
  } catch {
    /* no .env present — rely on the real environment */
  }
  return fromEnv;
}

function serveFile(res, filePath, status = 200) {
  const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
  const { size } = statSync(filePath);
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': size,
    // Hashed asset filenames are safe to cache hard; everything else is not.
    'Cache-Control': filePath.includes('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate',
  });
  createReadStream(filePath).pipe(res);
}

const aiConfig = await loadAiConfig();

const server = createServer((req, res) => {
  void (async () => {
    try {
      if (req.url?.startsWith('/api/')) {
        if (await handleApi(req, res, () => aiConfig)) return;
      }

      if (!existsSync(DIST)) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('No build found. Run `npm run build` first.');
        return;
      }

      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      // normalize + prefix check defeats ../ traversal attempts.
      const candidate = join(DIST, normalize(pathname));
      if (candidate.startsWith(DIST) && existsSync(candidate) && statSync(candidate).isFile()) {
        serveFile(res, candidate);
        return;
      }

      // SPA fallback.
      serveFile(res, join(DIST, 'index.html'), pathname === '/' ? 200 : 200);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Server error: ${err?.message ?? 'unknown'}`);
    }
  })();
});

server.listen(PORT, () => {
  console.log(`Material Studio on http://localhost:${PORT}`);
  const provider = resolveProvider(aiConfig);
  console.log(
    provider
      ? `AI: ${provider.name} / ${provider.model}`
      : 'No AI key found — AI panels will show a notice.',
  );
});
