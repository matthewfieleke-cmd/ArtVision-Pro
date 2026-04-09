import {
  canonicalCriterionLabel,
  CRITERIA_ORDER,
  RATING_LEVELS,
  type CriterionLabel,
} from '../shared/criteria.js';
import type { CriterionAnchor, CriterionEditPlan } from '../shared/critiqueAnchors.js';
import type {
  CritiqueResultDTO,
  CritiqueSimpleFeedbackDTO,
  StudioChangeDTO,
  SuggestedTitleDTO,
} from './critiqueTypes.js';
import {
  CritiqueGroundingError,
  CritiqueValidationError,
} from './critiqueErrors.js';
import {
  CRITIQUE_CHANGE_VERB_PATTERN,
  CRITIQUE_DONT_CHANGE_PATTERN,
  CRITIQUE_PRESERVE_VERB_PATTERN,
  isGenericTeacherText,
  normalizeWhitespace,
} from './critiqueTextRules.js';
import {
  anchorSupportedByEvidenceLine,
  countEvidenceLineGroundingHits,
  findPrimaryAnchorSupportLine,
  hasVisibleEventLanguage,
  isConcreteAnchor,
  proseEchoesAnchor,
  sameAdvice,
  sharesConcreteLanguage,
  tracesToPrimarySupportLine,
  tracesShortEvidenceSignal,
  tracesToVisibleEvidence,
} from './critiqueGrounding.js';
import {
  hasFlatteringWeakWorkTopLevelText,
  hasNeutralWeakWorkTopLevelText,
  hasSpecificConceptualCarrierAnchor,
  hasWeakCompositionGenericText,
  hasWeakConceptualEvidenceLine,
  hasWeakConceptualGenericText,
  hasWeakWorkGenericEvidenceLine,
  isConceptualCriterion,
  neutralizeWeakWorkComparisonObservation,
} from './critiqueWeakWorkContracts.js';
import { hydrateVoiceBCanonicalCategory } from './critiqueVoiceBCanonical.js';
import type {
  VoiceAStageResult,
  VoiceBStageResult,
  ObservationBank,
} from './critiqueZodSchemas.js';

export type CritiqueEvidenceDTO = {
  intentHypothesis: string;
  strongestVisibleQualities: string[];
  mainTensions: string[];
  completionRead: {
    state: 'unfinished' | 'likely_finished' | 'uncertain';
    confidence: 'low' | 'medium' | 'high';
    cues: string[];
    rationale: string;
  };
  photoQualityRead: {
    level: 'poor' | 'fair' | 'good';
    summary: string;
    issues: string[];
  };
  comparisonObservations: string[];
  criterionEvidence: Array<{
    criterion: (typeof CRITERIA_ORDER)[number];
    observationPassageId: string;
    anchor: string;
    visibleEvidence: string[];
    strengthRead: string;
    tensionRead: string;
    preserve: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
  salvagedCriteria?: Array<{
    stage: 'evidence' | 'voice_a' | 'voice_b' | 'validation';
    criterion: (typeof CRITERIA_ORDER)[number];
    reason: string;
  }>;
};

type EvidenceValidationMode = 'strict' | 'lenient';

type EvidenceValidationOptions = {
  mode?: EvidenceValidationMode;
  observationBank?: ObservationBank;
};

function uniqueNonEmptyLines(lines: Array<string | undefined>, min: number, max: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const normalized = typeof line === 'string' ? line.trim() : '';
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= max) break;
  }
  if (result.length >= min) return result;
  return result;
}

