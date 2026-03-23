import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { PreviewEditRequestBody } from '../lib/previewEditTypes.js';
import { runOpenAIPreviewEdit } from '../lib/openaiPreviewEdit.js';

function setCors(res: VercelResponse, origin: string | undefined): void {
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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  setCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'Server missing OPENAI_API_KEY' });
    return;
  }

  try {
    const body = req.body as PreviewEditRequestBody;
    if (!body?.imageDataUrl || typeof body.imageDataUrl !== 'string') {
      res.status(400).json({ error: 'imageDataUrl required' });
      return;
    }
    if (!body.style || !body.medium || !body.target?.criterion) {
      res.status(400).json({ error: 'style, medium, and target required' });
      return;
    }
    const result = await runOpenAIPreviewEdit(key, body);
    res.status(200).json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Preview edit failed' });
  }
}
