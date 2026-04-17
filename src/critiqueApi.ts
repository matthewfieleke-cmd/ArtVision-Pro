import type { CritiqueResult, Medium, Style } from './types';
import { readApiJson } from './apiJson';
import { adaptCritiqueResult } from './critiqueResultAdapter';
import type { CritiquePipelineErrorPayload } from '../lib/critiqueErrors.js';
import {
  createCritiqueRequestError,
  normalizeCritiqueRequestError,
  parseCritiquePipelineErrorPayload,
} from './critiqueRequestError';
import { isAbortError } from './analysisKeepAlive';

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
  try {
    const { signal, ...jsonBody } = body;
    const res = await fetch(critiqueUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jsonBody),
      signal,
    });
    const data = await readApiJson<
      { error?: string } | CritiquePipelineErrorPayload | CritiqueResult
    >(res);
    if (!res.ok) {
      if (res.status === 402) {
        const msg =
          typeof data === 'object' && data && 'error' in data && data.error
            ? String(data.error)
            : 'Payment required';
        throw createCritiqueRequestError({
          operation: 'critique',
          status: 402,
          kind: 'payment_required',
          technicalMessage: msg,
        });
      }
      const pipelineError = parseCritiquePipelineErrorPayload(data);
      if (pipelineError) {
        throw createCritiqueRequestError({
          operation: 'critique',
          status: res.status,
          technicalMessage: pipelineError.error,
          stage: pipelineError.stage,
          details: pipelineError.details,
          attempts: pipelineError.attempts,
          backendErrorName: pipelineError.errorName,
          pipelineCode: pipelineError.code,
          debug: pipelineError.debug,
        });
      }
      throw createCritiqueRequestError({
        operation: 'critique',
        status: res.status,
        technicalMessage:
          typeof data === 'object' && data && 'error' in data && data.error
            ? String(data.error)
            : `API ${res.status}`,
      });
    }
    if ('error' in data && data.error) {
      throw createCritiqueRequestError({
        operation: 'critique',
        status: res.status,
        technicalMessage: String(data.error),
      });
    }
    const critique = data as CritiqueResult & {
      simpleFeedback?: CritiqueResult['simple'];
    };
    return adaptCritiqueResult(critique, {
      photoQuality: critique.photoQuality,
    });
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw normalizeCritiqueRequestError(error, 'critique');
  }
}
