import { useCallback, useReducer } from 'react';
import type { CritiqueRequestError } from '../critiqueRequestError';

export type CritiqueAsyncState =
  | { status: 'idle' }
  | { status: 'classifying' }
  | { status: 'analyzing'; retryNotice: boolean }
  | { status: 'error'; error: CritiqueRequestError };

type CritiqueAsyncAction =
  | { type: 'START_CLASSIFY' }
  | { type: 'START_ANALYSIS' }
  | { type: 'NOTE_ANALYSIS_RETRY' }
  | { type: 'FINISH' }
  | { type: 'FAIL'; error: CritiqueRequestError }
  | { type: 'CLEAR' };

const INITIAL_STATE: CritiqueAsyncState = { status: 'idle' };

function critiqueAsyncReducer(
  state: CritiqueAsyncState,
  action: CritiqueAsyncAction
): CritiqueAsyncState {
  switch (action.type) {
    case 'START_CLASSIFY':
      return { status: 'classifying' };
    case 'START_ANALYSIS':
      return { status: 'analyzing', retryNotice: false };
    case 'NOTE_ANALYSIS_RETRY':
      return state.status === 'analyzing' ? { ...state, retryNotice: true } : state;
    case 'FINISH':
    case 'CLEAR':
      return INITIAL_STATE;
    case 'FAIL':
      return { status: 'error', error: action.error };
    default:
      return state;
  }
}

export function useCritiqueAsyncState() {
  const [asyncState, dispatch] = useReducer(critiqueAsyncReducer, INITIAL_STATE);

  const startClassify = useCallback(() => dispatch({ type: 'START_CLASSIFY' }), []);
  const startAnalysis = useCallback(() => dispatch({ type: 'START_ANALYSIS' }), []);
  const noteAnalysisRetry = useCallback(() => dispatch({ type: 'NOTE_ANALYSIS_RETRY' }), []);
  const finishRequest = useCallback(() => dispatch({ type: 'FINISH' }), []);
  const failRequest = useCallback(
    (error: CritiqueRequestError) => dispatch({ type: 'FAIL', error }),
    []
  );
  const clearAsyncState = useCallback(() => dispatch({ type: 'CLEAR' }), []);

  return {
    asyncState,
    startClassify,
    startAnalysis,
    noteAnalysisRetry,
    finishRequest,
    failRequest,
    clearAsyncState,
  } as const;
}
