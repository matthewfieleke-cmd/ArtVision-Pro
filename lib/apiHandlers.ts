import type { CritiqueRequestBody } from './critiqueTypes.js';
import type { PreviewEditRequestBody } from './previewEditTypes.js';
import { runOpenAIClassifyMedium } from './openaiClassifyMedium.js';
import { runOpenAIClassifyStyle } from './openaiClassifyStyle.js';
import { runOpenAICritique } from './openaiCritique.js';
import { runOpenAIPreviewEdit } from './openaiPreviewEdit.js';
import { runPreviewEditWithDedup } from './previewEditJobStore.js';

export type ApiResult =
  | { status: 200; body: unknown }
  | { status: 400 | 404 | 405 | 500 | 503; body: { error: string } };

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

export function resolveApiRoute(
  url: string | undefined
): 'critique' | 'classify-style' | 'classify-medium' | 'preview-edit' | null {
  switch (url) {
    case '/api/critique':
      return 'critique';
    case '/api/classify-style':
      return 'classify-style';
    case '/api/classify-medium':
      return 'classify-medium';
    case '/api/preview-edit':
      return 'preview-edit';
    default:
      return null;
  }
}

export async function handleApiRequest(args: {
  route: 'critique' | 'classify-style' | 'classify-medium' | 'preview-edit' | null;
  method: string | undefined;
  apiKey: string | undefined;
  body: unknown;
}): Promise<ApiResult> {
  const { route, method, apiKey, body } = args;

  if (method === 'OPTIONS') {
    return { status: 200, body: {} };
  }

  if (method !== 'POST') {
    return { status: route ? 405 : 404, body: { error: route ? 'Method not allowed' : 'Not found' } };
  }

  if (!route) {
    return { status: 404, body: { error: 'Not found' } };
  }

  if (!apiKey) {
    return { status: 503, body: { error: 'Server missing OPENAI_API_KEY' } };
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
    if (route === 'classify-medium') {
      return { status: 200, body: await runOpenAIClassifyMedium(apiKey, parsed.imageDataUrl) };
    }
    return { status: 200, body: await runOpenAIClassifyStyle(apiKey, parsed.imageDataUrl) };
  } catch (error) {
    const defaultMessage =
      route === 'critique'
        ? 'Critique failed'
        : route === 'preview-edit'
          ? 'Preview edit failed'
          : route === 'classify-medium'
            ? 'Medium classification failed'
          : 'Classification failed';
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : defaultMessage },
    };
  }
}
