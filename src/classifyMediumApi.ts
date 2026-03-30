import type { Medium } from './types';
import { readApiJson } from './apiJson';

export type ClassifyMediumResponse = {
  medium: Medium;
  rationale: string;
};

function classifyMediumUrl(): string {
  const external = (import.meta.env.VITE_CRITIQUE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  if (external) return `${external}/api/classify-medium`;
  const b = import.meta.env.BASE_URL;
  const prefix = b.endsWith('/') ? b.slice(0, -1) : b;
  return `${prefix}/api/classify-medium`;
}

export async function fetchClassifyMediumFromApi(imageDataUrl: string): Promise<ClassifyMediumResponse> {
  const res = await fetch(classifyMediumUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl }),
  });
  const data = await readApiJson<{ error?: string; medium?: Medium; rationale?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error ?? `API ${res.status}`);
  }
  if (!data.medium || !data.rationale) throw new Error('Invalid response');
  return { medium: data.medium, rationale: data.rationale };
}
