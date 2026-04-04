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
  GROUNDING_TOKEN_STOPWORDS,
  GENERIC_ANCHOR_PATTERNS,
  isGenericTeacherText,
  normalizeWhitespace,
} from './critiqueTextRules.js';
import type {
  VoiceAStageResult,
  VoiceBStageResult,
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
    anchor: string;
    visibleEvidence: string[];
    strengthRead: string;
    tensionRead: string;
    preserve: string;
    confidence: 'low' | 'medium' | 'high';
  }>;
};

function normalizeForComparison(text: string): string {
  return normalizeWhitespace(text).toLowerCase().replace(/[^\w\s]/g, ' ');
}

/**
 * Tokens for anchor overlap and evidence grounding. Min length 3 so short pictorial
 * words (sky, wet, sea, hull, mast, rim) count; grammar stripped via GROUNDING_TOKEN_STOPWORDS.
 */
function contentTokens(text: string): string[] {
  return Array.from(
    new Set(
      normalizeForComparison(text)
        .split(/\s+/)
        .filter((token) => token.length >= 3 && !GROUNDING_TOKEN_STOPWORDS.has(token))
    )
  );
}

function sharedTokenCount(a: string, b: string): number {
  const bTokens = new Set(contentTokens(b));
  return contentTokens(a).filter((token) => bTokens.has(token)).length;
}

function sharesConcreteLanguage(a: string, b: string, minimum: number = 2): boolean {
  return sharedTokenCount(a, b) >= minimum;
}

