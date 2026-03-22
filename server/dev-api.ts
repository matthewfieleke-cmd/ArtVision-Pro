/**
 * Local dev API: mirrors Vercel /api/* routes.
 * Run: npm run dev:api — Vite proxies /api → http://127.0.0.1:8787
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from 'dotenv';
import type { CritiqueRequestBody } from '../lib/critiqueTypes';
import type { PreviewEditRequestBody } from '../lib/previewEditTypes';
import { runOpenAIClassifyStyle } from '../lib/openaiClassifyStyle';
import { runOpenAICritique } from '../lib/openaiCritique';
import { runOpenAIPreviewEdit } from '../lib/openaiPreviewEdit';

config({ path: '.env.local' });
config({ path: '.env' });

const PORT = Number(process.env.CRITIQUE_API_PORT ?? 8787);
const MAX_BODY = 35 * 1024 * 1024;

function setCorsHeaders(res: ServerResponse, origin: string | undefined): void {
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  setCorsHeaders(res, req.headers.origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url ?? '';
  const isCritique = url === '/api/critique';
  const isClassify = url === '/api/classify-style';
  const isPreview = url === '/api/preview-edit';

  if (req.method !== 'POST' || (!isCritique && !isClassify && !isPreview)) {
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
    if (body.length > MAX_BODY) {
      res.writeHead(413);
      res.end(JSON.stringify({ error: 'Payload too large' }));
      return;
    }
  }

  try {
    if (isCritique) {
      const parsed = JSON.parse(body) as CritiqueRequestBody;
      if (!parsed?.imageDataUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'imageDataUrl required' }));
        return;
      }
      const result = await runOpenAICritique(key, parsed);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (isPreview) {
      const parsed = JSON.parse(body) as PreviewEditRequestBody;
      if (!parsed?.imageDataUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'imageDataUrl required' }));
        return;
      }
      if (!parsed.style || !parsed.medium || !parsed.target?.criterion) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'style, medium, and target required' }));
        return;
      }
      const result = await runOpenAIPreviewEdit(key, parsed);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    const parsed = JSON.parse(body) as { imageDataUrl?: string };
    if (!parsed?.imageDataUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'imageDataUrl required' }));
      return;
    }
    const result = await runOpenAIClassifyStyle(key, parsed.imageDataUrl);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Request failed' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `API on http://127.0.0.1:${PORT} — /api/critique, /api/classify-style, /api/preview-edit`
  );
});