function joinVisibleSubjects(items: string[]): string {
  if (items.length === 0) return 'the main visible passages in the painting';
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function fallbackIntentHypothesis(
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence']
): string {
  const anchors = uniqueNonEmptyLines(
    criterionEvidence.map((entry) => entry.anchor),
    1,
    3
  );
  return `The painting appears to organize the scene around ${joinVisibleSubjects(anchors)}.`;
}

function fallbackStrongestVisibleQualities(
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence']
): string[] {
  return uniqueNonEmptyLines(
    criterionEvidence.flatMap((entry) => [entry.visibleEvidence[0], entry.strengthRead]),
    2,
    4
  );
}

function sentenceCase(text: string): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return normalized;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function sentence(text: string): string {
  const normalized = normalizeWhitespace(text).replace(/[.]+$/, '');
  if (!normalized) return normalized;
  return `${sentenceCase(normalized)}.`;
}

function recoverLenientEvidenceAnchor(
  criterion: CriterionLabel,
  rawAnchor: string,
  visibleEvidence: string[],
  strengthRead: string,
  tensionRead: string,
  preserve: string
): string {
  const candidates = uniqueNonEmptyLines(
    [rawAnchor, ...visibleEvidence, strengthRead, tensionRead, preserve].map((line) => line.trim()),
    1,
    12
  );

  if (isConceptualCriterion(criterion)) {
    const conceptualCarrier = candidates.find((candidate) => hasSpecificConceptualCarrierAnchor(candidate));
    if (conceptualCarrier) return conceptualCarrier;
  }

  const concreteAnchor = candidates.find((candidate) => isConcreteAnchor(candidate));
  return concreteAnchor ?? rawAnchor;
}

function resolveObservationPassageForCriterion(
  observationBank: ObservationBank | undefined,
  observationPassageId: string,
  anchor: string,
  mode: EvidenceValidationMode
): { observationPassageId: string; anchor: string } {
  if (!observationBank) {
    return {
      observationPassageId,
      anchor,
    };
  }

  const normalizedAnchor = normalizeWhitespace(anchor);
  const byId = observationBank.passages.find((passage) => passage.id === observationPassageId);
  const byIdPlausiblyMatches =
    !!byId &&
    (normalizeWhitespace(byId.label).toLowerCase() === normalizedAnchor.toLowerCase() ||
      normalizeWhitespace(byId.label).toLowerCase().includes(normalizedAnchor.toLowerCase()) ||
      normalizedAnchor.toLowerCase().includes(normalizeWhitespace(byId.label).toLowerCase()) ||
      sharesConcreteLanguage(byId.label, normalizedAnchor, 2));
  const matchingByAnchor = observationBank.passages.find((passage) => {
    const normalizedLabel = normalizeWhitespace(passage.label);
    return (
      normalizedLabel.length > 0 &&
      normalizedAnchor.length > 0 &&
      (normalizedLabel.toLowerCase() === normalizedAnchor.toLowerCase() ||
        normalizedLabel.toLowerCase().includes(normalizedAnchor.toLowerCase()) ||
        normalizedAnchor.toLowerCase().includes(normalizedLabel.toLowerCase()) ||
        sharesConcreteLanguage(normalizedLabel, normalizedAnchor, 2))
    );
  });

  const resolved = byIdPlausiblyMatches ? byId : matchingByAnchor ?? byId;
  if (!resolved) {
    throw new Error(`Invalid observation passage id for ${anchor || 'criterion evidence'}`);
  }

  if (mode === 'strict' && byId && !byIdPlausiblyMatches && matchingByAnchor && matchingByAnchor.id !== observationPassageId) {
    throw new Error(`Observation passage id does not match anchor for ${anchor || 'criterion evidence'}`);
  }

  return {
    observationPassageId: resolved.id,
    anchor: resolved.label,
  };
}

function extractObservationPredicate(text: string): string {
  const normalized = normalizeWhitespace(text).replace(/[.]+$/, '');
  if (!normalized) return normalized;
  const predicateMatch = normalized.match(
    /\b(is|are|stays?|sits?|cuts?|crosses?|aligns?|tilts?|bends?|stacks?|separates?|meets?|narrows?|widens?|repeats?|passes?|lands?|leans?|opens?|closes?|rises?|drops?|turns?|curves?|breaks?|contrasts?|echoes?|follows?|shows?|uses?|has|have|keeps?)\b/i
  );
  if (!predicateMatch || predicateMatch.index === undefined) return normalized;
  return normalized.slice(predicateMatch.index);
}

function buildObservationAnchorEchoLine(anchor: string, source: string): string {
  const normalizedAnchor = normalizeWhitespace(anchor).replace(/[.]+$/, '');
  const normalizedSource = normalizeWhitespace(source).replace(/[.]+$/, '');
  if (!normalizedAnchor || !normalizedSource) return normalizedSource;
  if (anchorSupportedByEvidenceLine(normalizedAnchor, normalizedSource)) {
    return normalizedSource.endsWith('.') ? normalizedSource : `${normalizedSource}.`;
  }

  const predicate = extractObservationPredicate(normalizedSource);
  if (!predicate) {
    return `${sentenceCase(normalizedAnchor)}.`;
  }
  return `${sentenceCase(normalizedAnchor)} ${predicate.replace(/^[,.\s]+/, '')}.`;
}

function compositionEventRewrite(anchor: string, source: string): string {
  const normalizedAnchor = normalizeWhitespace(anchor).replace(/[.]+$/, '');
  const normalizedSource = normalizeWhitespace(source).replace(/[.]+$/, '');
  if (!normalizedAnchor || !normalizedSource) return sentenceCase(normalizedSource);

  const lowered = normalizedSource.toLowerCase();
  if (/\b(cuts?|crosses?|narrows?|widens?|stacks?|overlaps?|aligns?|tilts?|leaves?|lands?|steps?|separates?|repeats?)\b/.test(lowered)) {
    return buildObservationAnchorEchoLine(normalizedAnchor, normalizedSource);
  }
  if (/\blead(?:s|ing)? the eye\b/.test(lowered)) {
    return `${sentenceCase(normalizedAnchor)} leads toward the neighboring passage and leaves a clearer route across the picture.`;
  }
  if (/\bdistance|depth|perspective\b/.test(lowered)) {
    return `${sentenceCase(normalizedAnchor)} narrows toward the farther passage and leaves a smaller interval at the horizon.`;
  }
  if (/\bmovement|dynamic|energy\b/.test(lowered)) {
    return `${sentenceCase(normalizedAnchor)} tilts harder than the neighboring field and pushes the eye across the next interval.`;
  }
  return `${sentenceCase(normalizedAnchor)} cuts across the neighboring field and leaves a different interval on each side.`;
}

function observationEvidenceCandidates(
  observationBank: ObservationBank | undefined,
  observationPassageId: string,
  anchor: string,
  criterion: CriterionLabel
): string[] {
  if (!observationBank) return [];
  const passage = observationBank.passages.find((entry) => entry.id === observationPassageId);
  if (!passage) return [];

  const rawCandidates = [
    ...observationBank.visibleEvents
      .filter((event) => event.passageId === observationPassageId)
      .map((event) => event.event),
    ...passage.visibleFacts,
  ];

  const scored = rawCandidates
    .map((candidate) => {
      const line =
        criterion === 'Composition and shape structure'
          ? compositionEventRewrite(anchor, candidate)
          : buildObservationAnchorEchoLine(anchor, candidate);
      let score = 0;
      if (anchorSupportedByEvidenceLine(anchor, line)) score += 6;
      if (hasVisibleEventLanguage(line)) score += 4;
      if (sharesConcreteLanguage(line, anchor, 2)) score += 3;
      if (!hasWeakWorkGenericEvidenceLine(line)) score += 2;
      if (criterion === 'Composition and shape structure' && !hasWeakCompositionGenericText(line)) score += 3;
      if (isConceptualCriterion(criterion) && !hasWeakConceptualEvidenceLine(line)) score += 4;
      return { line, score };
    })
    .filter((entry) => entry.line.length > 0)
    .sort((a, b) => b.score - a.score);

  return uniqueNonEmptyLines(
    scored.map((entry) => entry.line),
    0,
    4
  );
}

function repairLenientCriterionEvidence(args: {
  criterion: CriterionLabel;
  observationPassageId: string;
  anchor: string;
  visibleEvidence: string[];
  strengthRead: string;
  preserve: string;
  observationBank?: ObservationBank;
}): {
  visibleEvidence: string[];
  strengthRead: string;
  preserve: string;
  wasSalvaged: boolean;
  reason?: string;
} {
  const linePassesCriterion = (line: string): boolean => {
    if (args.criterion === 'Composition and shape structure') {
      return !hasWeakCompositionGenericText(line);
    }
    if (isConceptualCriterion(args.criterion)) {
      return !hasWeakConceptualEvidenceLine(line);
    }
    return !hasWeakWorkGenericEvidenceLine(line);
  };
  const rawPrimarySupport = findPrimaryAnchorSupportLine(args.anchor, args.visibleEvidence);
  const weakVisibleEvidenceCount = args.visibleEvidence.filter((line) => !linePassesCriterion(line)).length;
  const needsVisibleEvidenceRepair =
    !rawPrimarySupport ||
    !linePassesCriterion(rawPrimarySupport.line) ||
    weakVisibleEvidenceCount >= 3;
  const needsConceptualTextRepair =
    isConceptualCriterion(args.criterion) &&
    (hasWeakConceptualGenericText(args.strengthRead, args.anchor) ||
      hasWeakConceptualGenericText(args.preserve, args.anchor));
  if (!needsVisibleEvidenceRepair && !needsConceptualTextRepair) {
    return {
      visibleEvidence: args.visibleEvidence,
      strengthRead: args.strengthRead,
      preserve: args.preserve,
      wasSalvaged: false,
    };
  }

  const synthesizedEvidence = observationEvidenceCandidates(
    args.observationBank,
    args.observationPassageId,
    args.anchor,
    args.criterion
  );

  const supportFirst = synthesizedEvidence.find((line) => anchorSupportedByEvidenceLine(args.anchor, line));
  const existingConcrete = args.visibleEvidence.filter((line) => linePassesCriterion(line));
  const synthesizedConcrete = synthesizedEvidence.filter((line) => linePassesCriterion(line));
  const curatedEvidence = uniqueNonEmptyLines(
    [
      supportFirst,
      ...synthesizedConcrete,
      ...existingConcrete,
      ...synthesizedEvidence,
      ...args.visibleEvidence,
    ],
    4,
    4
  );
  const supportLine =
    findPrimaryAnchorSupportLine(args.anchor, curatedEvidence)?.line ??
    synthesizedEvidence.find((line) => anchorSupportedByEvidenceLine(args.anchor, line));

  const repairedStrengthRead =
    isConceptualCriterion(args.criterion) && hasWeakConceptualGenericText(args.strengthRead, args.anchor)
      ? supportLine ?? synthesizedEvidence[0] ?? args.anchor
      : args.strengthRead;
  const repairedPreserve =
    isConceptualCriterion(args.criterion) && hasWeakConceptualGenericText(args.preserve, args.anchor)
      ? `Preserve the visible relationship in ${args.anchor}.`
      : args.preserve;
  const replacedWeakLines =
    needsVisibleEvidenceRepair &&
    curatedEvidence.some((line) => synthesizedEvidence.includes(line)) &&
    args.visibleEvidence.some((line) => !curatedEvidence.includes(line));
  const repairedConceptualText =
    needsConceptualTextRepair &&
    (repairedStrengthRead !== args.strengthRead || repairedPreserve !== args.preserve);
  const wasSalvaged = replacedWeakLines || repairedConceptualText;
  const reason =
    args.criterion === 'Composition and shape structure'
      ? 'replaced weak composition evidence with observation-bank structural events'
      : isConceptualCriterion(args.criterion)
        ? 'replaced generic conceptual evidence with observation-bank carrier evidence'
        : 'replaced weak evidence with observation-bank support';

  return {
    visibleEvidence: curatedEvidence,
    strengthRead: repairedStrengthRead,
    preserve: repairedPreserve,
    wasSalvaged,
    ...(wasSalvaged ? { reason } : {}),
  };
}

function syntheticTensionRead(criterion: CriterionLabel, anchor: string): string {
  if (isConceptualCriterion(criterion)) {
    return sentence(`The visible carrier in ${anchor} still needs a clearer event-level explanation of why that passage holds the read`);
  }
  if (criterion === 'Composition and shape structure') {
    return sentence(`The structural event in ${anchor} still needs a clearer interval or overlap read`);
  }
  return 'This criterion reads resolved at the level the painting is working at.';
}

function synthesizeEvidenceEntryFromObservation(
  criterion: CriterionLabel,
  observationBank: ObservationBank
): CritiqueEvidenceDTO['criterionEvidence'][number] {
  const preferredRoleByCriterion: Partial<Record<CriterionLabel, ObservationBank['passages'][number]['role']>> = {
    'Intent and necessity': 'intent',
    'Composition and shape structure': 'structure',
    'Value and light structure': 'value',
    'Color relationships': 'color',
    'Drawing, proportion, and spatial form': 'structure',
    'Edge and focus control': 'edge',
    'Surface and medium handling': 'surface',
    'Presence, point of view, and human force': 'presence',
  };
  const preferredRole = preferredRoleByCriterion[criterion];
  const scoreConceptualCarrier = (
    carrier: ObservationBank['intentCarriers'][number]
  ): number => {
    const passage = observationBank.passages.find((entry) => entry.id === carrier.passageId);
    if (!passage) return -Infinity;
    let score = 0;
    if (passage.role === preferredRole) score += 10;
    if (passage.role === 'intent' || passage.role === 'presence') score += 7;
    if (passage.role === 'value' || passage.role === 'edge' || passage.role === 'surface' || passage.role === 'color') {
      score += 4;
    }
    if (passage.role === 'structure') score -= 4;
    if (/\b(pressure|presence|force|vulnerability|isolation|withheld|address|tension|commitment)\b/i.test(carrier.reason)) {
      score += 4;
    }
    if (/\b(speed|movement|motion|energy|depth|distance|scale|balance|composition)\b/i.test(carrier.reason)) {
      score -= 3;
    }
    return score;
  };
  const preferredCarrier =
    isConceptualCriterion(criterion)
      ? observationBank.intentCarriers
          .slice()
          .sort((left, right) => scoreConceptualCarrier(right) - scoreConceptualCarrier(left))[0]
      : undefined;

  const passage =
    (preferredCarrier &&
      observationBank.passages.find((entry) => entry.id === preferredCarrier.passageId)) ||
    observationBank.passages.find((entry) => entry.role === preferredRole) ||
    observationBank.passages[0];

  if (!passage) {
    throw new Error(`Unable to synthesize evidence for ${criterion}`);
  }

  const anchor = passage.label;
  const visibleEvidence = uniqueNonEmptyLines(
    observationEvidenceCandidates(observationBank, passage.id, anchor, criterion),
    4,
    4
  );
  const supportLine =
    findPrimaryAnchorSupportLine(anchor, visibleEvidence)?.line ??
    visibleEvidence[0] ??
    anchor;
  const carrierReason =
    preferredCarrier?.reason && sharesConcreteLanguage(preferredCarrier.passage, anchor, 2)
      ? hasWeakConceptualGenericText(preferredCarrier.reason, anchor)
        ? sentence(supportLine)
        : sentence(preferredCarrier.reason)
      : sentence(`The visible relationship in ${anchor} carries this criterion most clearly`);

  return {
    criterion,
    observationPassageId: passage.id,
    anchor,
    visibleEvidence,
    strengthRead: isConceptualCriterion(criterion) ? carrierReason : sentence(supportLine),
    tensionRead: syntheticTensionRead(criterion, anchor),
    preserve: sentence(`Preserve the visible relationship in ${anchor}`),
    confidence: 'medium',
  };
}

export function synthesizeEvidenceFromObservationBank(
  observationBank: ObservationBank
): CritiqueEvidenceDTO {
  const criterionEvidence = CRITERIA_ORDER.map((criterion) =>
    synthesizeEvidenceEntryFromObservation(criterion, observationBank)
  );
  return {
    intentHypothesis: fallbackIntentHypothesis(criterionEvidence),
    strongestVisibleQualities: fallbackStrongestVisibleQualities(criterionEvidence),
    mainTensions: uniqueNonEmptyLines(
      criterionEvidence.map((entry) => entry.tensionRead),
      2,
      4
    ),
    completionRead: {
      state: 'uncertain',
      confidence: 'medium',
      cues: ['Evidence was synthesized deterministically from the observation bank after evidence retries failed.'],
      rationale: 'The pipeline preserved a critique-safe read from the observation bank when stage-1 evidence generation did not stabilize.',
    },
    photoQualityRead: {
      level: 'fair',
      summary: 'The final evidence pass was synthesized from the observation bank rather than accepted raw from stage 1.',
      issues: ['Stage-1 evidence retries did not stabilize, so the observation bank was used as the final evidence source.'],
    },
    comparisonObservations: [],
    criterionEvidence,
    salvagedCriteria: criterionEvidence.map((entry) => ({
      stage: 'evidence',
      criterion: entry.criterion,
      reason: 'synthesized deterministic evidence from observation bank after evidence retries failed',
    })),
  };
}

function evidenceForCriterion(
  evidence: CritiqueEvidenceDTO,
  criterion: CriterionLabel
): CritiqueEvidenceDTO['criterionEvidence'][number] {
  const match = evidence.criterionEvidence.find((entry) => entry.criterion === criterion);
  if (!match) {
    throw new CritiqueGroundingError(`Missing evidence for ${criterion}`, {
      stage: 'final',
      details: [`No evidence entry was found for ${criterion}.`],
    });
  }
  return match;
}

function prioritizePrimarySupportLine(anchor: string, visibleEvidence: string[]): string[] {
  const primarySupport = findPrimaryAnchorSupportLine(anchor, visibleEvidence)?.line;
  if (!primarySupport) return visibleEvidence;
  const ordered = [primarySupport, ...visibleEvidence.filter((line) => line !== primarySupport)];
  return ordered;
}

function edgeMoveNamesConcreteRelationship(text: string): boolean {
  const normalized = normalizeWhitespace(text).toLowerCase();
  if (!normalized) return false;
  const hasEdgeTerm = /\b(edge|edges|contour|contours|boundary|boundaries|outline|outlines)\b/.test(normalized);
  const hasRelationalCue =
    /\b(against|between|where|versus|than|while|not\b|so\b)\b/.test(normalized) ||
    normalized.includes('-to-');
  return hasEdgeTerm && hasRelationalCue;
}

function textTracksAnchorPassage(text: string, anchorSummary: string): boolean {
  const normalizedText = normalizeWhitespace(text);
  const normalizedAnchor = normalizeWhitespace(anchorSummary);
  if (!normalizedText || !normalizedAnchor) return false;
  if (normalizedText.toLowerCase().includes(normalizedAnchor.toLowerCase())) return true;
  return sharesConcreteLanguage(normalizedText, normalizedAnchor, 2);
}

function moveSwitchesToDifferentPassage(
  move: string,
  currentRead: string,
  anchorSummary: string
): boolean {
  const normalizedMove = normalizeWhitespace(move).toLowerCase();
  const normalizedAnchor = normalizeWhitespace(anchorSummary).toLowerCase();
  const normalizedRead = normalizeWhitespace(currentRead).toLowerCase();
  if (!normalizedMove || !normalizedAnchor) return false;
  if (normalizedMove.includes(normalizedAnchor)) return false;
  if (normalizedRead && sharesConcreteLanguage(normalizedMove, normalizedRead, 2)) return false;
  const namedPassageCue = /\b(figure|boat|mountain|mountains|sky|cloud|clouds|water|shore|shoreline|foreground|background|wall|shirt|head|face|chair|table|tree|house|sun)\b/;
  return namedPassageCue.test(normalizedMove) && !sharesConcreteLanguage(normalizedMove, normalizedAnchor, 2);
}

function isNormalizedNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateAnchor(raw: unknown, criterion: (typeof CRITERIA_ORDER)[number]): CriterionAnchor {
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid anchor for ${criterion}`);
  const o = raw as Record<string, unknown>;
  const region = o.region;
  if (
    typeof o.areaSummary !== 'string' ||
    o.areaSummary.trim().length < 4 ||
    typeof o.evidencePointer !== 'string' ||
    o.evidencePointer.trim().length < 4 ||
    !region ||
    typeof region !== 'object'
  ) {
    throw new Error(`Invalid anchor fields for ${criterion}`);
  }
  const r = region as Record<string, unknown>;
  if (
    !isNormalizedNumber(r.x) ||
    !isNormalizedNumber(r.y) ||
    !isNormalizedNumber(r.width) ||
    !isNormalizedNumber(r.height) ||
    r.width <= 0 ||
    r.height <= 0 ||
    (r.x as number) + (r.width as number) > 1 ||
    (r.y as number) + (r.height as number) > 1
  ) {
    throw new Error(`Invalid anchor region for ${criterion}`);
  }
  const areaSummary = o.areaSummary.trim();
  const evidencePointer = o.evidencePointer.trim();
  if (!isConcreteAnchor(areaSummary)) {
    throw new Error(`Anchor area is too generic for ${criterion}`);
  }
  if (!isConcreteAnchor(evidencePointer)) {
    throw new Error(`Anchor evidence pointer is too generic for ${criterion}`);
  }
  return {
    areaSummary,
    evidencePointer,
    region: {
      x: r.x as number,
      y: r.y as number,
      width: r.width as number,
      height: r.height as number,
    },
  };
}

function validateEditPlan(raw: unknown, criterion: (typeof CRITERIA_ORDER)[number]): CriterionEditPlan {
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid edit plan for ${criterion}`);
  const o = raw as Record<string, unknown>;
  if (
    typeof o.targetArea !== 'string' ||
    typeof o.preserveArea !== 'string' ||
    typeof o.issue !== 'string' ||
    typeof o.intendedChange !== 'string' ||
    typeof o.expectedOutcome !== 'string' ||
    typeof o.editability !== 'string' ||
    !(['yes', 'no'] as const).includes(o.editability as 'yes' | 'no')
  ) {
    throw new Error(`Invalid edit plan fields for ${criterion}`);
  }
  const targetArea = o.targetArea.trim();
  const preserveArea = o.preserveArea.trim();
  const issue = o.issue.trim();
  const intendedChange = o.intendedChange.trim();
  const expectedOutcome = o.expectedOutcome.trim();
  if (!isConcreteAnchor(targetArea) || !isConcreteAnchor(preserveArea)) {
    throw new Error(`Edit plan areas are too generic for ${criterion}`);
  }
  if (issue.length < 12 || expectedOutcome.length < 12) {
    throw new Error(`Edit plan detail is too thin for ${criterion}`);
  }
  return {
    targetArea,
    preserveArea,
    issue,
    intendedChange,
    expectedOutcome,
    editability: o.editability as 'yes' | 'no',
  };
}

