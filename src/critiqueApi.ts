import type { CritiqueResult, Medium, Style } from './types';
import { readApiJson } from './apiJson';
import { finalizeCritiqueResult, migrateCritiqueSimpleFeedback } from './critiqueCoach';

type CritiqueRequestBody = {
  style: Style;
  medium: Medium;
  imageDataUrl: string;
  paintingTitle?: string;
  previousImageDataUrl?: string;
  previousCritique?: CritiqueResult;
  signal?: AbortSignal;
};

/** Same-origin API under Vite base (e.g. /repo/api/critique on GitHub Pages if you add a Pages Action for API—usually use VITE_CRITIQUE_API_URL instead). */
function sameOriginCritiquePath(): string {
  const b = import.meta.env.BASE_URL;
  const prefix = b.endsWith('/') ? b.slice(0, -1) : b;
  return `${prefix}/api/critique`;
}

function critiqueUrl(): string {
  const external = (import.meta.env.VITE_CRITIQUE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  if (external) return `${external}/api/critique`;
  return sameOriginCritiquePath();
}

/**
 * Calls the serverless critique endpoint when available. Throws on HTTP/network errors.
 */
export async function fetchCritiqueFromApi(body: CritiqueRequestBody): Promise<CritiqueResult> {
  const { signal, ...jsonBody } = body;
  const res = await fetch(critiqueUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonBody),
    signal,
  });
  const data = await readApiJson<{ error?: string } | CritiqueResult>(res);
  if (!res.ok) {
    throw new Error(typeof data === 'object' && data && 'error' in data && data.error ? String(data.error) : `API ${res.status}`);
  }
  if ('error' in data && data.error) throw new Error(String(data.error));
  const critique = data as CritiqueResult & {
    simpleFeedback?: CritiqueResult['simple'];
  };
  const normalized: CritiqueResult = {
    ...critique,
    ...(critique.simpleFeedback
      ? {
          simple: migrateCritiqueSimpleFeedback(critique.simpleFeedback) ?? critique.simpleFeedback,
        }
      : {}),
  };
  return finalizeCritiqueResult(normalized, {
    photoQuality: normalized.photoQuality,
  });
}
