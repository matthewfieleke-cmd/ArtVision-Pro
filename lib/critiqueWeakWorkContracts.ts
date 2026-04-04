import type { CriterionLabel } from '../shared/criteria.js';
import { normalizeWhitespace } from './critiqueTextRules.js';

export type WeakWorkEvidenceFamily =
  | 'topLevelTone'
  | 'genericEvidence'
  | 'compositionEvidence'
  | 'conceptualEvidence'
  | 'conceptualAnchor';

const TOP_LEVEL_FLATTERING_PATTERN =
  /\b(whimsical charm|whimsical tranquility|idyllic rural life|idyllic world|lively atmosphere|peaceful.*scene|momentary impression|monet'?s garden scenes?|monet|morisot|pissarro)\b/i;

// Visible-language allowance needs to cover more than novice garden scenes so
// masterworks with concrete nouns like "sun", "boats", or "harbor" are not
// rejected as abstract praise.
const TOP_LEVEL_NEUTRAL_PATTERN =
  /\b(path|house|roof|flower|flowers|sky|wash|edge|edges|shadow|fence|tree|trees|garden|foreground|background|color|palette|value|watercolor|sun|boat|boats|harbor|shore|water|reflection|reflections|building|buildings|figure|figures|face|head|chair|wall|window|square|band|bands|line|lines|silhouette|cloud|clouds|smoke|sleeve|collar|canvas|ground|brushwork|brushstrokes?|strokes?|blending|ripples?)\b/i;

const GENERIC_EVIDENCE_ACTION_PATTERN =
  /\b(creates?|shows?|features?|suggests?|conveys?|adds?|enhances?|emphasizes?|implies?|provides?)\b/i;

const GENERIC_EVIDENCE_CONCRETE_PATTERN =
  /\b(edge|stroke|mark|ridge|gap|band|corner|peak|silhouette|reflection|shadow|highlight|contour)\b/i;

const GENERIC_EVIDENCE_RELATION_PATTERN =
  /\b(against|between|where|meets?|overlap|alongside|next to|adjacent|cuts across|turns into)\b/i;

const GENERIC_EVIDENCE_ABSTRACT_OUTCOME_PATTERN =
  /\b(focal point|atmosphere|story|narrative|balance|mood|depth|dimension|movement|energy)\b/i;

const GENERIC_EVIDENCE_STRUCTURAL_VERB_PATTERN =
  /\b(break|shift|overlap|drag|turn|cut|touch|repeat|separate|merge)\b/i;

const COMPOSITION_GENERIC_PATTERN =
  /\b(dynamic tension|balanced composition|stable composition|guides? the viewer'?s eye|leads? the eye|framing|frame the path|sense of depth|adds interest|focal point|balance|balances?|balanced|symmetry|symmetrical|rhythm|counterbalance|counterbalances?)\b/i;

const COMPOSITION_CONCRETE_PATTERN =
  /\b(path bend|path|roof edge|fence post|fence line|flower patch|house shadow|chair back|chair bars?|window strip|figure|figures|sitter|shoulder|head|silhouette|slat|bar|strip|line|lines|division|divisions|gap|gaps|band|bands|corner|corners|overlap|junction|edge|edges|shape|shapes|scaffold|under|against|between|cuts across|boat|boats|reflection|horizon|mast|masts|ripples?|water|sky|harbor|shore|foreground|background|vertical|horizontal|table|tables|umbrella|umbrellas|arch|arches|building|facade)\b/i;

const COMPOSITION_EVENT_PATTERN =
  /\b(narrows?|widens?|cuts?|cross(?:es|ing)?|leaves?|opens?|closes?|steps?|breaks?|repeats?|aligns?|tilts?|stacks?|drops?|rises?|sits?|lands?|pinches?|separates?|overlaps?|intersects?|echo(?:es)?|positioned|placed)\b/i;

const CONCEPTUAL_GENERIC_PATTERN =
  /\b(journey|inviting|idyllic|whimsical|tranquility|harmony|warmth|atmosphere|life and activity|life\b|activity|story|narrative|cheerful|lively world|sense of time|exploration|viewer engagement|playful intent|whimsical touch)\b/i;

const CONCEPTUAL_CARRIER_OBJECT_PATTERN =
  /\b(against|where|under|between|cross(?:es|ing)?|cut(?:s|ting)?|narrow(?:s|ing)?|bend|bends|edge|shadow|smoke|chimney|roof|path|post|fence|patch|band|silhouette|wall|head|face|shirt|chair|bridge|train|pole|poles|track|tracks|shoreline|shore|rocks|table|tables|umbrella|umbrellas|arch|arches|facade|building)\b/i;

const CONCEPTUAL_CARRIER_RELATION_PATTERN =
  /\b(meets?|against|under|between|cross(?:es|ing)?|cut(?:s|ting)?|narrow(?:s|ing)?|bend|bends|edge|shadow)\b/i;

const CONCEPTUAL_ANCHOR_PATTERN =
  /\b(against|where|under|between|cross(?:es|ing)?|cut(?:s|ting)?\s+across|narrow(?:s|ing)?\s+toward|meets?|turn(?:s|ing)?\s+into|overlap|beside|below|above|into|through|beneath)\b/i;

const CONCEPTUAL_CONCRETE_OBJECT_PATTERN =
  /\b(sun|reflection|water|boat|boats|harbor|shore|shoreline|sky|cloud|clouds|figure|figures|face|head|wall|window|chair|shirt|collar|smoke|chimney|roof|path|shadow|sleeve|hand|ground|opening|silhouette|bridge|train|pole|poles|track|tracks|rocks|rocky shoreline|table|tables|umbrella|umbrellas|arch|arches|building|facade)\b/i;

const CONCEPTUAL_SOFT_ROUTE_PATTERN =
  /\b(path leading to|journey|story|narrative|overall mood|emotional tone|garden setting|atmosphere)\b/i;

export function isConceptualCriterion(criterion: CriterionLabel): boolean {
  return (
    criterion === 'Intent and necessity' ||
    criterion === 'Presence, point of view, and human force'
  );
}

export function normalizeWeakWorkText(text: string): string {
  return normalizeWhitespace(text).toLowerCase();
}

export function hasWeakWorkGenericEvidenceLine(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return true;
  const lacksJunctionLanguage = !GENERIC_EVIDENCE_RELATION_PATTERN.test(normalized);
  const genericSummary =
    GENERIC_EVIDENCE_ACTION_PATTERN.test(normalized) &&
    !GENERIC_EVIDENCE_CONCRETE_PATTERN.test(normalized);
  const abstractOutcome =
    GENERIC_EVIDENCE_ABSTRACT_OUTCOME_PATTERN.test(normalized) &&
    !GENERIC_EVIDENCE_STRUCTURAL_VERB_PATTERN.test(normalized);
  return genericSummary && (lacksJunctionLanguage || abstractOutcome);
}

export function hasWeakCompositionGenericText(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return true;
  const lacksConcreteStructure = !COMPOSITION_CONCRETE_PATTERN.test(normalized);
  const lacksStructuralEvent = !COMPOSITION_EVENT_PATTERN.test(normalized);
  return lacksConcreteStructure || lacksStructuralEvent;
}

export function hasFlatteringWeakWorkTopLevelText(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return true;
  return TOP_LEVEL_FLATTERING_PATTERN.test(normalized);
}

export function hasNeutralWeakWorkTopLevelText(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return false;
  return TOP_LEVEL_NEUTRAL_PATTERN.test(normalized);
}

export function neutralizeWeakWorkComparisonObservation(text: string): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return 'The image uses broken color and soft edges, but the structural control remains uneven.';
  }
  if (!hasFlatteringWeakWorkTopLevelText(normalized) && hasNeutralWeakWorkTopLevelText(normalized)) {
    return normalized;
  }
  return 'The image uses broken color and soft edges, but the structural control remains uneven.';
}

