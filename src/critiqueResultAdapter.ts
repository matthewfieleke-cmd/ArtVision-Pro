import type { CritiqueResult } from './types';
import { finalizeCritiqueResult, migrateCritiqueSimpleFeedback } from './critiqueCoach';

type CritiqueResultWithLegacyFields = CritiqueResult & {
  simpleFeedback?: CritiqueResult['simple'];
};

export function adaptCritiqueResult(
  critique: CritiqueResultWithLegacyFields,
  options?: {
    photoQuality?: CritiqueResult['photoQuality'];
  }
): CritiqueResult {
  const normalized: CritiqueResult = {
    ...critique,
    ...(critique.simpleFeedback
      ? {
          simple: migrateCritiqueSimpleFeedback(critique.simpleFeedback) ?? critique.simpleFeedback,
        }
      : {}),
  };

  return finalizeCritiqueResult(normalized, {
    photoQuality: options?.photoQuality ?? normalized.photoQuality,
  });
}