function isConcreteAnchor(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (normalized.length < 8) return false;
  if (GENERIC_ANCHOR_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  return contentTokens(normalized).length >= 2;
}

export function tracesToVisibleEvidence(
  text: string,
  evidence: CritiqueEvidenceDTO['criterionEvidence'][number]
): boolean {
  if (!normalizeWhitespace(text)) return false;
  if (sharesConcreteLanguage(text, evidence.anchor, 2)) return true;
  return evidence.visibleEvidence.some((line) => sharesConcreteLanguage(text, line, 2));
}

function tokenOverlapRatio(a: string, b: string): number {
  const aTokens = contentTokens(a);
  const bTokens = contentTokens(b);
  if (aTokens.length === 0 || bTokens.length === 0) return 0;
  const bSet = new Set(bTokens);
  const matches = aTokens.filter((token) => bSet.has(token)).length;
  return matches / Math.max(aTokens.length, bTokens.length);
}

function sameAdvice(a: string, b: string): boolean {
  const normalizedA = normalizeWhitespace(a).toLowerCase();
  const normalizedB = normalizeWhitespace(b).toLowerCase();
  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  return tokenOverlapRatio(normalizedA, normalizedB) >= 0.72;
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

export function validateEvidenceResult(raw: unknown): CritiqueEvidenceDTO {
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
    const anchor = r.anchor.trim();
    if (!isConcreteAnchor(anchor)) {
      throw new Error(`Invalid evidence anchor for ${expected}`);
    }
    if (!r.visibleEvidence.some((line) => sharesConcreteLanguage(line, anchor, 2))) {
      throw new Error(`Visible evidence does not support anchor for ${expected}`);
    }
    return {
      criterion: expected,
      anchor,
      visibleEvidence: r.visibleEvidence as string[],
      strengthRead: r.strengthRead,
      tensionRead: r.tensionRead,
      preserve: r.preserve,
      confidence: r.confidence as 'low' | 'medium' | 'high',
    };
  });

  return {
    intentHypothesis: o.intentHypothesis,
    strongestVisibleQualities: o.strongestVisibleQualities as string[],
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
    comparisonObservations: o.comparisonObservations as string[],
    criterionEvidence: normalized,
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

  if (countTraceableCriteria(voiceA.summary, evidence) < 1) {
    details.push('Voice A summary is not traceable to any evidence anchor.');
  }
  if (countTraceableCriteria(voiceA.overallSummary.analysis, evidence) < 2) {
    details.push('Voice A overall summary is not grounded in at least two criterion anchors.');
  }
  if (countTraceableCriteria(voiceA.studioAnalysis.whatWorks, evidence) < 1) {
    details.push('Voice A whatWorks paragraph is not grounded in visible evidence.');
  }
  if (countTraceableCriteria(voiceA.studioAnalysis.whatCouldImprove, evidence) < 1) {
    details.push('Voice A whatCouldImprove paragraph is not grounded in visible evidence.');
  }

  for (const category of voiceA.categories) {
    const criterion = category.criterion as CriterionLabel;
    const criterionEvidence = evidenceForCriterion(evidence, criterion);
    if (!tracesToVisibleEvidence(category.phase1.visualInventory, criterionEvidence)) {
      details.push(`${criterion}: phase1.visualInventory drifted from the evidence anchor.`);
    }
    if (!tracesToVisibleEvidence(category.phase2.criticsAnalysis, criterionEvidence)) {
      details.push(`${criterion}: phase2.criticsAnalysis is not traceable to visibleEvidence.`);
    }
    if (!category.evidenceSignals.every((signal) => tracesToVisibleEvidence(signal, criterionEvidence))) {
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

  for (const category of voiceB.categories) {
    const criterion = category.criterion as CriterionLabel;
    const criterionEvidence = evidenceForCriterion(evidence, criterion);
    const level = levelsByCriterion.get(criterion);
    const step = category.actionPlanSteps[0];

    if (!sharesConcreteLanguage(category.anchor.areaSummary, criterionEvidence.anchor, 2)) {
      details.push(`${criterion}: anchor.areaSummary drifted from the evidence-stage anchor.`);
    }
    if (!tracesToVisibleEvidence(category.anchor.evidencePointer, criterionEvidence)) {
      details.push(`${criterion}: anchor.evidencePointer is not traceable to visibleEvidence.`);
    }
    if (!tracesToVisibleEvidence(category.phase3.teacherNextSteps, criterionEvidence)) {
      details.push(`${criterion}: teacherNextSteps is not traceable to the evidence anchor.`);
    }
    if (!tracesToVisibleEvidence(step.area, criterionEvidence)) {
      details.push(`${criterion}: actionPlanSteps[0].area drifted from the evidence anchor.`);
    }
    if (!tracesToVisibleEvidence(step.currentRead, criterionEvidence)) {
      details.push(`${criterion}: actionPlanSteps[0].currentRead is not traceable to visibleEvidence.`);
    }
    if (!tracesToVisibleEvidence(category.editPlan.issue, criterionEvidence)) {
      details.push(`${criterion}: editPlan.issue is not traceable to visibleEvidence.`);
    }
    if (!sharesConcreteLanguage(category.editPlan.targetArea, category.anchor.areaSummary, 2)) {
      details.push(`${criterion}: editPlan.targetArea does not match the anchored passage.`);
    }
    if (!sharesConcreteLanguage(step.area, category.anchor.areaSummary, 2)) {
      details.push(`${criterion}: actionPlanSteps[0].area does not match the anchored passage.`);
    }
    if (isGenericTeacherText(category.phase3.teacherNextSteps)) {
      details.push(`${criterion}: teacherNextSteps still contains generic coaching.`);
    }
    if (isGenericTeacherText(step.move) || isGenericTeacherText(category.voiceBPlan.bestNextMove)) {
      details.push(`${criterion}: the main teaching move is still generic.`);
    }

    if (level === 'Master') {
      if (!CRITIQUE_DONT_CHANGE_PATTERN.test(category.phase3.teacherNextSteps)) {
        details.push(`${criterion}: Master guidance must begin with "Don't change a thing."`);
      }
      if (!CRITIQUE_PRESERVE_VERB_PATTERN.test(step.move)) {
        details.push(`${criterion}: Master actionPlanSteps[0].move must be preserve-only.`);
      }
      if (!CRITIQUE_PRESERVE_VERB_PATTERN.test(category.voiceBPlan.bestNextMove)) {
        details.push(`${criterion}: Master voiceBPlan.bestNextMove must be preserve-only.`);
      }
      if (!CRITIQUE_PRESERVE_VERB_PATTERN.test(category.editPlan.intendedChange)) {
        details.push(`${criterion}: Master editPlan.intendedChange must be preserve-only.`);
      }
      if (CRITIQUE_CHANGE_VERB_PATTERN.test(step.move)) {
        details.push(`${criterion}: Master guidance must be preserve-only, not a change instruction.`);
      }
      if (CRITIQUE_CHANGE_VERB_PATTERN.test(category.voiceBPlan.bestNextMove)) {
        details.push(`${criterion}: Master voiceBPlan.bestNextMove cannot be a change instruction.`);
      }
      if (CRITIQUE_CHANGE_VERB_PATTERN.test(category.editPlan.intendedChange)) {
        details.push(`${criterion}: Master editPlan.intendedChange cannot be a change instruction.`);
      }
      if (category.editPlan.editability !== 'no') {
        details.push(`${criterion}: Master editPlan.editability must be "no".`);
      }
    } else {
      if (CRITIQUE_DONT_CHANGE_PATTERN.test(category.phase3.teacherNextSteps)) {
        details.push(`${criterion}: non-Master guidance cannot use "Don't change a thing."`);
      }
      if (!CRITIQUE_CHANGE_VERB_PATTERN.test(step.move) || CRITIQUE_PRESERVE_VERB_PATTERN.test(step.move)) {
        details.push(`${criterion}: non-Master actionPlanSteps[0].move must be a true change instruction.`);
      }
      if (!CRITIQUE_CHANGE_VERB_PATTERN.test(category.voiceBPlan.bestNextMove) || CRITIQUE_PRESERVE_VERB_PATTERN.test(category.voiceBPlan.bestNextMove)) {
        details.push(`${criterion}: non-Master voiceBPlan.bestNextMove must be a true change instruction.`);
      }
      if (!CRITIQUE_CHANGE_VERB_PATTERN.test(category.editPlan.intendedChange) || CRITIQUE_PRESERVE_VERB_PATTERN.test(category.editPlan.intendedChange)) {
        details.push(`${criterion}: non-Master editPlan.intendedChange must be a true change instruction.`);
      }
      if (category.editPlan.editability !== 'yes') {
        details.push(`${criterion}: non-Master editPlan.editability must be "yes".`);
      }
    }
  }

  for (let i = 0; i < voiceB.categories.length; i++) {
    const current = voiceB.categories[i]!;
    for (let j = i + 1; j < voiceB.categories.length; j++) {
      const other = voiceB.categories[j]!;
      const currentAdvice = `${current.actionPlanSteps[0]!.area} ${current.actionPlanSteps[0]!.move} ${current.phase3.teacherNextSteps}`;
      const otherAdvice = `${other.actionPlanSteps[0]!.area} ${other.actionPlanSteps[0]!.move} ${other.phase3.teacherNextSteps}`;
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
  return voiceB;
}

export function validateCritiqueGrounding(
  critique: CritiqueResultDTO,
  evidence: CritiqueEvidenceDTO
): CritiqueResultDTO {
  const details: string[] = [];

  for (const category of critique.categories) {
    const criterionEvidence = evidenceForCriterion(evidence, category.criterion);
    const anchor = category.anchor;
    const editPlan = category.editPlan;
    if (!anchor || !editPlan) {
      details.push(`${category.criterion}: final category is missing anchor or edit plan data.`);
      continue;
    }
    if (!sharesConcreteLanguage(anchor.areaSummary, criterionEvidence.anchor, 2)) {
      details.push(`${category.criterion}: final anchor drifted from the evidence-stage anchor.`);
    }
    if (!tracesToVisibleEvidence(category.phase2.criticsAnalysis, criterionEvidence)) {
      details.push(`${category.criterion}: final critic analysis is not traceable to visibleEvidence.`);
    }
    if (!tracesToVisibleEvidence(category.phase3.teacherNextSteps, criterionEvidence)) {
      details.push(`${category.criterion}: final teacher guidance is not traceable to visibleEvidence.`);
    }
    if (!tracesToVisibleEvidence(editPlan.issue, criterionEvidence)) {
      details.push(`${category.criterion}: final editPlan.issue is not traceable to visibleEvidence.`);
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
    const editPlan = validateEditPlan(r.editPlan, expected);
    const voiceBPlan = validateVoiceBPlan(r.voiceBPlan, expected);
    const actionPlanSteps = validateVoiceBSteps(r.actionPlanSteps, expected);
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
    return {
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
      editPlan,
      voiceBPlan,
      actionPlanSteps,
      subskills,
    };
  });
  const cn = o.comparisonNote;
  if (cn !== null && (typeof cn !== 'string' || cn.length === 0)) {
    throw new Error('Invalid comparisonNote');
  }
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
    analysisSource: 'api',
    suggestedPaintingTitles,
    ...(typeof cn === 'string' && cn.length > 0 ? { comparisonNote: cn } : {}),
  };
}