function validateCanonicalPlan(raw: unknown, criterion: (typeof CRITERIA_ORDER)[number]) {
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid canonical Voice B plan for ${criterion}`);
  const o = raw as Record<string, unknown>;
  if (
    typeof o.currentRead !== 'string' ||
    typeof o.move !== 'string' ||
    typeof o.expectedRead !== 'string' ||
    typeof o.editability !== 'string' ||
    !(['yes', 'no'] as const).includes(o.editability as 'yes' | 'no')
  ) {
    throw new Error(`Invalid canonical Voice B plan fields for ${criterion}`);
  }
  const currentRead = o.currentRead.trim();
  const move = o.move.trim();
  const expectedRead = o.expectedRead.trim();
  if (currentRead.length < 12 || expectedRead.length < 12) {
    throw new Error(`Canonical Voice B plan detail is too thin for ${criterion}`);
  }
  return {
    currentRead,
    move,
    expectedRead,
    ...(typeof o.preserve === 'string' && o.preserve.trim().length > 0
      ? { preserve: o.preserve.trim() }
      : {}),
    editability: o.editability as 'yes' | 'no',
  };
}

function validateVoiceBPlan(raw: unknown, criterion: (typeof CRITERIA_ORDER)[number]) {
  if (!raw || typeof raw !== 'object') throw new Error(`Invalid Voice B plan for ${criterion}`);
  const o = raw as Record<string, unknown>;
  if (
    typeof o.currentRead !== 'string' ||
    typeof o.bestNextMove !== 'string' ||
    typeof o.expectedRead !== 'string'
  ) {
    throw new Error(`Invalid Voice B plan fields for ${criterion}`);
  }
  return {
    currentRead: o.currentRead.trim(),
    ...(typeof o.mainProblem === 'string' ? { mainProblem: o.mainProblem.trim() } : {}),
    ...(typeof o.mainStrength === 'string' ? { mainStrength: o.mainStrength.trim() } : {}),
    bestNextMove: o.bestNextMove.trim(),
    ...(typeof o.optionalSecondMove === 'string' ? { optionalSecondMove: o.optionalSecondMove.trim() } : {}),
    ...(typeof o.avoidDoing === 'string' ? { avoidDoing: o.avoidDoing.trim() } : {}),
    expectedRead: o.expectedRead.trim(),
    ...(typeof o.storyIfRelevant === 'string' ? { storyIfRelevant: o.storyIfRelevant.trim() } : {}),
  };
}

function validateVoiceBSteps(raw: unknown, criterion: (typeof CRITERIA_ORDER)[number]) {
  if (!Array.isArray(raw) || raw.length !== 1) {
    throw new Error(`Invalid Voice B steps for ${criterion}`);
  }
  return raw.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error(`Invalid Voice B step for ${criterion}`);
    const o = entry as Record<string, unknown>;
    if (
      typeof o.area !== 'string' ||
      typeof o.currentRead !== 'string' ||
      typeof o.move !== 'string' ||
      typeof o.expectedRead !== 'string'
    ) {
      throw new Error(`Invalid Voice B step fields for ${criterion}`);
    }
    const area = o.area.trim();
    const currentRead = o.currentRead.trim();
    const move = o.move.trim();
    const expectedRead = o.expectedRead.trim();
    if (!isConcreteAnchor(area)) {
      throw new Error(`Voice B step area is too generic for ${criterion}`);
    }
    if (o.priority !== 'primary') {
      throw new Error(`Voice B step priority must be primary for ${criterion}`);
    }
    return {
      area,
      currentRead,
      move,
      expectedRead,
      ...(typeof o.preserve === 'string' && o.preserve.trim().length > 0
        ? { preserve: o.preserve.trim() }
        : {}),
      priority: 'primary' as const,
    };
  });
}

function normalizePreviewCriterion(raw: string): (typeof CRITERIA_ORDER)[number] {
  const c = canonicalCriterionLabel(raw);
  if (c) return c;
  if (CRITERIA_ORDER.includes(raw as (typeof CRITERIA_ORDER)[number])) {
    return raw as (typeof CRITERIA_ORDER)[number];
  }
  return 'Composition and shape structure';
}

export function migrateLegacySimpleFeedback(o: Record<string, unknown>): CritiqueSimpleFeedbackDTO {
  const intent = typeof o.intent === 'string' ? o.intent : '';
  const working = Array.isArray(o.working) ? (o.working as string[]).filter((x) => typeof x === 'string') : [];
  const mainIssue = typeof o.mainIssue === 'string' ? o.mainIssue : '';
  const nextSteps = Array.isArray(o.nextSteps) ? (o.nextSteps as string[]).filter((x) => typeof x === 'string') : [];
  const preserve =
    typeof o.preserveSummary === 'string'
      ? o.preserveSummary
      : typeof o.preserve === 'string'
        ? o.preserve
        : '';

  const whatWorks =
    working.length > 0
      ? working.map((w) => `• ${w}`).join(' ')
      : intent.trim().length > 0
        ? intent
        : 'The painting offers a readable surface to build on; see the detailed categories for specifics.';

  const whatCouldImprove =
    mainIssue.trim().length > 0
      ? mainIssue
      : 'Several relationships could still be sharpened; use the criterion breakdown below for the main leverage points.';

  const studioChanges: StudioChangeDTO[] = [];
  for (let i = 0; i < nextSteps.length && studioChanges.length < 5; i++) {
    const text = nextSteps[i]!.trim();
    if (text.length < 8) continue;
    studioChanges.push({
      text,
      previewCriterion: CRITERIA_ORDER[Math.min(i, CRITERIA_ORDER.length - 1)]!,
    });
  }
  while (studioChanges.length < 2) {
    studioChanges.push({
      text:
        preserve.trim().length > 0
          ? `Protect ${preserve.slice(0, 120)}${preserve.length > 120 ? '…' : ''} while you refine one adjacent passage with a clearer value or edge.`
          : 'Choose the weakest visible passage and restate it with simpler value groups before adding detail elsewhere.',
      previewCriterion: 'Composition and shape structure',
    });
  }

  return {
    studioAnalysis: { whatWorks, whatCouldImprove },
    studioChanges: studioChanges.slice(0, 5),
  };
}

function fallbackSubskills(
  criterion: (typeof CRITERIA_ORDER)[number],
  level: (typeof RATING_LEVELS)[number],
  evidenceSignals: string[]
): Array<{
  label: string;
  score: number;
  level: (typeof RATING_LEVELS)[number];
}> {
  const fallbackLabels: Record<(typeof CRITERIA_ORDER)[number], [string, string]> = {
    'Intent and necessity': ['Coherence of aim', 'Support from formal choices'],
    'Composition and shape structure': ['Big-shape organization', 'Eye path control'],
    'Value and light structure': ['Light-dark grouping', 'Range control'],
    'Color relationships': ['Palette harmony', 'Temperature control'],
    'Drawing, proportion, and spatial form': ['Shape placement', 'Spatial construction'],
    'Edge and focus control': ['Edge hierarchy', 'Focus placement'],
    'Surface and medium handling': ['Mark economy', 'Surface character'],
    'Presence, point of view, and human force': ['Atmospheric force', 'Point of view'],
  };

  const numericLevel =
    level === 'Master' ? 0.92 : level === 'Advanced' ? 0.74 : level === 'Intermediate' ? 0.5 : 0.28;

  const fromEvidence = evidenceSignals
    .slice(0, 2)
    .map((signal, idx) => ({
      label: signal
        .replace(/^[a-z]/, (m) => m.toUpperCase())
        .replace(/\.$/, '')
        .slice(0, 48),
      score: Math.max(0, Math.min(1, numericLevel - idx * 0.04)),
      level,
    }))
    .filter((entry) => entry.label.length > 0);

  if (fromEvidence.length >= 2) return fromEvidence;

  const [labelA, labelB] = fallbackLabels[criterion];
  return [
    { label: labelA, score: numericLevel, level },
    { label: labelB, score: Math.max(0, Math.min(1, numericLevel - 0.06)), level },
  ];
}

const MAX_CRITERIA_PER_OBSERVATION_PASSAGE = 3;

/** Prefer distinct observation-bank passages across criteria; retry/repair when the model collapses too many rows onto one id. */
export function assertObservationPassageSpread(
  criterionEvidence: CritiqueEvidenceDTO['criterionEvidence']
): void {
  const byId = new Map<string, string[]>();
  for (const row of criterionEvidence) {
    const id = row.observationPassageId.trim();
    const list = byId.get(id) ?? [];
    list.push(row.criterion);
    byId.set(id, list);
  }
  for (const [id, criteria] of byId) {
    if (criteria.length > MAX_CRITERIA_PER_OBSERVATION_PASSAGE) {
      throw new Error(
        `Evidence anchor spread: observation passage ${id} is used for ${criteria.length} criteria (${criteria.join(
          ', '
        )}). Use at most ${MAX_CRITERIA_PER_OBSERVATION_PASSAGE} criteria per passage id unless you remap weaker rows to other passages in the observation bank.`
      );
    }
  }
}

export function validateEvidenceResult(raw: unknown, options: EvidenceValidationOptions = {}): CritiqueEvidenceDTO {
  const mode = options.mode ?? 'strict';
  if (!raw || typeof raw !== 'object') throw new Error('Invalid evidence API response');
  const o = raw as Record<string, unknown>;
  if (typeof o.intentHypothesis !== 'string') throw new Error('Invalid evidence: intentHypothesis');
  if (
    !Array.isArray(o.strongestVisibleQualities) ||
    o.strongestVisibleQualities.length < 2 ||
    o.strongestVisibleQualities.length > 4 ||
    o.strongestVisibleQualities.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: strongestVisibleQualities');
  }
  if (
    !Array.isArray(o.mainTensions) ||
    o.mainTensions.length < 2 ||
    o.mainTensions.length > 4 ||
    o.mainTensions.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: mainTensions');
  }
  const cr = o.completionRead;
  if (!cr || typeof cr !== 'object') throw new Error('Invalid evidence: completionRead');
  const crObj = cr as Record<string, unknown>;
  if (
    typeof crObj.state !== 'string' ||
    !(['unfinished', 'likely_finished', 'uncertain'] as const).includes(
      crObj.state as 'unfinished' | 'likely_finished' | 'uncertain'
    ) ||
    typeof crObj.confidence !== 'string' ||
    !(['low', 'medium', 'high'] as const).includes(crObj.confidence as 'low' | 'medium' | 'high') ||
    typeof crObj.rationale !== 'string' ||
    !Array.isArray(crObj.cues) ||
    crObj.cues.length < 1 ||
    crObj.cues.length > 4 ||
    crObj.cues.some((v: unknown) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: completionRead fields');
  }
  if (
    !o.photoQualityRead ||
    typeof o.photoQualityRead !== 'object' ||
    !Array.isArray((o.photoQualityRead as Record<string, unknown>).issues)
  ) {
    throw new Error('Invalid evidence: photoQualityRead');
  }
  const p = o.photoQualityRead as Record<string, unknown>;
  if (
    typeof p.level !== 'string' ||
    !(['poor', 'fair', 'good'] as const).includes(p.level as 'poor' | 'fair' | 'good') ||
    typeof p.summary !== 'string' ||
    (p.issues as unknown[]).some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: photoQualityRead fields');
  }
  if (
    !Array.isArray(o.comparisonObservations) ||
    o.comparisonObservations.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid evidence: comparisonObservations');
  }
  const comparisonObservations = (o.comparisonObservations as string[]).map((line) =>
    neutralizeWeakWorkComparisonObservation(line)
  );
  const salvagedCriteria: NonNullable<CritiqueEvidenceDTO['salvagedCriteria']> = [];
  const criterionEvidence = o.criterionEvidence;
  if (!Array.isArray(criterionEvidence) || criterionEvidence.length !== CRITERIA_ORDER.length) {
    throw new Error('Invalid evidence: criterionEvidence length');
  }
  const normalized = CRITERIA_ORDER.map((expected, i) => {
    const c = criterionEvidence[i];
    if (!c || typeof c !== 'object') throw new Error('Invalid evidence criterion');
    const r = c as Record<string, unknown>;
    if (typeof r.criterion !== 'string' || r.criterion !== expected) {
      throw new Error(`Invalid evidence criterion at index ${i}`);
    }
    if (
      typeof r.observationPassageId !== 'string' ||
      typeof r.anchor !== 'string' ||
      !Array.isArray(r.visibleEvidence) ||
      r.visibleEvidence.length < 4 ||
      r.visibleEvidence.length > 8 ||
      r.visibleEvidence.some((v) => typeof v !== 'string')
    ) {
      throw new Error(`Invalid visibleEvidence for ${expected}`);
    }
    if (
      typeof r.strengthRead !== 'string' ||
      typeof r.tensionRead !== 'string' ||
      typeof r.preserve !== 'string' ||
      typeof r.confidence !== 'string' ||
      !(['low', 'medium', 'high'] as const).includes(r.confidence as 'low' | 'medium' | 'high')
    ) {
      throw new Error(`Invalid evidence fields for ${expected}`);
    }
    let observationPassageId = r.observationPassageId.trim();
    let anchor = r.anchor.trim();
    let visibleEvidence = (r.visibleEvidence as string[]).map((line) => line.trim());
    let strengthRead = r.strengthRead.trim();
    let preserve = r.preserve.trim();
    const resolvedObservationPassage = resolveObservationPassageForCriterion(
      options.observationBank,
      observationPassageId,
      anchor,
      mode
    );
    observationPassageId = resolvedObservationPassage.observationPassageId;
    anchor = resolvedObservationPassage.anchor;
    if (mode === 'lenient') {
      const repaired = repairLenientCriterionEvidence({
        criterion: expected,
        observationPassageId,
        anchor,
        visibleEvidence,
        strengthRead,
        preserve,
        observationBank: options.observationBank,
      });
      visibleEvidence = repaired.visibleEvidence;
      strengthRead = repaired.strengthRead;
      preserve = repaired.preserve;
      if (repaired.wasSalvaged && repaired.reason) {
        salvagedCriteria.push({
          stage: 'evidence',
          criterion: expected,
          reason: repaired.reason,
        });
      }
    }
    if (!isConcreteAnchor(anchor) && mode === 'lenient') {
      anchor = recoverLenientEvidenceAnchor(expected, anchor, visibleEvidence, strengthRead, r.tensionRead.trim(), preserve);
    }
    if (!isConcreteAnchor(anchor)) {
      throw new Error(`Invalid evidence anchor for ${expected}`);
    }
    if (isConceptualCriterion(expected) && !hasSpecificConceptualCarrierAnchor(anchor)) {
      if (mode === 'lenient') {
        anchor = recoverLenientEvidenceAnchor(expected, anchor, visibleEvidence, strengthRead, r.tensionRead.trim(), preserve);
      }
      if (!hasSpecificConceptualCarrierAnchor(anchor)) {
        throw new Error(`Conceptual evidence anchor is too soft for ${expected}`);
      }
    }
    const primaryAnchorSupport = findPrimaryAnchorSupportLine(anchor, visibleEvidence);
    if (!primaryAnchorSupport) {
      throw new Error(`Visible evidence does not support anchor for ${expected}`);
    }
    if (isConceptualCriterion(expected) && hasWeakConceptualEvidenceLine(primaryAnchorSupport.line)) {
      throw new Error(`Visible evidence is too generic for ${expected}`);
    }
    const normalizedVisibleEvidence = prioritizePrimarySupportLine(anchor, visibleEvidence);
    if (visibleEvidence.filter((line) => hasWeakWorkGenericEvidenceLine(line)).length >= (mode === 'strict' ? 3 : 5)) {
      throw new Error(`Visible evidence is too generic for ${expected}`);
    }
    if (
      expected === 'Composition and shape structure' &&
      visibleEvidence.filter((line) => hasWeakCompositionGenericText(line)).length >= (mode === 'strict' ? 3 : 5)
    ) {
      throw new Error(`Visible evidence is too generic for ${expected}`);
    }
    if (
      isConceptualCriterion(expected) &&
      visibleEvidence.filter((line) => hasWeakConceptualEvidenceLine(line)).length >= (mode === 'strict' ? 3 : 5)
    ) {
      throw new Error(`Visible evidence is too generic for ${expected}`);
    }
    if (isConceptualCriterion(expected) && hasWeakConceptualGenericText(strengthRead, anchor)) {
      if (mode === 'strict') {
        throw new Error(`strengthRead is too generic for ${expected}`);
      }
      strengthRead = visibleEvidence[0] ?? anchor;
    }
    if (isConceptualCriterion(expected) && hasWeakConceptualGenericText(preserve, anchor)) {
      if (mode === 'strict') {
        throw new Error(`preserve is too generic for ${expected}`);
      }
      preserve = anchor;
    }
    return {
      criterion: expected,
      observationPassageId,
      anchor,
      visibleEvidence: normalizedVisibleEvidence,
      strengthRead,
      tensionRead: r.tensionRead,
      preserve,
      confidence: r.confidence as 'low' | 'medium' | 'high',
    };
  });

  const rawIntentHypothesis = o.intentHypothesis.trim();
  const rawStrongestVisibleQualities = (o.strongestVisibleQualities as string[]).map((line) => line.trim());
  const intentHypothesis =
    !hasFlatteringWeakWorkTopLevelText(rawIntentHypothesis) && hasNeutralWeakWorkTopLevelText(rawIntentHypothesis)
      ? rawIntentHypothesis
      : mode === 'lenient'
        ? fallbackIntentHypothesis(normalized)
        : (() => {
            throw new Error('Evidence intentHypothesis is too flattering or style-biased for weak work');
          })();

  const strongestVisibleQualities =
    rawStrongestVisibleQualities.filter(
      (line) => !hasFlatteringWeakWorkTopLevelText(line) && hasNeutralWeakWorkTopLevelText(line)
    ).length >= 2
      ? rawStrongestVisibleQualities
      : mode === 'lenient'
        ? fallbackStrongestVisibleQualities(normalized)
        : (() => {
            throw new Error('Evidence strongestVisibleQualities are too flattering or style-biased for weak work');
          })();

  if (strongestVisibleQualities.length < 2 || strongestVisibleQualities.length > 4) {
    throw new Error('Invalid evidence: strongestVisibleQualities');
  }

  assertObservationPassageSpread(normalized);

  return {
    intentHypothesis,
    strongestVisibleQualities,
    mainTensions: o.mainTensions as string[],
    completionRead: {
      state: crObj.state as 'unfinished' | 'likely_finished' | 'uncertain',
      confidence: crObj.confidence as 'low' | 'medium' | 'high',
      cues: crObj.cues as string[],
      rationale: crObj.rationale,
    },
    photoQualityRead: {
      level: p.level as 'poor' | 'fair' | 'good',
      summary: p.summary,
      issues: p.issues as string[],
    },
    comparisonObservations,
    criterionEvidence: normalized,
    ...(salvagedCriteria.length > 0 ? { salvagedCriteria } : {}),
  };
}

function countTraceableCriteria(text: string, evidence: CritiqueEvidenceDTO): number {
  return evidence.criterionEvidence.filter((entry) => tracesToVisibleEvidence(text, entry)).length;
}

export function validateVoiceAStageOutput(
  voiceA: VoiceAStageResult,
  evidence: CritiqueEvidenceDTO
): VoiceAStageResult {
  const details: string[] = [];

  if (countTraceableCriteria(voiceA.summary, evidence) < 2) {
    details.push(
      'Voice A summary must name concrete content tied to at least two different criterion anchors from the evidence (not a single vague read).'
    );
  }
  if (countTraceableCriteria(voiceA.overallSummary.analysis, evidence) < 3) {
    details.push(
      'Voice A overall summary must weave in at least three distinct criterion anchors or their visibleEvidence lines—avoid one generic overview.'
    );
  }
  if (countTraceableCriteria(voiceA.studioAnalysis.whatWorks, evidence) < 2) {
    details.push(
      'Voice A whatWorks must reference at least two different anchored passages from the evidence, not one loose compliment.'
    );
  }
  if (countTraceableCriteria(voiceA.studioAnalysis.whatCouldImprove, evidence) < 2) {
    details.push(
      'Voice A whatCouldImprove must reference at least two different anchored passages from the evidence, not vague “areas to improve”.'
    );
  }

  for (const category of voiceA.categories) {
    const criterion = category.criterion as CriterionLabel;
    const criterionEvidence = evidenceForCriterion(evidence, criterion);
    if (!tracesToVisibleEvidence(category.phase1.visualInventory, criterionEvidence)) {
      details.push(`${criterion}: phase1.visualInventory drifted from the evidence anchor.`);
    }
    if (!proseEchoesAnchor(category.phase1.visualInventory, criterionEvidence.anchor, 3)) {
      details.push(
        `${criterion}: phase1.visualInventory must quote or closely echo this criterion's anchor (≥3 shared concrete terms or the anchor phrase itself).`
      );
    }
    if (countEvidenceLineGroundingHits(category.phase1.visualInventory, criterionEvidence) < 2) {
      details.push(
        `${criterion}: phase1.visualInventory must pull detail from at least two different visibleEvidence lines for this criterion.`
      );
    }
    if (!tracesToPrimarySupportLine(category.phase2.criticsAnalysis, criterionEvidence)) {
      details.push(`${criterion}: phase2.criticsAnalysis is not traceable to visibleEvidence.`);
    }
    if (!proseEchoesAnchor(category.phase2.criticsAnalysis, criterionEvidence.anchor, 3)) {
      details.push(
        `${criterion}: phase2.criticsAnalysis must stay locked to this criterion's anchor (≥3 shared concrete terms or the anchor phrase itself).`
      );
    }
    if (countEvidenceLineGroundingHits(category.phase2.criticsAnalysis, criterionEvidence) < 2) {
      details.push(
        `${criterion}: phase2.criticsAnalysis must engage at least two different visibleEvidence lines, not a single generic judgment.`
      );
    }
    if (!category.evidenceSignals.every((signal) => tracesShortEvidenceSignal(signal, criterionEvidence))) {
      details.push(`${criterion}: one or more evidenceSignals are not traceable to visibleEvidence.`);
    }
    if (category.evidenceSignals.some((signal) => normalizeWhitespace(signal).length < 12)) {
      details.push(`${criterion}: one or more evidenceSignals are too short to be trustworthy.`);
    }
    if (category.level === 'Master' && evidence.photoQualityRead.level !== 'good') {
      details.push(`${criterion}: Master is blocked because photo quality is not good.`);
    }
    if (category.level === 'Master' && evidence.completionRead.state !== 'likely_finished') {
      details.push(`${criterion}: Master is blocked because the work does not read as likely_finished.`);
    }
  }

  if (details.length > 0) {
    throw new CritiqueGroundingError('Voice A output failed grounding validation.', {
      stage: 'voice_a',
      details,
    });
  }
  return voiceA;
}

