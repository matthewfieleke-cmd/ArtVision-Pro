import type { CriterionLabel } from '../shared/criteria.js';
import {
  groundingContentTokens,
  hasVisibleEventLanguage,
  sharesConcreteLanguage,
} from './critiqueGrounding.js';
import { normalizeWhitespace } from './critiqueTextRules.js';

export type WeakWorkEvidenceFamily =
  | 'topLevelTone'
  | 'genericEvidence'
  | 'compositionEvidence'
  | 'conceptualEvidence'
  | 'conceptualAnchor';

const TOP_LEVEL_FLATTERING_PATTERN =
  /\b(whimsical charm|whimsical tranquility|idyllic rural life|idyllic world|lively atmosphere|peaceful.*scene|momentary impression|masterful|museum[- ]grade|monet|morisot|pissarro|degas|courbet|kandinsky|malevich|mondrian)\b/i;

const TOP_LEVEL_GENERIC_SUMMARY_PATTERN =
  /\b(overall scene|overall composition|overall image|holds together|feels unified|feels calm|feels harmonious|pleasant|atmosphere|mood|approach|style|readable way|impressionistic landscape approach|expressionistic approach|abstract approach)\b/i;

const TOP_LEVEL_VISUAL_PROPERTY_PATTERN =
  /\b(edge|edges|brushwork|brushstrokes?|stroke|strokes|mark|marks|wash|washes|palette|value|values|light|lights|shadow|shadows|surface|surfaces|shape|shapes|silhouette|silhouettes|contour|contours|reflection|reflections|band|bands|line|lines|plane|planes|interval|intervals|temperature|chroma|hatching|scumble|glaze|drag|reserve)\b/i;

const TOP_LEVEL_RELATION_OR_EVENT_PATTERN =
  /\b(against|between|across|under|over|above|below|behind|beside|around|through|toward|where(?:\s+\w+){0,3}\s+meets?|meets?|cross(?:es|ing)?|lead(?:s|ing)?|narrow(?:s|ing)?|widen(?:s|ing)?|bend(?:s|ing)?|cut(?:s|ting)?|overlap(?:s|ping)?|separate(?:s|ing)?)\b/i;

const GENERIC_EVIDENCE_ACTION_PATTERN =
  /\b(creates?|shows?|features?|suggests?|conveys?|adds?|enhances?|emphasizes?|implies?|provides?)\b/i;

const GENERIC_EVIDENCE_CONCRETE_PATTERN =
  /\b(edge|stroke|mark|ridge|gap|band|corner|peak|silhouette|reflection|shadow|highlight|contour|plane|shape|interval|junction|boundary|surface|wash|drag|scumble|hatch|hatching)\b/i;

const GENERIC_EVIDENCE_RELATION_PATTERN =
  /\b(against|between|where(?:\s+\w+){0,3}\s+meets?|meets?|overlap|alongside|next to|adjacent|cuts across|turns into|beside|behind|below|above|under|across|along|in front of|through|toward|around)\b/i;

const GENERIC_EVIDENCE_ABSTRACT_OUTCOME_PATTERN =
  /\b(focal point|atmosphere|story|narrative|balance|mood|depth|dimension|movement|energy)\b/i;

const GENERIC_EVIDENCE_STRUCTURAL_VERB_PATTERN =
  /\b(break|shift|overlap|drag|turn|cut|touch|repeat|separate|merge|align|stack|widen|narrow|tilt|lean|step|bridge)\b/i;

const GENERIC_EVIDENCE_INTERPRETIVE_EFFECT_PATTERN =
  /\b(directional flow|guides? the eye|guides? attention|draws? the eye|draws? attention|emphasiz(?:es?|ing) (?:its|their|the) importance|importance\b|prominence\b|creates? presence|gives? presence|creates? atmosphere|gives? atmosphere|emotional center|social focus|sense of arrival)\b/i;

