import type { CritiqueRequestBody } from './critiqueTypes.js';
import type { PreviewEditRequestBody } from './previewEditTypes.js';
import { runOpenAIClassifyStyle } from './openaiClassifyStyle.js';
import { runOpenAICritique } from './openaiCritique.js';
import { runOpenAIPreviewEdit } from './openaiPreviewEdit.js';
import { runPreviewEditWithDedup } from './previewEditJobStore.js';
import { validateOpenAIApiKey } from './openaiValidateKey.js';

export type ApiResult =
  | { status: 200; body: unknown }
  | { status: 400 | 401 | 404 | 405 | 500 | 503; body: { error: string } };

export function applyCorsHeaders(
  setHeader: (name: string, value: string) => void,
  origin: string | undefined
): void {
  if (origin) {
    setHeader('Access-Control-Allow-Origin', origin);
    setHeader('Vary', 'Origin');
  } else {
    setHeader('Access-Control-Allow-Origin', '*');
  }
  setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  setHeader('Access-Control-Max-Age', '86400');
}

export function apiPathname(url: string | undefined): string {
  if (!url) return '';
  const q = url.indexOf('?');
  return q >= 0 ? url.slice(0, q) : url;
}

export function resolveApiRoute(
  url: string | undefined
): 'critique' | 'classify-style' | 'preview-edit' | 'validate-api-key' | null {
  const path = apiPathname(url);
  switch (path) {
    case '/api/critique':
      return 'critique';
    case '/api/classify-style':
      return 'classify-style';
    case '/api/preview-edit':
      return 'preview-edit';
    case '/api/validate-api-key':
      return 'validate-api-key';
    default:
      return null;
  }
}

function extractBearerToken(authorization: string | undefined): string | undefined {
  if (!authorization || typeof authorization !== 'string') return undefined;
  const m = authorization.match(/^\s*Bearer\s+(\S+)\s*$/i);
  return m?.[1]?.trim() || undefined;
}

export function resolveOpenAIKeyForRequest(args: {
  serverKey: string | undefined;
  authorizationHeader: string | undefined;
}): string | undefined {
  const bearer = extractBearerToken(args.authorizationHeader);
  if (bearer) return bearer;
  const s = args.serverKey?.trim();
  return s || undefined;
}

export async function handleApiRequest(args: {
  route: 'critique' | 'classify-style' | 'preview-edit' | 'validate-api-key' | null;
  method: string | undefined;
  apiKey: string | undefined;
  authorizationHeader?: string | undefined;
  body: unknown;
}): Promise<ApiResult> {
  const { route, method, body } = args;
  const apiKey = resolveOpenAIKeyForRequest({
    serverKey: args.apiKey,
    authorizationHeader: args.authorizationHeader,
  });

  if (method === 'OPTIONS') {
    return { status: 200, body: {} };
  }

  if (method !== 'POST') {
    return { status: route ? 405 : 404, body: { error: route ? 'Method not allowed' : 'Not found' } };
  }

  if (!route) {
    return { status: 404, body: { error: 'Not found' } };
  }

  if (route === 'validate-api-key') {
    const parsed = body as { apiKey?: string };
    const raw = typeof parsed?.apiKey === 'string' ? parsed.apiKey : '';
    if (!raw.trim()) {
      return { status: 400, body: { error: 'apiKey required' } };
    }
    try {
      const ok = await validateOpenAIApiKey(raw);
      if (!ok) {
        return { status: 401, body: { error: 'Invalid API key' } };
      }
      return { status: 200, body: { ok: true } };
    } catch (error) {
      return {
        status: 500,
        body: { error: error instanceof Error ? error.message : 'Validation failed' },
      };
    }
  }

  if (!apiKey) {
    return {
      status: 503,
      body: {
        error:
          'No API key: add Authorization: Bearer <key> or set OPENAI_API_KEY on the server.',
      },
    };
  }

  try {
    if (route === 'critique') {
      const parsed = body as CritiqueRequestBody;
      if (!parsed?.imageDataUrl || typeof parsed.imageDataUrl !== 'string') {
        return { status: 400, body: { error: 'imageDataUrl required' } };
      }
      if (!parsed.style || !parsed.medium) {
        return { status: 400, body: { error: 'style and medium required' } };
      }
      return { status: 200, body: await runOpenAICritique(apiKey, parsed) };
    }

    if (route === 'preview-edit') {
      const parsed = body as PreviewEditRequestBody;
      if (!parsed?.imageDataUrl || typeof parsed.imageDataUrl !== 'string') {
        return { status: 400, body: { error: 'imageDataUrl required' } };
      }
      if (!parsed.style || !parsed.medium || !parsed.target?.criterion) {
        return { status: 400, body: { error: 'style, medium, and target required' } };
      }
      return {
        status: 200,
        body: await runPreviewEditWithDedup(parsed, () => runOpenAIPreviewEdit(apiKey, parsed)),
      };
    }

    const parsed = body as { imageDataUrl?: string };
    if (!parsed?.imageDataUrl || typeof parsed.imageDataUrl !== 'string') {
      return { status: 400, body: { error: 'imageDataUrl required' } };
    }
    return { status: 200, body: await runOpenAIClassifyStyle(apiKey, parsed.imageDataUrl) };
  } catch (error) {
    const defaultMessage =
      route === 'critique'
        ? 'Critique failed'
        : route === 'preview-edit'
          ? 'Preview edit failed'
          : 'Classification failed';
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : defaultMessage },
    };
  }
}