export function validateVoiceBStageOutput(
  voiceB: VoiceBStageResult,
  voiceA: VoiceAStageResult,
  evidence: CritiqueEvidenceDTO
): VoiceBStageResult {
  const details: string[] = [];
  const levelsByCriterion = new Map(voiceA.categories.map((category) => [category.criterion, category.level] as const));
  const hydratedCategories: VoiceBStageResult['categories'] = voiceB.categories.map((category) =>
    hydrateVoiceBCanonicalCategory(category)
  );

  for (const category of hydratedCategories) {
    const criterion = category.criterion as CriterionLabel;
    const criterionEvidence = evidenceForCriterion(evidence, criterion);
    const level = levelsByCriterion.get(criterion);
    const anchor = category.anchor;
    const plan = category.plan;
    const step = category.actionPlanSteps?.[0];
    const editPlan = category.editPlan;

    if (!anchor || !plan) {
      details.push(`${criterion}: canonical Voice B anchor or plan is missing.`);
      continue;
    }

    if (!sharesConcreteLanguage(anchor.areaSummary, criterionEvidence.anchor, 2)) {
      details.push(`${criterion}: anchor.areaSummary drifted from the evidence-stage anchor.`);
    }
    if (!tracesToPrimarySupportLine(anchor.evidencePointer, criterionEvidence)) {
      details.push(`${criterion}: anchor.evidencePointer is not traceable to visibleEvidence.`);
    }
    if (!tracesToPrimarySupportLine(category.phase3.teacherNextSteps, criterionEvidence)) {
      details.push(`${criterion}: teacherNextSteps is not traceable to the evidence anchor.`);
    }
    if (!proseEchoesAnchor(category.phase3.teacherNextSteps, anchor.areaSummary, 3)) {
      details.push(
        `${criterion}: teacherNextSteps must name or echo the anchored passage (≥3 shared concrete terms with anchor.areaSummary or the anchor phrase itself).`
      );
    }
    if (countEvidenceLineGroundingHits(category.phase3.teacherNextSteps, criterionEvidence) < 1) {
      details.push(
        `${criterion}: teacherNextSteps must reuse vocabulary from at least one visibleEvidence line for this criterion.`
      );
    }
    if (!tracesToPrimarySupportLine(plan.currentRead, criterionEvidence)) {
      details.push(`${criterion}: plan.currentRead is not traceable to visibleEvidence.`);
    }
    if (!proseEchoesAnchor(plan.currentRead, anchor.areaSummary, 3)) {
      details.push(
        `${criterion}: plan.currentRead must echo the anchored passage with specific visible detail, not an abstract diagnosis.`
      );
    }
    if (
      !proseEchoesAnchor(plan.move, anchor.areaSummary, 2) &&
      !sharesConcreteLanguage(plan.move, plan.currentRead, 2)
    ) {
      details.push(
        `${criterion}: plan.move must stay on the anchored passage (either ≥2 shared terms with anchor.areaSummary or ≥2 shared terms with plan.currentRead).`
      );
    }
    if (moveSwitchesToDifferentPassage(plan.move, plan.currentRead, anchor.areaSummary)) {
      details.push(`${criterion}: plan.move drifted away from the anchored passage.`);
    }
    if (isGenericTeacherText(category.phase3.teacherNextSteps)) {
      details.push(`${criterion}: teacherNextSteps still contains generic coaching.`);
    }
    if (isGenericTeacherText(plan.move)) {
      details.push(`${criterion}: the main teaching move is still generic.`);
    }
    if (
      criterion === 'Edge and focus control' &&
      !edgeMoveNamesConcreteRelationship(plan.move)
    ) {
      details.push(
        `${criterion}: plan.move must name a concrete edge relationship, not only a generic focus or clarity goal.`
      );
    }
    if (step && !sharesConcreteLanguage(step.area, anchor.areaSummary, 2)) {
      details.push(`${criterion}: actionPlanSteps[0].area does not match the anchored passage.`);
    }
    if (step && !tracesToPrimarySupportLine(step.currentRead, criterionEvidence)) {
      details.push(`${criterion}: actionPlanSteps[0].currentRead is not traceable to visibleEvidence.`);
    }
    if (editPlan && !tracesToPrimarySupportLine(editPlan.issue, criterionEvidence)) {
      details.push(`${criterion}: editPlan.issue is not traceable to visibleEvidence.`);
    }
    if (editPlan && !sharesConcreteLanguage(editPlan.targetArea, anchor.areaSummary, 2)) {
      details.push(`${criterion}: editPlan.targetArea does not match the anchored passage.`);
    }

    if (level === 'Master') {
      if (!CRITIQUE_DONT_CHANGE_PATTERN.test(category.phase3.teacherNextSteps)) {
        details.push(`${criterion}: Master guidance must begin with "Don't change a thing."`);
      }
      if (!CRITIQUE_PRESERVE_VERB_PATTERN.test(plan.move)) {
        details.push(`${criterion}: Master plan.move must be preserve-only.`);
      }
      if (CRITIQUE_CHANGE_VERB_PATTERN.test(plan.move)) {
        details.push(`${criterion}: Master guidance must be preserve-only, not a change instruction.`);
      }
      if (plan.editability !== 'no') {
        details.push(`${criterion}: Master plan.editability must be "no".`);
      }
    } else {
      if (CRITIQUE_DONT_CHANGE_PATTERN.test(category.phase3.teacherNextSteps)) {
        details.push(`${criterion}: non-Master guidance cannot use "Don't change a thing."`);
      }
      if (!CRITIQUE_CHANGE_VERB_PATTERN.test(plan.move) || CRITIQUE_PRESERVE_VERB_PATTERN.test(plan.move)) {
        details.push(`${criterion}: non-Master plan.move must be a true change instruction.`);
      }
      if (plan.editability !== 'yes') {
        details.push(`${criterion}: non-Master plan.editability must be "yes".`);
      }
    }
  }

  for (let i = 0; i < hydratedCategories.length; i++) {
    const current = hydratedCategories[i]!;
    for (let j = i + 1; j < voiceB.categories.length; j++) {
      const other = hydratedCategories[j]!;
      const currentAnchor = current.anchor;
      const otherAnchor = other.anchor;
      if (!currentAnchor || !otherAnchor) continue;
      const currentAdvice = `${currentAnchor.areaSummary} ${current.plan?.move ?? ''} ${current.phase3.teacherNextSteps}`;
      const otherAdvice = `${otherAnchor.areaSummary} ${other.plan?.move ?? ''} ${other.phase3.teacherNextSteps}`;
      if (sameAdvice(currentAdvice, otherAdvice)) {
        details.push(
          `${current.criterion} and ${other.criterion}: teacher guidance is duplicative instead of criterion-specific.`
        );
      }
    }
  }

  for (const change of voiceB.studioChanges) {
    const previewCriterion = change.previewCriterion as CriterionLabel;
    const criterionEvidence = evidenceForCriterion(evidence, previewCriterion);
    if (!tracesToVisibleEvidence(change.text, criterionEvidence)) {
      details.push(`${previewCriterion}: studioChanges text drifted from the criterion anchor.`);
    }
    if (isGenericTeacherText(change.text)) {
      details.push(`${previewCriterion}: studioChanges text still uses generic advice.`);
    }
  }

  if (details.length > 0) {
    throw new CritiqueValidationError('Voice B output failed teaching-plan validation.', {
      stage: 'voice_b',
      details,
    });
  }
  return {
    ...voiceB,
    categories: hydratedCategories,
  };
}

