import type { Style } from './types';

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
  const res = await fetch(classifyUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl }),
  });
  const data = (await res.json()) as { error?: string; style?: Style; rationale?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `API ${res.status}`);
  }
  if (!data.style || !data.rationale) throw new Error('Invalid response');
  return { style: data.style, rationale: data.rationale };
}
