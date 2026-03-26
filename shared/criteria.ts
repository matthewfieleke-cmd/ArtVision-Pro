/** Single source of truth for critique category labels (app + API + OpenAI schema). */
export const CRITERIA_ORDER = [
  'Intent and necessity',
  'Composition and shape structure',
  'Value and light structure',
  'Color relationships',
  'Drawing, proportion, and spatial form',
  'Edge and focus control',
  'Surface and medium handling',
  'Presence, point of view, and human force',
] as const;

export type CriterionLabel = (typeof CRITERIA_ORDER)[number];

/**
 * Legacy labels kept for saved critiques, learn-page aliases, and older API/client payloads.
 * New critiques should always use the canonical labels in CRITERIA_ORDER.
 */
export const LEGACY_CRITERION_LABELS = [
  'Composition',
  'Value structure',
  'Drawing and proportion',
  'Edge control',
  'Brushwork / handling',
  'Unity and variety',
  'Originality / expressive force',
] as const;

export type LegacyCriterionLabel = (typeof LEGACY_CRITERION_LABELS)[number];

const LEGACY_TO_CANONICAL: Record<LegacyCriterionLabel, CriterionLabel> = {
  Composition: 'Composition and shape structure',
  'Value structure': 'Value and light structure',
  'Drawing and proportion': 'Drawing, proportion, and spatial form',
  'Edge control': 'Edge and focus control',
  'Brushwork / handling': 'Surface and medium handling',
  'Unity and variety': 'Intent and necessity',
  'Originality / expressive force': 'Presence, point of view, and human force',
};

const CANONICAL_TO_LEGACY: Partial<Record<CriterionLabel, LegacyCriterionLabel>> = {
  'Composition and shape structure': 'Composition',
  'Value and light structure': 'Value structure',
  'Drawing, proportion, and spatial form': 'Drawing and proportion',
  'Edge and focus control': 'Edge control',
  'Surface and medium handling': 'Brushwork / handling',
  'Intent and necessity': 'Unity and variety',
  'Presence, point of view, and human force': 'Originality / expressive force',
};

export function canonicalCriterionLabel(label: string): CriterionLabel | null {
  if ((CRITERIA_ORDER as readonly string[]).includes(label)) return label as CriterionLabel;
  if ((LEGACY_CRITERION_LABELS as readonly string[]).includes(label)) {
    return LEGACY_TO_CANONICAL[label as LegacyCriterionLabel];
  }
  return null;
}

export function legacyCriterionLabel(label: CriterionLabel): LegacyCriterionLabel | null {
  return CANONICAL_TO_LEGACY[label] ?? null;
}

export function criterionLabelMatches(candidate: string, criterion: CriterionLabel): boolean {
  return candidate === criterion || legacyCriterionLabel(criterion) === candidate;
}

export const RATING_LEVELS = [
  'Beginner',
  'Intermediate',
  'Advanced',
  'Master',
] as const;

export type RatingLevelLabel = (typeof RATING_LEVELS)[number];
