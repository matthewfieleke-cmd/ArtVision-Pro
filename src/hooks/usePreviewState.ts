import { useReducer, useCallback } from 'react';
import type { CritiqueCategory } from '../types';

type PreviewTarget = { kind: 'single'; criterion: CritiqueCategory['criterion'] };

export type PreviewState = {
  loading: boolean;
  loadingTarget: PreviewTarget | null;
  error: string | null;
  /** True when server returned 402 — show Pay to open Stripe Checkout. */
  errorPaymentRequired: boolean;
  activeEditId: string | null;
  compareOpen: boolean;
  compareSeen: boolean;
};

type PreviewAction =
  | { type: 'RESET' }
  | { type: 'START_LOADING'; target: PreviewTarget }
  | { type: 'COMPLETE'; activeEditId: string }
  | { type: 'FAIL'; error: string; paymentRequired?: boolean }
  | { type: 'SELECT_EDIT'; id: string }
  | { type: 'OPEN_COMPARE' }
  | { type: 'CLOSE_COMPARE' }
  | { type: 'CLOSE_COMPARE_ONLY' };

const INITIAL_STATE: PreviewState = {
  loading: false,
  loadingTarget: null,
  error: null,
  errorPaymentRequired: false,
  activeEditId: null,
  compareOpen: false,
  compareSeen: false,
};

function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
    case 'RESET':
      return INITIAL_STATE;
    case 'START_LOADING':
      return {
        ...state,
        loading: true,
        loadingTarget: action.target,
        error: null,
        errorPaymentRequired: false,
      };
    case 'COMPLETE':
      return {
        ...state,
        loading: false,
        loadingTarget: null,
        error: null,
        errorPaymentRequired: false,
        activeEditId: action.activeEditId,
        compareOpen: false,
        compareSeen: false,
      };
    case 'FAIL':
      return {
        ...state,
        loading: false,
        loadingTarget: null,
        error: action.error,
        errorPaymentRequired: Boolean(action.paymentRequired),
      };
    case 'SELECT_EDIT':
      return { ...state, activeEditId: action.id };
    case 'OPEN_COMPARE':
      return { ...state, compareOpen: true, compareSeen: true };
    case 'CLOSE_COMPARE':
      return { ...state, compareOpen: false };
    case 'CLOSE_COMPARE_ONLY':
      return { ...state, compareOpen: false };
    default:
      return state;
  }
}

export function usePreviewState() {
  const [preview, dispatch] = useReducer(previewReducer, INITIAL_STATE);

  const resetPreview = useCallback(() => dispatch({ type: 'RESET' }), []);
  const startPreviewLoading = useCallback(
    (target: PreviewTarget) => dispatch({ type: 'START_LOADING', target }),
    []
  );
  const completePreview = useCallback(
    (activeEditId: string) => dispatch({ type: 'COMPLETE', activeEditId }),
    []
  );
  const failPreview = useCallback(
    (error: string, opts?: { paymentRequired?: boolean }) =>
      dispatch({ type: 'FAIL', error, paymentRequired: opts?.paymentRequired }),
    []
  );
  const selectEdit = useCallback(
    (id: string) => dispatch({ type: 'SELECT_EDIT', id }),
    []
  );
  const openCompare = useCallback(() => dispatch({ type: 'OPEN_COMPARE' }), []);
  const closeCompare = useCallback(() => dispatch({ type: 'CLOSE_COMPARE' }), []);

  return {
    preview,
    resetPreview,
    startPreviewLoading,
    completePreview,
    failPreview,
    selectEdit,
    openCompare,
    closeCompare,
  } as const;
}
