import type { Style } from './types';
import { getApiAuthorizationHeader } from './analysisRuntime';
import { readApiJson } from './apiJson';

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

export async function fetchClassifyStyleFromApi(imageDataUrl: string): Promise<ClassifyStyleResponse> {
  const auth = getApiAuthorizationHeader();
  const res = await fetch(classifyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: auth } : {}),
    },
    body: JSON.stringify({ imageDataUrl }),
  });
  const data = await readApiJson<{ error?: string; style?: Style; rationale?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error ?? `API ${res.status}`);
  }
  if (!data.style || !data.rationale) throw new Error('Invalid response');
  return { style: data.style, rationale: data.rationale };
}
