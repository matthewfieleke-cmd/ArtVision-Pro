import { readApiJson } from './apiJson';

const STORAGE_MODE = 'artvision-product-mode-v1';
const STORAGE_KEY = 'artvision-user-api-key-v1';

export type ProductMode = 'artvision' | 'artvision-pro';

function sameOriginApiPrefix(): string {
  const b = import.meta.env.BASE_URL;
  return b.endsWith('/') ? b.slice(0, -1) : b;
}

function externalApiBase(): string {
  return (import.meta.env.VITE_CRITIQUE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
}

function apiRoot(): string {
  const ext = externalApiBase();
  return ext || sameOriginApiPrefix();
}

function validateApiKeyUrl(): string {
  return `${apiRoot()}/api/validate-api-key`;
}

let tryApiFirstCache = false;
let authorizationHeaderCache: string | undefined;

export function syncAnalysisRuntime(productMode: ProductMode, userApiKey: string): void {
  const trimmed = userApiKey.trim();
  const useCloud =
    import.meta.env.VITE_USE_LOCAL_CRITIQUE !== 'true' &&
    productMode === 'artvision-pro' &&
    trimmed.length > 0;
  tryApiFirstCache = useCloud;
  authorizationHeaderCache = useCloud ? `Bearer ${trimmed}` : undefined;
}

export function shouldTryApiFirst(): boolean {
  if (import.meta.env.VITE_USE_LOCAL_CRITIQUE === 'true') return false;
  return tryApiFirstCache;
}

export function getApiAuthorizationHeader(): string | undefined {
  return authorizationHeaderCache;
}

export function loadStoredProductMode(): ProductMode {
  try {
    const v = localStorage.getItem(STORAGE_MODE);
    if (v === 'artvision-pro') return 'artvision-pro';
  } catch {
    /* ignore */
  }
  return 'artvision';
}

export function persistProductMode(mode: ProductMode): void {
  try {
    localStorage.setItem(STORAGE_MODE, mode);
  } catch {
    /* ignore */
  }
}

export function loadStoredUserApiKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function persistUserApiKey(key: string): void {
  try {
    if (key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    /* ignore */
  }
}

export async function validateUserApiKeyWithBackend(apiKey: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, message: 'Enter your API key.' };
  }
  try {
    const res = await fetch(validateApiKeyUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: trimmed }),
    });
    const data = await readApiJson<{ error?: string; ok?: boolean }>(res);
    if (res.ok && data && typeof data === 'object' && 'ok' in data && data.ok) {
      return { ok: true };
    }
    const err =
      typeof data === 'object' && data && 'error' in data && data.error
        ? String(data.error)
        : `Request failed (${res.status})`;
    return { ok: false, message: err };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Could not reach the API to verify your key.',
    };
  }
}
