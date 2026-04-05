import { CRITERIA_ORDER, type CriterionLabel, type RatingLevelLabel } from '../shared/criteria.js';
import { createPipelineMetadata } from './critiquePipeline.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';
import type { CritiqueEvidenceDTO } from './critiqueValidation.js';

const LEVEL_ORDER: RatingLevelLabel[] = ['Beginner', 'Intermediate', 'Advanced', 'Master'];

function sentence(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function levelFromEvidence(entry: CritiqueEvidenceDTO['criterionEvidence'][number]): RatingLevelLabel {
  if (entry.confidence === 'high') return 'Intermediate';
  if (entry.confidence === 'medium') return 'Intermediate';
  return 'Beginner';
}

function nextLevel(level: RatingLevelLabel): RatingLevelLabel | null {
  const index = LEVEL_ORDER.indexOf(level);
  return index >= 0 && index < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[index + 1]! : null;
}

function summarizeAnchor(
  entry: CritiqueEvidenceDTO['criterionEvidence'][number]
): { areaSummary: string; evidencePointer: string; region: { x: number; y: number; width: number; height: number } } {
  return {
    areaSummary: entry.anchor,
    evidencePointer: entry.visibleEvidence[0] ?? entry.strengthRead,
    region: { x: 0.2, y: 0.2, width: 0.35, height: 0.35 },
  };
}

function moveVerbForCriterion(criterion: CriterionLabel): string {
  switch (criterion) {
    case 'Composition and shape structure':
      return 'group';
    case 'Value and light structure':
      return 'separate';
    case 'Color relationships':
      return 'vary';
    case 'Drawing, proportion, and spatial form':
      return 'restate';
    case 'Edge and focus control':
      return 'sharpen';
    case 'Surface and medium handling':
      return 'vary';
    case 'Intent and necessity':
      return 'quiet';
    case 'Presence, point of view, and human force':
      return 'sharpen';
  }
}

function buildFallbackMove(
  criterion: CriterionLabel,
  entry: CritiqueEvidenceDTO['criterionEvidence'][number]
): string {
  const verb = moveVerbForCriterion(criterion);
  if (criterion === 'Edge and focus control') {
    return `${verb} the clearest edge relationship in ${entry.anchor} while losing a nearby competing edge so the focus reads sooner`;
  }
  if (criterion === 'Intent and necessity') {
    return `${verb} the least necessary accent in ${entry.anchor} so that same passage carries the painting's intent more decisively`;
  }
  return `${verb} the key relationship in ${entry.anchor} so that passage reads more clearly on its own terms`;
}

function buildExpectedRead(
  criterion: CriterionLabel,
  entry: CritiqueEvidenceDTO['criterionEvidence'][number]
): string {
  switch (criterion) {
    case 'Composition and shape structure':
      return `the scaffold in ${entry.anchor} reads more clearly without breaking the larger arrangement`;
    case 'Value and light structure':
      return `the light-dark separation in ${entry.anchor} reads sooner without flattening the larger value scaffold`;
    case 'Color relationships':
      return `the color relationships in ${entry.anchor} stay cohesive without one accent jumping too hard`;
    case 'Drawing, proportion, and spatial form':
      return `the spatial read in ${entry.anchor} feels more convincing without disturbing the larger form`;
    case 'Edge and focus control':
      return `the focus hierarchy in ${entry.anchor} lands sooner without over-sharpening the whole picture`;
    case 'Surface and medium handling':
      return `the handling in ${entry.anchor} feels more controlled while staying true to the medium`;
    case 'Intent and necessity':
      return `the painting's intent reads more decisively through ${entry.anchor}`;
    case 'Presence, point of view, and human force':
      return `the human pressure in ${entry.anchor} reads more clearly without becoming overstated`;
  }
}

function buildFallbackCategory(
  entry: CritiqueEvidenceDTO['criterionEvidence'][number]
): CritiqueResultDTO['categories'][number] {
  const level = levelFromEvidence(entry);
  const anchor = summarizeAnchor(entry);
  const move = buildFallbackMove(entry.criterion, entry);
  const expectedRead = buildExpectedRead(entry.criterion, entry);
  const preserve = entry.preserve;
  const moveSentence = sentence(move);
  const expectedReadSentence = sentence(expectedRead);
  const currentReadSentence = sentence(entry.tensionRead);
  const strengthSentence = sentence(entry.strengthRead);

  return {
    criterion: entry.criterion,
    level,
    phase1: {
      visualInventory: sentence(entry.visibleEvidence.join(' ')),
    },
    phase2: {
      criticsAnalysis: sentence(
        `${entry.strengthRead} ${entry.tensionRead} That keeps ${entry.criterion.toLowerCase()} in the ${level} band on the current evidence.`
      ),
    },
    phase3: {
      teacherNextSteps: sentence(
        `In ${anchor.areaSummary}, ${entry.tensionRead.replace(/[.!?]+$/, '')}—${move} so that ${expectedRead}`
      ),
    },
    confidence: entry.confidence,
    evidenceSignals: entry.visibleEvidence.slice(0, 2).map((line) => sentence(line)),
    preserve,
    nextTarget: nextLevel(level)
      ? `Push ${entry.criterion.toLowerCase()} toward ${nextLevel(level)}.`
      : `Preserve the current ${entry.criterion.toLowerCase()} authority.`,
    anchor,
    plan: {
      currentRead: currentReadSentence,
      move: moveSentence,
      expectedRead: expectedReadSentence,
      preserve,
      editability: level === 'Master' ? 'no' : 'yes',
    },
    editPlan: {
      targetArea: anchor.areaSummary,
      preserveArea: preserve,
      issue: currentReadSentence,
      intendedChange: moveSentence,
      expectedOutcome: expectedReadSentence,
      editability: level === 'Master' ? 'no' : 'yes',
    },
    voiceBPlan: {
      currentRead: currentReadSentence,
      mainProblem: currentReadSentence,
      mainStrength: strengthSentence,
      bestNextMove: moveSentence,
      optionalSecondMove: '',
      avoidDoing: '',
      expectedRead: expectedReadSentence,
      storyIfRelevant: '',
    },
    actionPlanSteps: [
      {
        area: anchor.areaSummary,
        currentRead: currentReadSentence,
        move: moveSentence,
        expectedRead: expectedReadSentence,
        preserve,
        priority: 'primary',
      },
    ],
    subskills: [
      {
        label: 'Visible evidence support',
        score: entry.confidence === 'high' ? 0.6 : entry.confidence === 'medium' ? 0.5 : 0.4,
        level,
      },
      {
        label: 'Criterion control',
        score: entry.confidence === 'high' ? 0.58 : entry.confidence === 'medium' ? 0.48 : 0.38,
        level,
      },
    ],
  };
}

function buildSummaryFromEvidence(evidence: CritiqueEvidenceDTO): string {
  return sentence(
    `${evidence.intentHypothesis} Strongest visible qualities include ${evidence.strongestVisibleQualities
      .slice(0, 2)
      .join(' and ')}, while the main tensions remain ${evidence.mainTensions.slice(0, 2).join(' and ')}`
  );
}

export function composeFallbackCritique(args: {
  style: string;
  medium: string;
  evidence: CritiqueEvidenceDTO;
  paintingTitle?: string;
  comparisonNote?: string;
  failureStage: string;
}): CritiqueResultDTO {
  const categories = CRITERIA_ORDER.map((criterion) => {
    const entry = args.evidence.criterionEvidence.find((item) => item.criterion === criterion);
    if (!entry) {
      throw new Error(`Missing evidence for ${criterion}`);
    }
    return buildFallbackCategory(entry);
  });

  const topPriorities = categories
    .slice()
    .sort((a, b) => LEVEL_ORDER.indexOf(a.level!) - LEVEL_ORDER.indexOf(b.level!))
    .slice(0, 2)
    .map((category) => category.phase3.teacherNextSteps);
  const studioAnalysis = {
    whatWorks: sentence(args.evidence.strongestVisibleQualities.join(' ')),
    whatCouldImprove: sentence(args.evidence.mainTensions.join(' ')),
  };
  const studioChanges = topPriorities.map((text, index) => ({
    text,
    previewCriterion: categories[index]?.criterion ?? categories[0]!.criterion,
  }));

  const critique: CritiqueResultDTO & {
    studioAnalysis: {
      whatWorks: string;
      whatCouldImprove: string;
    };
    studioChanges: Array<{
      text: string;
      previewCriterion: CriterionLabel;
    }>;
  } = {
    summary: buildSummaryFromEvidence(args.evidence),
    overallSummary: {
      analysis: sentence(
        `Using the declared ${args.style} and ${args.medium} lens, this fallback critique stays grounded in the evidence stage and focuses on the clearest visible strengths and tensions.`
      ),
      topPriorities,
    },
    simpleFeedback: {
      studioAnalysis,
      studioChanges,
    },
    studioAnalysis,
    studioChanges,
    comparisonNote: args.comparisonNote ?? null,
    categories,
    overallConfidence: args.evidence.photoQualityRead.level === 'good' ? 'medium' : 'low',
    photoQuality: {
      level: args.evidence.photoQualityRead.level,
      summary: args.evidence.photoQualityRead.summary,
      issues: args.evidence.photoQualityRead.issues,
      tips:
        args.evidence.photoQualityRead.level === 'good'
          ? []
          : ['Retake the photo in even light with the full painting square to the camera.'],
    },
    completionRead: args.evidence.completionRead,
    suggestedPaintingTitles: [
      {
        category: 'formalist',
        title: titleCase(`${args.style} Structure Study`),
        rationale: sentence('The title reflects the most visible structural relationships identified in the fallback evidence review.'),
      },
      {
        category: 'tactile',
        title: titleCase(`${args.medium} Surface Study`),
        rationale: sentence('The title names the medium and handling focus preserved in the fallback critique.'),
      },
      {
        category: 'intent',
        title: titleCase('Withheld Interior'),
        rationale: sentence('The title reflects the strongest intent-level read available from the visible evidence alone.'),
      },
    ],
    analysisSource: 'fallback',
    pipeline: createPipelineMetadata({
      resultTier: 'validated_reduced',
      completedWithFallback: true,
      stages: {
        evidence: {
          stage: 'evidence',
          status: 'succeeded',
        },
        fallback: {
          stage: 'fallback',
          status: 'fallback_succeeded',
          promptVersion: `fallback-after-${args.failureStage}`,
        },
      },
    }),
    ...(args.paintingTitle ? { paintingTitle: args.paintingTitle } : {}),
  };

  return critique;
}