export function hasSpecificConceptualCarrierAnchor(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return false;
  if (CONCEPTUAL_SOFT_ROUTE_PATTERN.test(normalized)) return false;
  return CONCEPTUAL_ANCHOR_PATTERN.test(normalized) || CONCEPTUAL_CONCRETE_OBJECT_PATTERN.test(normalized);
}

export function hasWeakConceptualGenericText(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return true;
  const concreteCarrierCue =
    CONCEPTUAL_CARRIER_OBJECT_PATTERN.test(normalized) &&
    CONCEPTUAL_CARRIER_RELATION_PATTERN.test(normalized);
  return CONCEPTUAL_GENERIC_PATTERN.test(normalized) && !concreteCarrierCue;
}

export function weakWorkCompositionGuidance(): string[] {
  return [
    'For Composition and shape structure on weak work, EACH visibleEvidence line must name a structural passage and a shape event, such as what narrows, widens, cuts, leaves a gap, stacks, overlaps, aligns, or tilts.',
    'For Composition and shape structure, at least one visibleEvidence line must repeat the anchor nouns and describe what changes on each side of that passage.',
    'Composition evidence can come from any real shape passage: a path against a flower band, a chair back against a sitter, a window strip beside a head, or a roof edge against a wash.',
    'Lines like "the trees balance the house", "the fence creates rhythm", or "the roof makes the composition stable" are still too generic unless they also name the exact shape passage and the visible difference being produced there.',
    'For Composition and shape structure, avoid sentence stems like "creates a strong line", "adds structure", "creates rhythm", or "balances the scene". Replace them with event sentences such as "cuts the sky wash", "separates the garden from the sky", "leaves a wider band on one side", or "rises higher than the roof".',
  ];
}

