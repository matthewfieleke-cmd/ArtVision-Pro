import type { CritiqueResult, Medium, Style } from './types';

type CritiqueRequestBody = {
  style: Style;
  medium: Medium;
  imageDataUrl: string;
  previousImageDataUrl?: string;
  previousCritique?: CritiqueResult;
};

function critiqueUrl(): string {
  const base = (import.meta.env.VITE_CRITIQUE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  return base ? `${base}/api/critique` : '/api/critique';
}

/**
 * Calls the serverless critique endpoint when available. Throws on HTTP/network errors.
 */
export async function fetchCritiqueFromApi(body: CritiqueRequestBody): Promise<CritiqueResult> {
  const res = await fetch(critiqueUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { error?: string } | CritiqueResult;
  if (!res.ok) {
    throw new Error(typeof data === 'object' && data && 'error' in data && data.error ? String(data.error) : `API ${res.status}`);
  }
  if ('error' in data && data.error) throw new Error(String(data.error));
  return data as CritiqueResult;
}

export function shouldTryApiFirst(): boolean {
  if (import.meta.env.VITE_USE_LOCAL_CRITIQUE === 'true') return false;
  return true;
}