export function validateCritiqueGrounding(
  critique: CritiqueResultDTO,
  evidence: CritiqueEvidenceDTO
): CritiqueResultDTO {
  const details: string[] = [];

  for (const category of critique.categories) {
    const criterionEvidence = evidenceForCriterion(evidence, category.criterion);
    const hydrated = hydrateVoiceBCanonicalCategory(category);
    const anchor = hydrated.anchor;
    const plan = hydrated.plan;
    if (!anchor || !plan) {
      details.push(`${category.criterion}: final category is missing anchor or canonical plan data.`);
      continue;
    }
    if (!sharesConcreteLanguage(anchor.areaSummary, criterionEvidence.anchor, 2)) {
      details.push(`${category.criterion}: final anchor drifted from the evidence-stage anchor.`);
    }
    if (!tracesToPrimarySupportLine(category.phase2.criticsAnalysis, criterionEvidence)) {
      details.push(`${category.criterion}: final critic analysis is not traceable to visibleEvidence.`);
    }
    if (!tracesToPrimarySupportLine(category.phase3.teacherNextSteps, criterionEvidence)) {
      details.push(`${category.criterion}: final teacher guidance is not traceable to visibleEvidence.`);
    }
    if (!textTracksAnchorPassage(category.phase3.teacherNextSteps, anchor.areaSummary)) {
      details.push(`${category.criterion}: final teacher guidance drifted away from the anchored passage.`);
    }
    if (!tracesToPrimarySupportLine(plan.currentRead, criterionEvidence)) {
      details.push(`${category.criterion}: final plan.currentRead is not traceable to visibleEvidence.`);
    }
    if (moveSwitchesToDifferentPassage(plan.move, plan.currentRead, anchor.areaSummary)) {
      details.push(`${category.criterion}: final plan.move drifted away from the anchored passage.`);
    }
  }

  if (details.length > 0) {
    throw new CritiqueGroundingError('Final critique failed evidence traceability validation.', {
      stage: 'final',
      details,
    });
  }
  return critique;
}

