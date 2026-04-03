import type { Style } from './types';
import { readApiJson } from './apiJson';
import {
  createCritiqueRequestError,
  normalizeCritiqueRequestError,
} from './critiqueRequestError';
import { isAbortError } from './analysisKeepAlive';

export type ClassifyStyleResponse = {
  style: Style;
  rationale: string;
};

function classifyUrl(): string {
  const external = (import.meta.env.VITE_CRITIQUE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  if (external) return `${external}/api/classify-style`;
  const b = import.meta.env.BASE_URL;
  const prefix = b.endsWith('/') ? b.slice(0, -1) : b;
  return `${prefix}/api/classify-style`;
}

export async function fetchClassifyStyleFromApi(
  imageDataUrl: string,
  signal?: AbortSignal
): Promise<ClassifyStyleResponse> {
  try {
    const res = await fetch(classifyUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl }),
      signal,
    });
    const data = await readApiJson<{ error?: string; style?: Style; rationale?: string }>(res);
    if (!res.ok) {
      throw createCritiqueRequestError({
        operation: 'classify',
        status: res.status,
        technicalMessage: data.error ?? `API ${res.status}`,
      });
    }
    if (!data.style || !data.rationale) {
      throw createCritiqueRequestError({
        operation: 'classify',
        kind: 'invalid_response',
        technicalMessage: 'Invalid response',
      });
    }
    return { style: data.style, rationale: data.rationale };
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw normalizeCritiqueRequestError(error, 'classify');
  }
}