const COMPOSITION_GENERIC_PATTERN =
  /\b(dynamic tension|balanced composition|stable composition|guides? the viewer'?s eye|leads? the eye|framing|sense of depth|adds interest|focal point|balance|balances?|balanced|symmetry|symmetrical|rhythm|counterbalance|counterbalances?|strong structure|organized composition)\b/i;

const COMPOSITION_EVENT_PATTERN =
  /\b(narrows?|widens?|cuts?|cross(?:es|ing)?|leaves?|opens?|closes?|steps?|breaks?|repeats?|aligns?|tilts?|stacks?|drops?|rises?|sits?|lands?|pinches?|separates?|overlaps?|intersects?|echo(?:es)?|leans?|bridges?|frames?)\b/i;

const COMPOSITION_RELATION_PATTERN =
  /\b(against|between|where(?:\s+\w+){0,3}\s+meets?|meets?|under|across|above|below|behind|beside|around|through|toward|than)\b/i;

const CONCEPTUAL_GENERIC_PATTERN =
  /\b(journey|inviting|welcome|welcoming|idyllic|whimsical|tranquility|harmony|warmth|atmosphere|life and activity|life\b|activity|story|narrative|festive|celebration|holiday|cheerful|sense of time|exploration|viewer engagement|playful intent|movement|motion|speed|urgency|momentum|drama|dramatic energy|expression|personality|emotion|attitude|power|presence|energy|dominant presence)\b/i;

const CONCEPTUAL_VISUAL_RELATION_PATTERN =
  /\b(against|where(?:\s+\w+){0,3}\s+meets?|meets?|under|between|across|along|around|above|below|behind|beside|beneath|through|toward|towards|into|inside|within|over|leading to|leading toward|leading towards|leads to|leads toward|framing|framed by|cross(?:es|ing)?|cut(?:s|ting)?(?:\s+across)?|narrow(?:s|ing)?(?:\s+toward)?|bend|bends|turn(?:s|ing)?(?:\s+into)?|overlap(?:s|ping)?)\b/i;

const CONCEPTUAL_STRONG_VISUAL_RELATION_PATTERN =
  /\b(against|where(?:\s+\w+){0,3}\s+meets?|meets?|under|between|across|along|around|above|below|behind|beside|beneath|through|toward|towards|into|inside|within|over|leading to|leading toward|leading towards|leads to|leads toward|framing|framed by|cross(?:es|ing)?|cut(?:s|ting)?(?:\s+across)?|narrow(?:s|ing)?(?:\s+toward)?|bend|bends|turn(?:s|ing)?(?:\s+into)?|overlap(?:s|ping)?)\b/i;

const CONCEPTUAL_CARRIER_ALLOW_PATTERN =
  /\b(physical carrier|visible carrier|passage that (?:carries|keeps|makes))\b/i;
const CONCEPTUAL_READ_LINK_PATTERN =
  /\b(makes?\s+\w+\s+read|keeps?\s+\w+\s+(?:legible|visible|present)|holds?\s+\w+|anchors?\s+\w+|pins?\s+\w+|ties?\s+\w+|carries?\s+\w+|drives?\s+\w+|pushes?\s+\w+|pulls?\s+\w+|communicat(?:es?|ing)\b|renders?\b|lets?\s+\w+\s+read|because)\b/i;

function hasGroundedPassageLanguage(text: string, minimumTokens: number = 3): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return false;
  const tokenCount = groundingContentTokens(normalized).length;
  const hasCarrierCue =
    GENERIC_EVIDENCE_RELATION_PATTERN.test(normalized) ||
    GENERIC_EVIDENCE_CONCRETE_PATTERN.test(normalized) ||
    /\b(left|right|upper|lower|top|bottom|center|foreground|background)\b/i.test(normalized);
  return tokenCount >= minimumTokens && hasCarrierCue;
}

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
  const lacksJunctionLanguage = !hasGroundedPassageLanguage(normalized);
  const lacksVisibleEvent = !hasVisibleEventLanguage(normalized);
  const genericSummary =
    GENERIC_EVIDENCE_ACTION_PATTERN.test(normalized) &&
    !hasGroundedPassageLanguage(normalized);
  const abstractOutcome =
    GENERIC_EVIDENCE_ABSTRACT_OUTCOME_PATTERN.test(normalized) &&
    !GENERIC_EVIDENCE_STRUCTURAL_VERB_PATTERN.test(normalized) &&
    lacksVisibleEvent;
  const interpretiveEffect =
    GENERIC_EVIDENCE_INTERPRETIVE_EFFECT_PATTERN.test(normalized) &&
    lacksVisibleEvent;
  return (genericSummary && (lacksJunctionLanguage || abstractOutcome || lacksVisibleEvent)) || interpretiveEffect;
}