function parseSimpleFeedback(o: Record<string, unknown>): CritiqueSimpleFeedbackDTO {
  const sa = o.studioAnalysis;
  const sc = o.studioChanges;
  if (sa && typeof sa === 'object' && Array.isArray(sc)) {
    const a = sa as Record<string, unknown>;
    if (typeof a.whatWorks !== 'string' || typeof a.whatCouldImprove !== 'string') {
      throw new Error('Invalid critique: studioAnalysis fields');
    }
    if (sc.length < 2 || sc.length > 5) throw new Error('Invalid critique: studioChanges length');
    const studioChanges: StudioChangeDTO[] = [];
    for (const item of sc) {
      if (!item || typeof item !== 'object') throw new Error('Invalid critique: studioChanges item');
      const r = item as Record<string, unknown>;
      if (typeof r.text !== 'string' || typeof r.previewCriterion !== 'string') {
        throw new Error('Invalid critique: studioChanges item fields');
      }
      studioChanges.push({
        text: r.text,
        previewCriterion: normalizePreviewCriterion(r.previewCriterion),
      });
    }
    return {
      studioAnalysis: { whatWorks: a.whatWorks, whatCouldImprove: a.whatCouldImprove },
      studioChanges,
    };
  }
  if (typeof o.intent === 'string' && Array.isArray(o.working) && typeof o.mainIssue === 'string') {
    return migrateLegacySimpleFeedback(o);
  }
  throw new Error('Invalid critique: studioRead (studioAnalysis + studioChanges or legacy simple fields)');
}

