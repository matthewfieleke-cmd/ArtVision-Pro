import type { CritiqueResult, Medium, SavedPainting, SavedPreviewEdit, Style } from './types';

export type StyleMode = 'manual' | 'auto';
export type CritiqueSource = 'api';

type FlowShared = {
  styleMode: StyleMode;
  workingTitle: string;
  originalImageDataUrl?: string;
  styleClassifyMeta?: { rationale: string; source: CritiqueSource };
  mediumClassifyMeta?: { medium: Medium; rationale: string; source: CritiqueSource };
  classifySourceImageDataUrl?: string;
  savedPaintingId?: string;
};

type NewFlowBase = FlowShared & {
  mode: 'new';
};

type ResubmitFlowBase = FlowShared & {
  mode: 'resubmit';
  style: Style;
  medium: Medium;
  targetPainting: SavedPainting;
};

export type SetupFlow = (NewFlowBase & {
  step: 'setup';
  style: Style | null;
  medium: Medium | null;
}) | (ResubmitFlowBase & { step: 'setup' });

export type CaptureFlow = (NewFlowBase & {
  step: 'capture';
  style: Style;
  medium: Medium;
}) | (ResubmitFlowBase & { step: 'capture' });

export type AnalyzingFlow = (NewFlowBase & {
  step: 'analyzing';
  style: Style;
  medium: Medium;
  imageDataUrl: string;
}) | (ResubmitFlowBase & {
  step: 'analyzing';
  imageDataUrl: string;
});

export type ResultsFlow = (NewFlowBase & {
  step: 'results';
  style: Style;
  medium: Medium;
  imageDataUrl: string;
  critique: CritiqueResult;
  critiqueSource: CritiqueSource;
  /** Session-only: AI previews generated before save (not serialized to sessionStorage if large). */
  sessionPreviewEdits?: SavedPreviewEdit[];
}) | (ResubmitFlowBase & {
  step: 'results';
  imageDataUrl: string;
  critique: CritiqueResult;
  critiqueSource: CritiqueSource;
  sessionPreviewEdits?: SavedPreviewEdit[];
});

export type CritiqueFlow = SetupFlow | CaptureFlow | AnalyzingFlow | ResultsFlow;

function sharedFields(flow: CritiqueFlow): FlowShared {
  return {
    styleMode: flow.styleMode,
    workingTitle: flow.workingTitle,
    ...(flow.originalImageDataUrl ? { originalImageDataUrl: flow.originalImageDataUrl } : {}),
    ...(flow.styleClassifyMeta ? { styleClassifyMeta: flow.styleClassifyMeta } : {}),
    ...(flow.mediumClassifyMeta ? { mediumClassifyMeta: flow.mediumClassifyMeta } : {}),
    ...(flow.classifySourceImageDataUrl ? { classifySourceImageDataUrl: flow.classifySourceImageDataUrl } : {}),
    ...(flow.savedPaintingId ? { savedPaintingId: flow.savedPaintingId } : {}),
  };
}

export function createNewFlow(): SetupFlow {
  return {
    mode: 'new',
    step: 'setup',
    styleMode: 'manual',
    style: null,
    medium: null,
    workingTitle: '',
  };
}

export function createResubmitFlow(painting: SavedPainting): CaptureFlow {
  return {
    mode: 'resubmit',
    step: 'capture',
    styleMode: 'manual',
    style: painting.style,
    medium: painting.medium,
    workingTitle: painting.title,
    targetPainting: painting,
  };
}

export function updateWorkingTitle<T extends CritiqueFlow>(flow: T, workingTitle: string): T {
  return {
    ...flow,
    workingTitle,
  };
}

export function chooseStyle(flow: SetupFlow, style: Style): SetupFlow {
  return {
    ...flow,
    style,
  };
}

export function chooseMedium(flow: SetupFlow, medium: Medium): SetupFlow {
  return {
    ...flow,
    medium,
  };
}

export function switchToManualStyle(flow: SetupFlow): SetupFlow {
  return {
    ...flow,
    styleMode: 'manual',
    styleClassifyMeta: undefined,
    mediumClassifyMeta: undefined,
    classifySourceImageDataUrl: undefined,
  };
}

export function switchToAutoStyle(flow: SetupFlow): SetupFlow {
  if (flow.mode === 'resubmit') {
    return {
      ...flow,
      styleMode: 'auto',
      styleClassifyMeta: undefined,
      mediumClassifyMeta: undefined,
      classifySourceImageDataUrl: undefined,
    };
  }
  return {
    ...flow,
    styleMode: 'auto',
    style: null,
    styleClassifyMeta: undefined,
    mediumClassifyMeta: undefined,
    classifySourceImageDataUrl: undefined,
  };
}

export function applyDetectedStyle(
  flow: SetupFlow,
  result: {
    style: Style;
    rationale: string;
    source: CritiqueSource;
    imageDataUrl: string;
    detectedMedium?: Medium;
    mediumRationale?: string;
    /** When medium comes from a different pipeline than style (e.g. API style + local medium). */
    mediumSource?: CritiqueSource;
  }
): SetupFlow {
  const hasMediumRead =
    result.detectedMedium != null &&
    typeof result.mediumRationale === 'string' &&
    result.mediumRationale.trim().length > 0;
  const mediumMetaSource = result.mediumSource ?? result.source;

  return {
    ...flow,
    style: result.style,
    styleClassifyMeta: { rationale: result.rationale, source: result.source },
    ...(hasMediumRead
      ? {
          medium: result.detectedMedium!,
          mediumClassifyMeta: {
            medium: result.detectedMedium!,
            rationale: result.mediumRationale!.trim(),
            source: mediumMetaSource,
          },
        }
      : {}),
    classifySourceImageDataUrl: result.imageDataUrl,
  };
}