export function hasWeakCompositionGenericText(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return true;
  const lacksConcreteStructure = !hasGroundedPassageLanguage(normalized);
  const lacksStructuralEvent = !COMPOSITION_EVENT_PATTERN.test(normalized);
  const stockVerdict = COMPOSITION_GENERIC_PATTERN.test(normalized) && lacksStructuralEvent;
  return lacksConcreteStructure || lacksStructuralEvent || stockVerdict || !COMPOSITION_RELATION_PATTERN.test(normalized);
}

export function hasFlatteringWeakWorkTopLevelText(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return true;
  return TOP_LEVEL_FLATTERING_PATTERN.test(normalized);
}

export function hasNeutralWeakWorkTopLevelText(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return false;
  if (TOP_LEVEL_FLATTERING_PATTERN.test(normalized)) return false;
  const tokenCount = groundingContentTokens(normalized).length;
  const hasVisualSpecificity =
    TOP_LEVEL_VISUAL_PROPERTY_PATTERN.test(normalized) ||
    TOP_LEVEL_RELATION_OR_EVENT_PATTERN.test(normalized) ||
    /\baround\b.+,/.test(normalized);
  const genericSummaryOnly =
    TOP_LEVEL_GENERIC_SUMMARY_PATTERN.test(normalized) && !hasVisualSpecificity;
  return tokenCount >= 4 && hasVisualSpecificity && !genericSummaryOnly;
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
  return groundingContentTokens(normalized).length >= 2 && /\b(against|where(?:\s+\w+){0,3}\s+meets?|meets?|under|between|across|along|around|above|below|behind|beside|beneath|through|toward|towards|into|inside|within|over|on|in|with|leading to|leading toward|leading towards|leads to|leads toward|framing|framed by|cross(?:es|ing)?|cut(?:s|ting)?(?:\s+across)?|narrow(?:s|ing)?(?:\s+toward)?|bend|bends|turn(?:s|ing)?(?:\s+into)?|overlap(?:s|ping)?)\b/i.test(normalized);
}

export function hasWeakConceptualGenericText(text: string, anchorText?: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return true;
  const normalizedAnchor = anchorText ? normalizeWeakWorkText(anchorText) : '';
  const hasVisualCarrierCue =
    groundingContentTokens(normalized).length >= 2 &&
    (CONCEPTUAL_VISUAL_RELATION_PATTERN.test(normalized) ||
      Boolean(normalizedAnchor) &&
        (normalized.includes(normalizedAnchor) || sharesConcreteLanguage(normalized, normalizedAnchor, 2)));
  const usesCarrierInterpretationGrammar = CONCEPTUAL_CARRIER_ALLOW_PATTERN.test(normalized);
  const usesConceptualReadLink = CONCEPTUAL_READ_LINK_PATTERN.test(normalized);
  return (
    CONCEPTUAL_GENERIC_PATTERN.test(normalized) &&
    (!hasVisualCarrierCue || (!usesCarrierInterpretationGrammar && !usesConceptualReadLink))
  );
}

export function hasWeakConceptualEvidenceLine(text: string): boolean {
  const normalized = normalizeWeakWorkText(text);
  if (!normalized) return true;
  const hasVisualCarrierCue =
    groundingContentTokens(normalized).length >= 2 &&
    CONCEPTUAL_STRONG_VISUAL_RELATION_PATTERN.test(normalized);
  const hasVisibleEventCue =
    hasVisibleEventLanguage(normalized) ||
    GENERIC_EVIDENCE_CONCRETE_PATTERN.test(normalized);
  const interpretationWithoutEvent =
    (CONCEPTUAL_GENERIC_PATTERN.test(normalized) ||
      GENERIC_EVIDENCE_ABSTRACT_OUTCOME_PATTERN.test(normalized) ||
      GENERIC_EVIDENCE_INTERPRETIVE_EFFECT_PATTERN.test(normalized)) &&
    (!hasVisualCarrierCue || !hasVisibleEventCue);
  return interpretationWithoutEvent || hasWeakWorkGenericEvidenceLine(normalized);
}

