import type { CritiqueRequestBody } from './critiqueTypes.js';
import type { PreviewEditRequestBody } from './previewEditTypes.js';
import {
  CritiquePipelineError,
  CritiqueUninterpretableImageError,
  type CritiquePipelineErrorPayload,
  serializeCritiquePipelineError,
} from './critiqueErrors.js';
import { runOpenAIClassifyMedium } from './openaiClassifyMedium.js';
import { runOpenAIClassifyStyle } from './openaiClassifyStyle.js';
import { runOpenAICritique } from './openaiCritique.js';
import { runOpenAIPreviewEdit } from './openaiPreviewEdit.js';
import { runPreviewEditWithDedup } from './previewEditJobStore.js';
import { assertPaidOrThrow, PaymentRequiredError } from './stripePaymentVerification.js';
import { markStripePaymentIntentConsumed } from './stripeMarkConsumed.js';

export type ApiResult =
  | { status: 200; body: unknown }
  | {
      status: 400 | 402 | 404 | 405 | 422 | 500 | 503;
      body: { error: string } | CritiquePipelineErrorPayload;
    };

export function applyCorsHeaders(
  setHeader: (name: string, value: string) => void,
  origin: string | undefined
): void {
  if (origin) {
    setHeader('Access-Control-Allow-Origin', origin);
    setHeader('Vary', 'Origin');
  } else {
    setHeader('Access-Control-Allow-Origin', '*');
  }
  setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  setHeader('Access-Control-Max-Age', '86400');
}

export function resolveApiRoute(
  url: string | undefined
): 'critique' | 'classify-style' | 'classify-medium' | 'preview-edit' | null {
  const path = url ? new URL(url, 'http://local').pathname : '';
  switch (path) {
    case '/api/critique':
      return 'critique';
    case '/api/classify-style':
      return 'classify-style';
    case '/api/classify-medium':
      return 'classify-medium';
    case '/api/preview-edit':
      return 'preview-edit';
    default:
      return null;
  }
}

export async function handleApiRequest(args: {
  route: 'critique' | 'classify-style' | 'classify-medium' | 'preview-edit' | null;
  method: string | undefined;
  apiKey: string | undefined;
  body: unknown;
}): Promise<ApiResult> {
  const { route, method, apiKey, body } = args;

  if (method === 'OPTIONS') {
    return { status: 200, body: {} };
  }

  if (method !== 'POST') {
    return { status: route ? 405 : 404, body: { error: route ? 'Method not allowed' : 'Not found' } };
  }

  if (!route) {
    return { status: 404, body: { error: 'Not found' } };
  }

  if (!apiKey) {
    return { status: 503, body: { error: 'Server missing OPENAI_API_KEY' } };
  }

  try {
    if (route === 'critique') {
      const parsed = body as CritiqueRequestBody;
      if (!parsed?.imageDataUrl || typeof parsed.imageDataUrl !== 'string') {
        return { status: 400, body: { error: 'imageDataUrl required' } };
      }
      if (!parsed.style || !parsed.medium) {
        return { status: 400, body: { error: 'style and medium required' } };
      }
      const paid = await assertPaidOrThrow({
        route: 'critique',
        stripeCheckoutJwt: parsed.stripeCheckoutJwt,
      });
      const critiquePayload = { ...parsed };
      delete (critiquePayload as { stripeCheckoutJwt?: string }).stripeCheckoutJwt;
      let critiqueBody: Awaited<ReturnType<typeof runOpenAICritique>> | undefined;
      try {
        critiqueBody = await runOpenAICritique(apiKey, critiquePayload);
      } finally {
        if (paid.paymentIntentId && critiqueBody) {
          try {
            await markStripePaymentIntentConsumed(paid.paymentIntentId);
          } catch (e) {
            console.error('[stripe] failed to mark payment consumed', e);
          }
        }
      }
      return { status: 200, body: critiqueBody! };
    }

    if (route === 'preview-edit') {
      const parsed = body as PreviewEditRequestBody;
      if (!parsed?.imageDataUrl || typeof parsed.imageDataUrl !== 'string') {
        return { status: 400, body: { error: 'imageDataUrl required' } };
      }
      if (!parsed.style || !parsed.medium || !parsed.target?.criterion) {
        return { status: 400, body: { error: 'style, medium, and target required' } };
      }
      const paid = await assertPaidOrThrow({
        route: 'preview-edit',
        stripeCheckoutJwt: parsed.stripeCheckoutJwt,
      });
      const previewPayload = { ...parsed };
      delete (previewPayload as { stripeCheckoutJwt?: string }).stripeCheckoutJwt;
      let previewBody: Awaited<ReturnType<typeof runPreviewEditWithDedup>> | undefined;
      try {
        previewBody = await runPreviewEditWithDedup(previewPayload, () =>
          runOpenAIPreviewEdit(apiKey, previewPayload)
        );
      } finally {
        if (paid.paymentIntentId && previewBody) {
          try {
            await markStripePaymentIntentConsumed(paid.paymentIntentId);
          } catch (e) {
            console.error('[stripe] failed to mark payment consumed', e);
          }
        }
      }
      return { status: 200, body: previewBody! };
    }

    const parsed = body as { imageDataUrl?: string };
    if (!parsed?.imageDataUrl || typeof parsed.imageDataUrl !== 'string') {
      return { status: 400, body: { error: 'imageDataUrl required' } };
    }
    if (route === 'classify-medium') {
      return { status: 200, body: await runOpenAIClassifyMedium(apiKey, parsed.imageDataUrl) };
    }
    return { status: 200, body: await runOpenAIClassifyStyle(apiKey, parsed.imageDataUrl) };
  } catch (error) {
    if (error instanceof PaymentRequiredError) {
      return {
        status: 402,
        body: { error: error.message },
      };
    }
    const defaultMessage =
      route === 'critique'
        ? 'Critique failed'
        : route === 'preview-edit'
          ? 'Preview edit failed'
          : route === 'classify-medium'
            ? 'Medium classification failed'
          : 'Classification failed';
    if (route === 'critique' && error instanceof CritiqueUninterpretableImageError) {
      console.warn('[critique uninterpretable image]', serializeCritiquePipelineError(error));
      return {
        status: 422,
        body: serializeCritiquePipelineError(error),
      };
    }
    if (route === 'critique' && error instanceof CritiquePipelineError) {
      console.error('[critique pipeline error]', serializeCritiquePipelineError(error));
      return {
        status: 500,
        body: serializeCritiquePipelineError(error),
      };
    }
    return {
      status: 500,
      body: { error: error instanceof Error ? error.message : defaultMessage },
    };
  }
}
