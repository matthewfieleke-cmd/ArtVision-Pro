/**
 * Local dev API: mirrors Vercel /api/critique. Run: npm run dev:api
 * Vite proxies /api → http://127.0.0.1:8787 (see vite.config.ts).
 */
import { createServer } from 'node:http';
import { config } from 'dotenv';
import type { CritiqueRequestBody } from '../lib/critiqueTypes';
import { runOpenAICritique } from '../lib/openaiCritique';

config({ path: '.env.local' });
config({ path: '.env' });

const PORT = Number(process.env.CRITIQUE_API_PORT ?? 8787);

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/critique') {
    res.writeHead(req.method === 'POST' ? 404 : 405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Set OPENAI_API_KEY in .env.local' }));
    return;
  }

  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 25 * 1024 * 1024) {
      res.writeHead(413);
      res.end(JSON.stringify({ error: 'Payload too large' }));
      return;
    }
  }

  try {
    const parsed = JSON.parse(body) as CritiqueRequestBody;
    if (!parsed?.imageDataUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'imageDataUrl required' }));
      return;
    }
    const result = await runOpenAICritique(key, parsed);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Critique failed' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Critique API listening on http://127.0.0.1:${PORT}/api/critique`);
});
