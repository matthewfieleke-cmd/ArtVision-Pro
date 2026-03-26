const KEY = 'artvision-pending-preview-edit';

export type PendingPreviewRequest = {
  flowImageDataUrl: string;
  requestId: string;
  startedAt: string;
};

export function getPendingPreviewRequest(): PendingPreviewRequest | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPreviewRequest;
    if (
      !parsed ||
      typeof parsed.flowImageDataUrl !== 'string' ||
      typeof parsed.requestId !== 'string' ||
      typeof parsed.startedAt !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function setPendingPreviewRequest(request: PendingPreviewRequest): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(request));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPendingPreviewRequest(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore quota / private mode */
  }
}
