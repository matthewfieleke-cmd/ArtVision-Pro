import type { CriterionLabel } from '../../shared/criteria';
import type { GlossarySection } from '../glossaryData';
import { GLOSSARY_SECTION_ORDER } from '../glossaryData';

export const GLOSSARY_FILTER_OPTIONS: readonly ('All' | GlossarySection)[] = [
  'All',
  ...GLOSSARY_SECTION_ORDER,
] as const;

export function isCriterionGlossarySection(value: GlossarySection): value is CriterionLabel {
  return value !== 'General';
}
