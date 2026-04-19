/**
 * Local dev API: mirrors Vercel /api/* routes.
 * Run: npm run dev:api — Vite proxies /api → http://127.0.0.1:8787
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from 'dotenv';
import { applyCorsHeaders, handleApiRequest, resolveApiRoute } from '../lib/apiHandlers';
import { createStripeCheckoutSession } from '../lib/stripeCreateCheckoutSession';
import { handleStripeCheckoutReturn } from '../lib/stripeCheckoutReturn';
import {
  isStripePaywallEnabled,
  STRIPE_CRITIQUE_AMOUNT_CENTS,
  STRIPE_PREVIEW_EDIT_AMOUNT_CENTS,
} from '../lib/stripePricing';

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

  const pathname = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;

  if (pathname === '/api/stripe/checkout-return' && req.method === 'GET') {
    const q = new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('session_id') ?? undefined;
    const ret = await handleStripeCheckoutReturn({
      sessionId: q,
      requestOrigin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      requestHost: req.headers.host,
      forwardedHost: req.headers['x-forwarded-host'],
      forwardedProto: req.headers['x-forwarded-proto'],
    });
    if (ret.status === 302) {
      res.writeHead(302, { Location: ret.location });
      res.end();
      return;
    }
    res.writeHead(ret.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ret.body));
    return;
  }

  if (pathname === '/api/stripe/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        paywallEnabled: isStripePaywallEnabled(),
        critiqueAmountCents: STRIPE_CRITIQUE_AMOUNT_CENTS,
        previewEditAmountCents: STRIPE_PREVIEW_EDIT_AMOUNT_CENTS,
      })
    );
    return;
  }

  if (pathname === '/api/stripe/create-checkout-session' && req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/stripe/create-checkout-session' && req.method === 'POST') {
    if (!isStripePaywallEnabled()) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Stripe checkout is not configured' }));
      return;
    }
    try {
      const body = parsedBody as { kind?: string; cancelPathHash?: string };
      const kind = body.kind === 'preview_edit' ? 'preview_edit' : 'critique';
      const { url } = await createStripeCheckoutSession(process.env.STRIPE_SECRET_KEY!.trim(), {
        kind,
        cancelPathHash: typeof body.cancelPathHash === 'string' ? body.cancelPathHash : undefined,
      }, {
        requestOrigin: typeof req.headers.origin === 'string' ? req.headers.origin : undefined,
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Checkout failed' }));
    }
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
    `API on http://127.0.0.1:${PORT} — /api/critique, /api/classify-style, /api/classify-medium, /api/preview-edit, /api/stripe/*`
  );
});
