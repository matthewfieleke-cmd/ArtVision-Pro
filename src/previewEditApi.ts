import type { CritiqueCategory, Medium, Style } from './types';
import { readApiJson } from './apiJson';

export type PreviewEditPayload = {
  imageDataUrl: string;
  style: Style;
  medium: Medium;
  target: Pick<CritiqueCategory, 'criterion' | 'level' | 'feedback' | 'actionPlan'>;
};

function previewEditPath(): string {
  const external = (import.meta.env.VITE_CRITIQUE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  if (external) return `${external}/api/preview-edit`;
  const b = import.meta.env.BASE_URL;
  const prefix = b.endsWith('/') ? b.slice(0, -1) : b;
  return `${prefix}/api/preview-edit`;
}

export async function fetchPreviewEdit(payload: PreviewEditPayload): Promise<{ imageDataUrl: string; criterion: string }> {
  const res = await fetch(previewEditPath(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await readApiJson<{ error?: string; imageDataUrl?: string; criterion?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error ?? `API ${res.status}`);
  }
  if (!data.imageDataUrl) throw new Error('No image in response');
  return { imageDataUrl: data.imageDataUrl, criterion: data.criterion ?? payload.target.criterion };
}