export function clearClassifySource(flow: SetupFlow): SetupFlow {
  return {
    ...flow,
    mediumClassifyMeta: undefined,
    classifySourceImageDataUrl: undefined,
  };
}

export function canContinueFromSetup(flow: SetupFlow, classifyBusy: boolean): boolean {
  if (!flow.medium) return false;
  if (flow.styleMode === 'manual') return flow.style !== null;
  return flow.style !== null && !classifyBusy;
}

export function enterCapture(flow: SetupFlow): CaptureFlow | null {
  if (flow.mode === 'resubmit') {
    return {
      ...flow,
      step: 'capture',
    };
  }
  if (!flow.style || !flow.medium) return null;
  return {
    ...sharedFields(flow),
    mode: 'new',
    step: 'capture',
    style: flow.style,
    medium: flow.medium,
  };
}

export function beginAnalysis(flow: SetupFlow | CaptureFlow, imageDataUrl: string): AnalyzingFlow | null {
  if (flow.mode === 'resubmit') {
    return {
      ...flow,
      step: 'analyzing',
      imageDataUrl,
    };
  }
  if (!flow.style || !flow.medium) return null;
  return {
    ...sharedFields(flow),
    mode: 'new',
    step: 'analyzing',
    style: flow.style,
    medium: flow.medium,
    imageDataUrl,
  };
}

export function completeAnalysis(
  flow: AnalyzingFlow,
  result: { imageDataUrl: string; critique: CritiqueResult; critiqueSource: CritiqueSource }
): ResultsFlow {
  return {
    ...flow,
    step: 'results',
    imageDataUrl: result.imageDataUrl,
    critique: result.critique,
    critiqueSource: result.critiqueSource,
    sessionPreviewEdits: [],
    classifySourceImageDataUrl: undefined,
  };
}

export function recoverFromAnalysisError(flow: AnalyzingFlow): SetupFlow | CaptureFlow {
  if (flow.classifySourceImageDataUrl) {
    if (flow.mode === 'resubmit') {
      return {
        ...sharedFields(flow),
        mode: 'resubmit',
        step: 'setup',
        style: flow.style,
        medium: flow.medium,
        targetPainting: flow.targetPainting,
      };
    }
    return {
      ...sharedFields(flow),
      mode: 'new',
      step: 'setup',
      style: flow.style,
      medium: flow.medium,
    };
  }

  if (flow.mode === 'resubmit') {
    return {
      ...sharedFields(flow),
      mode: 'resubmit',
      step: 'capture',
      style: flow.style,
      medium: flow.medium,
      targetPainting: flow.targetPainting,
    };
  }
  return {
    ...sharedFields(flow),
    mode: 'new',
    step: 'capture',
    style: flow.style,
    medium: flow.medium,
  };
}

export function backFromCapture(flow: CaptureFlow): SetupFlow | null {
  if (flow.mode === 'resubmit') return null;
  return {
    ...sharedFields(flow),
    mode: 'new',
    step: 'setup',
    style: flow.style,
    medium: flow.medium,
  };
}

export function backFromResults(flow: ResultsFlow): SetupFlow | CaptureFlow {
  if (
    flow.mode === 'new' &&
    flow.styleMode === 'auto' &&
    flow.styleClassifyMeta &&
    flow.imageDataUrl
  ) {
    return {
      ...sharedFields(flow),
      mode: 'new',
      step: 'setup',
      style: flow.style,
      medium: flow.medium,
      classifySourceImageDataUrl: flow.imageDataUrl,
    };
  }

  if (flow.mode === 'resubmit') {
    return {
      ...sharedFields(flow),
      mode: 'resubmit',
      step: 'capture',
      style: flow.style,
      medium: flow.medium,
      targetPainting: flow.targetPainting,
    };
  }

  return {
    ...sharedFields(flow),
    mode: 'new',
    step: 'capture',
    style: flow.style,
    medium: flow.medium,
  };
}

export function isResultsFlow(flow: CritiqueFlow | null | undefined): flow is ResultsFlow {
  return flow?.step === 'results';
}

export function isCaptureFlow(flow: CritiqueFlow | null | undefined): flow is CaptureFlow {
  return flow?.step === 'capture';
}

export function isCritiqueFlow(value: unknown): value is CritiqueFlow {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<CritiqueFlow>;
  if (
    candidate.step !== 'setup' &&
    candidate.step !== 'capture' &&
    candidate.step !== 'analyzing' &&
    candidate.step !== 'results'
  ) {
    return false;
  }

  if (candidate.mode !== 'new' && candidate.mode !== 'resubmit') return false;
  if (candidate.styleMode !== 'manual' && candidate.styleMode !== 'auto') return false;
  if (typeof candidate.workingTitle !== 'string') return false;

  if (candidate.mode === 'resubmit') {
    if (!candidate.style || !candidate.medium || !candidate.targetPainting) return false;
  }

  if (candidate.step !== 'setup') {
    if (!candidate.style || !candidate.medium) return false;
  }

  if (candidate.step === 'analyzing' || candidate.step === 'results') {
    if (typeof candidate.imageDataUrl !== 'string' || candidate.imageDataUrl.length === 0) return false;
  }

  if (candidate.step === 'results') {
    if (!candidate.critique) return false;
    if (candidate.critiqueSource !== 'api') return false;
  }

  return true;
}