export function weakWorkEvidenceGuidance(): string[] {
  return [
    'If the work looks weak, naive, or student-level, become MORE specific, not more charitable.',
    'Top-level evidence fields must stay plain and evidence-led for weak work.',
    'For weak landscapes, prefer object-pair or junction anchors over scene summaries.',
    'For Intent and Presence, use a visible carrier relationship instead of mood/story labels.',
    'For Composition on weak landscapes, avoid stock composition praise unless the sentence names the exact structural passage producing the effect.',
    ...weakWorkCompositionGuidance(),
  ];
}

export function weakWorkCompositionRepairExamples(): string[] {
  return [
    'For composition evidence, write "the path bend under the red house narrows before the doorway and leaves a wider flower band on the left than on the right."',
    'For cafe or street scenes, write "the path narrowing into the cafe tables leaves a wider pale ground shape on the left than on the right before it reaches the seated group."',
    'For cafe or street scenes, write "the nearest building arch lands just behind the cafe tables and repeats their curve higher up the wall."',
    'For figure or interior work, write "the chair back cuts a tall vertical band between the window strip and the sitter, and the middle slat leaves a smaller gap above the shoulder than the outer edge does."',
    'Do not write composition fillers like "the trees balance the house" or "the fence line creates rhythm" by themselves. Rewrite them as concrete events in a specific passage.',
    'Rewrite "the roof edge creates a strong horizontal line" as "the roof edge cuts the sky wash and leaves a thinner blue strip above the house than above the trees."',
    'Rewrite "the fence line creates a horizontal division" as "the fence line separates the garden from the sky and leaves a smaller blue band above the roof than above the tree mass."',
  ];
}

export function weakWorkRepairExamples(): string[] {
  return [
    'Use anchors like "the path bend where it meets the house shadow", "the chimney smoke against the blue wash", or "the flower patch where it meets the path edge".',
    'For cafe or street scenes, use anchors like "the cafe tables with yellow umbrellas", "the seated figures under the yellow umbrellas", or "the nearest building arch behind the cafe tables".',
    'Write top-level evidence in plain visual language, e.g. "The painting appears to organize the scene around a path, a small house, and bright flower bands."',
    'Do not use artist-name comparisons for weak work unless the criterion evidence already proves exceptional control.',
    ...weakWorkCompositionRepairExamples(),
  ];
}