export function weakWorkCompositionGuidance(): string[] {
  return [
    'For Composition and shape structure on weak work, EACH visibleEvidence line must name one locatable passage and one shape event, such as what narrows, widens, cuts, leaves a gap, stacks, overlaps, aligns, tilts, or separates.',
    'For Composition and shape structure, at least one visibleEvidence line must repeat the anchor nouns and describe what changes on each side of that passage.',
    'Composition evidence can come from any real structural carrier: a path against a band, an edge against a field, a vertical against a horizontal, a reflection across water, or a loaded shape under a lighter one.',
    'Lines like "creates balance", "guides the eye", "adds rhythm", or "makes the composition stable" are still too generic unless they also name the exact passage and the visible difference being produced there.',
    'For Composition and shape structure, avoid sentence stems like "creates a strong line", "adds structure", "creates rhythm", or "balances the scene". Replace them with event sentences such as "cuts the pale field", "separates one band from another", "leaves a wider gap on one side", or "tilts harder than the neighboring form".',
  ];
}

export function weakWorkEvidenceGuidance(): string[] {
  return [
    'If the work looks weak, naive, or student-level, become MORE specific, not more charitable.',
    'Top-level evidence fields must stay plain and evidence-led for weak work.',
    'Choose anchors from pointable passages and junctions, not scene summaries or subject tags.',
    'For Intent and Presence, use a visible carrier relationship instead of mood/story labels.',
    'For conceptual visibleEvidence lines, naming the carrier is not enough; the sentence must also describe a visible event there, such as what narrows, bends, cuts, overlaps, sits below, or stays lighter/darker.',
    'For Composition, avoid stock composition praise unless the sentence names the exact structural passage producing the effect.',
    ...weakWorkCompositionGuidance(),
  ];
}

export function weakWorkCompositionRepairExamples(): string[] {
  return [
    'For composition evidence, write "the path before the doorway narrows and leaves a wider light band on the left than on the right."',
    'For composition evidence, write "the vertical edge against the pale field lands just behind the darker shape and leaves a thinner gap above it."',
    'For composition evidence, write "the reflection cuts through the flatter water bands and leaves a wider dark shape on one side."',
    'For composition evidence, write "the tilted form across the ground bands leans harder than the neighboring vertical and repeats that push above the horizon."',
    'Do not write composition fillers like "creates balance", "creates rhythm", or "guides the eye" by themselves. Rewrite them as concrete events in a specific passage.',
    'Rewrite "the roof edge creates a strong horizontal line" as "the roof edge cuts the pale wash and leaves a thinner strip above the form than beside it."',
    'Rewrite "the fence line creates a horizontal division" as "the fence line separates one band from the next and leaves a smaller strip above the nearer shape than above the farther one."',
  ];
}

export function weakWorkRepairExamples(): string[] {
  return [
    'Use anchors like "the path where it meets the doorway", "the vertical edge against the pale field", "the reflection across the water band", or "the loaded rim stroke against the table".',
    'Rewrite "the path leading inward creates a directional flow" as "the path leading inward narrows before the opening and stays lighter than the band beside it."',
    'Rewrite "the warm accent creates a welcoming mood" as "the warm accent under the bright opening stays warmer than the surrounding band and sits below the lightest stack."',
    'Write top-level evidence in plain visual language, e.g. "The painting appears to organize the scene around a narrow path, a bright opening, and a darker band crossing the lower half."',
    'Do not use artist-name comparisons for weak work unless the criterion evidence already proves exceptional control.',
    ...weakWorkCompositionRepairExamples(),
  ];
}
