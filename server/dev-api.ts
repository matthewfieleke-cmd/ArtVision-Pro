/**
 * Local dev API: mirrors Vercel /api/* routes.
 * Run: npm run dev:api — Vite proxies /api → http://127.0.0.1:8787
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from 'dotenv';
import { applyCorsHeaders, handleApiRequest, resolveApiRoute } from '../lib/apiHandlers';

config({ path: '.env.local' });
config({ path: '.env' });

const PORT = Number(process.env.CRITIQUE_API_PORT ?? 8787);
const MAX_BODY = 35 * 1024 * 1024;

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  applyCorsHeaders((name, value) => res.setHeader(name, value), req.headers.origin);

  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > MAX_BODY) {
      res.writeHead(413);
      res.end(JSON.stringify({ error: 'Payload too large' }));
      return;
    }
  }

  let parsedBody: unknown;
  try {
    parsedBody = body ? JSON.parse(body) : {};
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid JSON body' }));
    return;
  }

  const result = await handleApiRequest({
    route: resolveApiRoute(req.url),
    method: req.method,
    apiKey: process.env.OPENAI_API_KEY,
    body: parsedBody,
  });

  res.writeHead(result.status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result.body));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(
    `API on http://127.0.0.1:${PORT} — /api/critique, /api/classify-style, /api/classify-medium, /api/preview-edit`
  );
});
