import { describe, expect, it } from 'vitest';

import {
  CRITERIA_ORDER,
  canonicalCriterionLabel,
  criterionLabelMatches,
  previewEditChipText,
} from './criteria';

describe('CRITERIA_ORDER', () => {
  it('has eight canonical criteria', () => {
    expect(CRITERIA_ORDER).toHaveLength(8);
  });
});

describe('canonicalCriterionLabel', () => {
  it('accepts canonical labels', () => {
    expect(canonicalCriterionLabel('Color relationships')).toBe('Color relationships');
  });

  it('maps legacy labels', () => {
    expect(canonicalCriterionLabel('Composition')).toBe('Composition and shape structure');
  });

  it('returns null for unknown labels', () => {
    expect(canonicalCriterionLabel('Not a criterion')).toBeNull();
  });
});

describe('criterionLabelMatches', () => {
  it('matches when candidate is canonical', () => {
    expect(criterionLabelMatches('Color relationships', 'Color relationships')).toBe(true);
  });

  it('matches legacy alias to canonical criterion', () => {
    expect(criterionLabelMatches('Composition', 'Composition and shape structure')).toBe(true);
  });
});

describe('previewEditChipText', () => {
  it('returns combined label', () => {
    expect(previewEditChipText('combined', 'Color relationships')).toBe('All changes');
  });

  it('returns chip keyword for known criterion', () => {
    expect(previewEditChipText('single', 'Color relationships')).toBe('Color');
  });
});