export function validateCritiqueResult(raw: unknown): CritiqueResultDTO {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid API response');
  const o = raw as Record<string, unknown>;
  if (typeof o.summary !== 'string') throw new Error('Invalid critique: summary');
  const overallSummaryRaw = o.overallSummary;
  if (!overallSummaryRaw || typeof overallSummaryRaw !== 'object') {
    throw new Error('Invalid critique: overallSummary');
  }
  const overallSummaryObj = overallSummaryRaw as Record<string, unknown>;
  const topPrioritiesRaw = overallSummaryObj.topPriorities;
  if (
    typeof overallSummaryObj.analysis !== 'string' ||
    !Array.isArray(topPrioritiesRaw) ||
    topPrioritiesRaw.some((v: unknown) => typeof v !== 'string')
  ) {
    throw new Error('Invalid critique: overallSummary');
  }
  const simpleFeedback = parseSimpleFeedback(o);
  if (
    typeof o.overallConfidence !== 'string' ||
    !(['low', 'medium', 'high'] as const).includes(o.overallConfidence as 'low' | 'medium' | 'high')
  ) {
    throw new Error('Invalid critique: overallConfidence');
  }
  const cats = o.categories;
  if (!Array.isArray(cats) || cats.length !== CRITERIA_ORDER.length) {
    throw new Error('Invalid critique: categories length');
  }
  const categories = CRITERIA_ORDER.map((expected: (typeof CRITERIA_ORDER)[number], i: number) => {
    const c = cats[i];
    if (!c || typeof c !== 'object') throw new Error('Invalid category');
    const r = c as Record<string, unknown>;
    if (typeof r.criterion !== 'string' || r.criterion !== expected) {
      throw new Error(`Invalid criterion at index ${i}`);
    }
    if (typeof r.level !== 'string' || !RATING_LEVELS.includes(r.level as (typeof RATING_LEVELS)[number])) {
      throw new Error(`Invalid level for ${expected}`);
    }
    const phase1 = r.phase1;
    const phase2 = r.phase2;
    const phase3 = r.phase3;
    if (
      !phase1 || typeof phase1 !== 'object' ||
      !phase2 || typeof phase2 !== 'object' ||
      !phase3 || typeof phase3 !== 'object'
    ) {
      throw new Error(`Invalid phases for ${expected}`);
    }
    const p1 = phase1 as Record<string, unknown>;
    const p2 = phase2 as Record<string, unknown>;
    const p3 = phase3 as Record<string, unknown>;
    if (
      typeof p1.visualInventory !== 'string' ||
      p1.visualInventory.trim().length < 12 ||
      typeof p2.criticsAnalysis !== 'string' ||
      typeof p3.teacherNextSteps !== 'string'
    ) {
      throw new Error(`Invalid text for ${expected}`);
    }
    if (
      typeof r.confidence !== 'string' ||
      !(['low', 'medium', 'high'] as const).includes(r.confidence as 'low' | 'medium' | 'high')
    ) {
      throw new Error(`Invalid confidence for ${expected}`);
    }
    if (!Array.isArray(r.evidenceSignals) || r.evidenceSignals.some((v) => typeof v !== 'string')) {
      throw new Error(`Invalid evidence signals for ${expected}`);
    }
    if (typeof r.preserve !== 'string' || typeof r.nextTarget !== 'string') {
      throw new Error(`Invalid coaching metadata for ${expected}`);
    }
    const anchor = validateAnchor(r.anchor, expected);
    const plan = r.plan ? validateCanonicalPlan(r.plan, expected) : undefined;
    const editPlan = r.editPlan ? validateEditPlan(r.editPlan, expected) : undefined;
    const voiceBPlan = r.voiceBPlan ? validateVoiceBPlan(r.voiceBPlan, expected) : undefined;
    const actionPlanSteps = r.actionPlanSteps ? validateVoiceBSteps(r.actionPlanSteps, expected) : undefined;
    const subskills =
      Array.isArray(r.subskills) &&
      r.subskills.length >= 2 &&
      r.subskills.length <= 4 &&
      !r.subskills.some((entry) => {
        if (!entry || typeof entry !== 'object') return true;
        const sub = entry as Record<string, unknown>;
        return (
          typeof sub.label !== 'string' ||
          typeof sub.score !== 'number' ||
          sub.score < 0 ||
          sub.score > 1 ||
          typeof sub.level !== 'string' ||
          !RATING_LEVELS.includes(sub.level as (typeof RATING_LEVELS)[number])
        );
      })
        ? (r.subskills as Array<{
            label: string;
            score: number;
            level: (typeof RATING_LEVELS)[number];
          }>)
        : fallbackSubskills(
            expected,
            r.level as (typeof RATING_LEVELS)[number],
            Array.isArray(r.evidenceSignals) ? (r.evidenceSignals as string[]) : []
          );
    return hydrateVoiceBCanonicalCategory({
      criterion: r.criterion as (typeof CRITERIA_ORDER)[number],
      level: r.level as (typeof RATING_LEVELS)[number],
      phase1: {
        visualInventory: p1.visualInventory.trim(),
      },
      phase2: {
        criticsAnalysis: p2.criticsAnalysis.trim(),
      },
      phase3: {
        teacherNextSteps: p3.teacherNextSteps.trim(),
      },
      confidence: r.confidence as 'low' | 'medium' | 'high',
      evidenceSignals: r.evidenceSignals as string[],
      preserve: r.preserve,
      nextTarget: r.nextTarget,
      anchor,
      ...(plan ? { plan } : {}),
      ...(editPlan ? { editPlan } : {}),
      ...(voiceBPlan ? { voiceBPlan } : {}),
      ...(actionPlanSteps ? { actionPlanSteps } : {}),
      subskills,
    });
  });
  const cn = o.comparisonNote;
  if (cn !== null && (typeof cn !== 'string' || cn.length === 0)) {
    throw new Error('Invalid comparisonNote');
  }
  const analysisSource =
    o.analysisSource === 'fallback'
      ? 'fallback'
      : o.analysisSource === 'api'
        ? 'api'
        : 'api';
  const pipeline =
    o.pipeline && typeof o.pipeline === 'object'
      ? (o.pipeline as CritiqueResultDTO['pipeline'])
      : undefined;
  const photoQuality = o.photoQuality;
  if (!photoQuality || typeof photoQuality !== 'object') throw new Error('Invalid photoQuality');
  const pq = photoQuality as Record<string, unknown>;
  if (
    typeof pq.level !== 'string' ||
    !(['poor', 'fair', 'good'] as const).includes(pq.level as 'poor' | 'fair' | 'good') ||
    typeof pq.summary !== 'string' ||
    !Array.isArray(pq.issues) ||
    pq.issues.some((v) => typeof v !== 'string') ||
    !Array.isArray(pq.tips) ||
    pq.tips.some((v) => typeof v !== 'string')
  ) {
    throw new Error('Invalid photoQuality fields');
  }
  const titlesRaw = o.suggestedPaintingTitles;
  if (!Array.isArray(titlesRaw) || titlesRaw.length !== 3) {
    throw new Error('Invalid critique: suggestedPaintingTitles');
  }
  const validCategories = new Set(['formalist', 'tactile', 'intent']);
  const suggestedPaintingTitles: SuggestedTitleDTO[] = titlesRaw.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Invalid suggestedPaintingTitles item');
    const e = entry as Record<string, unknown>;
    if (
      typeof e.category !== 'string' || !validCategories.has(e.category) ||
      typeof e.title !== 'string' || e.title.trim().length === 0 ||
      typeof e.rationale !== 'string' || e.rationale.trim().length === 0
    ) {
      throw new Error('Invalid suggestedPaintingTitles item fields');
    }
    return {
      category: e.category as SuggestedTitleDTO['category'],
      title: e.title.trim(),
      rationale: e.rationale.trim(),
    };
  });
  return {
    summary: o.summary,
    overallSummary: {
      analysis: overallSummaryObj.analysis as string,
      topPriorities: overallSummaryObj.topPriorities as string[],
    },
    simpleFeedback,
    categories,
    overallConfidence: o.overallConfidence as 'low' | 'medium' | 'high',
    photoQuality: {
      level: pq.level as 'poor' | 'fair' | 'good',
      summary: pq.summary,
      issues: pq.issues as string[],
      tips: pq.tips as string[],
    },
    analysisSource,
    suggestedPaintingTitles,
    ...(cn === null ? { comparisonNote: null } : typeof cn === 'string' && cn.length > 0 ? { comparisonNote: cn } : {}),
    ...(pipeline ? { pipeline } : {}),
  };
}
