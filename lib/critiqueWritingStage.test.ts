import { describe, expect, it } from 'vitest';

import {
  mergeVoiceStagesForTesting,
  normalizeKnownVoiceBVerbDrift,
  normalizeVoiceBMoveForSchema,
  repairVoiceAStageGrounding,
  synthesizeVoiceAStageFromEvidence,
  synthesizeVoiceBStageFromEvidence,
  synthesizeVoiceBSummaryFromCategories,
} from './critiqueWritingStage';
import { makeCritiqueEvidenceFixture, makeVoiceAStageFixture } from './critiqueTestFixtures';
import type { VoiceAStageResult, VoiceBStageResult } from './critiqueZodSchemas';
import {
  validateCritiqueGrounding,
  validateCritiqueResult,
  validateVoiceAStageOutput,
  validateVoiceBStageOutput,
  type CritiqueEvidenceDTO,
} from './critiqueValidation';

describe('normalizeKnownVoiceBVerbDrift', () => {
  it('rewrites generic color-transition enhancement into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      'Enhance color transitions for greater cohesion throughout the painting.',
      {
        criterion: 'Color relationships',
        anchor: { areaSummary: 'the muted color passages across the mourners' },
      }
    );

    expect(rewritten).toMatch(/^vary\b/i);
    expect(rewritten).toContain('the muted color passages across the mourners');
  });

  it('rewrites generic presence enhancement into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      'Enhance the distinctiveness of individual expressions for greater impact.',
      {
        criterion: 'Presence, point of view, and human force',
        anchor: { areaSummary: 'the varied expressions and postures of the figures' },
      }
    );

    expect(rewritten).toMatch(/^sharpen\b/i);
    expect(rewritten).toContain('the varied expressions and postures of the figures');
  });

  it('rewrites generic intent language into an anchored local move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      'Strengthen the sense of necessity in this passage so the image feels more intentional.',
      {
        criterion: 'Intent and necessity',
        anchor: { areaSummary: "the sun's reflection in the water" },
      }
    );

    expect(rewritten).toMatch(/^quiet\b/i);
    expect(rewritten).toContain("the sun's reflection in the water");
  });

  it('rewrites generic color-strengthening language into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      'Strengthen the relational discipline of colors in selective passages to enhance cohesion.',
      {
        criterion: 'Color relationships',
        anchor: { areaSummary: 'the muted color palette' },
      }
    );

    expect(rewritten).toMatch(/^vary\b/i);
    expect(rewritten).toContain('the muted color palette');
  });

  it('rewrites generic value-transition refinement into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      "Refine the transitions between the figures' clothing and the landscape to enhance separation.",
      {
        criterion: 'Value and light structure',
        anchor: { areaSummary: 'the contrast between the figures and the landscape' },
      }
    );

    expect(rewritten).toMatch(/^separate\b/i);
    expect(rewritten).toContain('the contrast between the figures and the landscape');
  });

  it('rewrites generic smooth-color-transition language into an allowed concrete move', () => {
    const rewritten = normalizeKnownVoiceBVerbDrift(
      "Smooth the color transitions in the mourners' clothing, particularly where the muted tones meet the red of the clergy's robes.",
      {
        criterion: 'Color relationships',
        anchor: { areaSummary: "the muted tones of the mourners' clothing" },
      }
    );

    expect(rewritten).toMatch(/^vary\b/i);
    expect(rewritten).toContain("the muted tones of the mourners' clothing");
  });
});

describe('normalizeVoiceBMoveForSchema', () => {
  it('falls back to a valid edge-control move when the model says clarify', () => {
    const rewritten = normalizeVoiceBMoveForSchema(
      'Clarify the edges between the figures and the background to enhance focus hierarchy.',
      {
        criterion: 'Edge and focus control',
        anchor: { areaSummary: 'the edges between the figures and the background' },
        level: 'Intermediate',
      }
    );

    expect(rewritten).toMatch(/^sharpen\b/i);
    expect(rewritten).toContain('the edges between the figures and the background');
  });

  it('falls back to a criterion-aware move when the starter verb is unsupported', () => {
    const rewritten = normalizeVoiceBMoveForSchema(
      'Emphasize the overlap between the front figures so the spacing feels firmer.',
      {
        criterion: 'Drawing, proportion, and spatial form',
        anchor: { areaSummary: 'the overlap between the front figures' },
        level: 'Advanced',
      }
    );

    expect(rewritten).toMatch(/^restate\b/i);
    expect(rewritten).toContain('the overlap between the front figures');
  });

  it('rewrites abstract focus language into a concrete edge relationship move', () => {
    const rewritten = normalizeVoiceBMoveForSchema(
      'Improve the focus hierarchy so the form reads more clearly.',
      {
        criterion: 'Edge and focus control',
        anchor: { areaSummary: 'the pale square against the off-white ground' },
        level: 'Intermediate',
      }
    );

    expect(rewritten).toMatch(/^sharpen\b/i);
    expect(rewritten).toContain('edge');
    expect(rewritten).toContain('the pale square against the off-white ground');
  });

  it('uses the anchored edge phrase directly when the anchor already names an edge relationship', () => {
    const rewritten = normalizeVoiceBMoveForSchema(
      'Clarify this area so the focus is stronger.',
      {
        criterion: 'Edge and focus control',
        anchor: { areaSummary: 'the shoulder edge against the dark wall' },
        level: 'Intermediate',
      }
    );

    expect(rewritten).toContain('the shoulder edge against the dark wall');
    expect(rewritten).toContain('losing a nearby edge');
  });

  it('injects an against-relationship when the anchor names adjacent shapes but not edge terms', () => {
    const rewritten = normalizeVoiceBMoveForSchema(
      'Improve clarity in this passage.',
      {
        criterion: 'Edge and focus control',
        anchor: { areaSummary: 'the pale square against the off-white ground' },
        level: 'Intermediate',
      }
    );

    expect(rewritten).toContain('the edge in the pale square against the off-white ground');
    expect(rewritten).toContain('losing a nearby edge');
  });
});

describe('repairVoiceAStageGrounding', () => {
  it('repairs drifted category evidence signals and analysis from anchored evidence', () => {
    const evidence = makeCritiqueEvidenceFixture();
    const voiceA = makeVoiceAStageFixture();
    voiceA.categories[6] = {
      ...voiceA.categories[6]!,
      phase2: {
        criticsAnalysis: 'The handling feels expressive overall.',
      },
      evidenceSignals: ['Good texture.', 'Interesting marks.'],
    };

    const repaired = repairVoiceAStageGrounding(voiceA, evidence);

    expect(repaired.salvagedCriteria).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: 'voice_a',
          criterion: 'Surface and medium handling',
        }),
      ])
    );
    expect(() => validateVoiceAStageOutput(repaired.voiceA, evidence)).not.toThrow();
    expect(repaired.voiceA.categories[6]?.evidenceSignals[0]).toContain(
      'wall hatching beside the smoother shirt'
    );
  });
});

describe('synthesizeVoiceAStageFromEvidence', () => {
  it('builds a grounded Voice A stage when model output is unavailable', () => {
    const evidence = makeCritiqueEvidenceFixture();

    const synthesized = synthesizeVoiceAStageFromEvidence('Realism', 'Oil on Canvas', evidence);

    expect(() => validateVoiceAStageOutput(synthesized.voiceA, evidence)).not.toThrow();
    expect(synthesized.salvagedCriteria).toHaveLength(8);
  });
});

describe('synthesizeVoiceBStageFromEvidence', () => {
  it('builds grounded Voice B teaching plans when model output is unavailable', () => {
    const evidence = makeCritiqueEvidenceFixture();
    const voiceA = synthesizeVoiceAStageFromEvidence('Realism', 'Oil on Canvas', evidence).voiceA;

    const synthesized = synthesizeVoiceBStageFromEvidence(evidence, voiceA);

    expect(() => validateVoiceBStageOutput(synthesized.voiceB, voiceA, evidence)).not.toThrow();
    expect(synthesized.salvagedCriteria).toHaveLength(8);
  });

  it('builds a full merged critique that passes final validation when both writing voices are synthesized', () => {
    const evidence = makeCritiqueEvidenceFixture();
    const voiceA = synthesizeVoiceAStageFromEvidence('Realism', 'Oil on Canvas', evidence).voiceA;
    const voiceB = synthesizeVoiceBStageFromEvidence(evidence, voiceA).voiceB;

    const merged = mergeVoiceStagesForTesting(voiceA, voiceB);
    const validated = validateCritiqueResult(merged);

    expect(() => validateCritiqueGrounding(validated, evidence)).not.toThrow();
  });
});

describe('synthesizeVoiceBSummaryFromCategories', () => {
  it('builds concrete fallback priorities and studio changes from grounded category plans', () => {
    const evidence = {
      intentHypothesis: 'The painting appears to organize the scene around the seated figure and the tree trunk.',
      strongestVisibleQualities: ['The seated figure against the tree trunk stays readable.'],
      mainTensions: ['The branch-sky edge stays busy in one area.'],
      completionRead: {
        state: 'likely_finished' as const,
        confidence: 'high' as const,
        cues: ['Consistent finish'],
        rationale: 'The work looks presentation-ready.',
      },
      photoQualityRead: {
        level: 'good' as const,
        summary: 'The photo is clear.',
        issues: [],
      },
      comparisonObservations: [],
      criterionEvidence: [
        {
          criterion: 'Edge and focus control' as const,
          observationPassageId: 'p1',
          anchor: 'the branch edge against the pale sky',
          visibleEvidence: [
            'The branch edge against the pale sky stays sharp at the fork, while the nearby branch edge softens into the cloud.',
            'The dark branch against the pale sky creates the strongest local edge contrast in the upper right.',
          ],
          strengthRead: 'The branch edge against the pale sky already carries the eye.',
          tensionRead: 'A nearby branch edge stays equally sharp and competes.',
          preserve: 'Preserve the strongest branch-sky edge contrast.',
          confidence: 'high' as const,
        },
        {
          criterion: 'Composition and shape structure' as const,
          observationPassageId: 'p2',
          anchor: 'the seated figure under the tree trunk',
          visibleEvidence: [
            'The seated figure under the tree trunk sits lower than the standing figure and leaves a wider rock band to the left.',
            'The tree trunk rises beside the seated figure and splits the sky from the rock mass.',
          ],
          strengthRead: 'The seated figure under the tree trunk gives the lower half a clear structural hold.',
          tensionRead: 'The standing figure and rock patch still compete with that hold.',
          preserve: 'Preserve the seated figure under the tree trunk as the main structural hold.',
          confidence: 'high' as const,
        },
      ],
    };

    const voiceA = {
      summary: 'summary',
      suggestedPaintingTitles: [],
      overallSummary: { analysis: 'analysis' },
      studioAnalysis: { whatWorks: 'works', whatCouldImprove: 'improve' },
      overallConfidence: 'high' as const,
      photoQuality: { level: 'good' as const, summary: 'clear', issues: [], tips: [] },
      categories: [
        {
          criterion: 'Edge and focus control' as const,
          level: 'Intermediate' as const,
          phase1: { visualInventory: 'inventory' },
          phase2: { criticsAnalysis: 'analysis' },
          confidence: 'high' as const,
          evidenceSignals: ['signal 1', 'signal 2'],
          preserve: 'Preserve the branch edge against the pale sky.',
          nextTarget: 'Push edge and focus control toward Advanced.',
          subskills: [],
        },
        {
          criterion: 'Composition and shape structure' as const,
          level: 'Beginner' as const,
          phase1: { visualInventory: 'inventory' },
          phase2: { criticsAnalysis: 'analysis' },
          confidence: 'high' as const,
          evidenceSignals: ['signal 1', 'signal 2'],
          preserve: 'Preserve the seated figure under the tree trunk.',
          nextTarget: 'Push composition and shape structure toward Intermediate.',
          subskills: [],
        },
      ],
    };

    const categories = [
      {
        criterion: 'Edge and focus control' as const,
        anchor: {
          areaSummary: 'the branch edge against the pale sky',
          evidencePointer: 'The branch edge against the pale sky stays sharp at the fork.',
          region: { x: 0.2, y: 0.1, width: 0.3, height: 0.2 },
        },
        plan: {
          currentRead: 'The branch edge against the pale sky stays sharp at the fork while the nearby branch edge softens into the cloud.',
          move: 'clarify the focus hierarchy in this passage.',
          expectedRead: 'the forked branch reads as the single strongest accent in that passage.',
          editability: 'yes' as const,
        },
        phase3: {
          teacherNextSteps: 'Improve focus in this area.',
        },
      },
      {
        criterion: 'Composition and shape structure' as const,
        anchor: {
          areaSummary: 'the seated figure under the tree trunk',
          evidencePointer: 'The seated figure under the tree trunk leaves a wider rock band to the left.',
          region: { x: 0.1, y: 0.4, width: 0.35, height: 0.28 },
        },
        plan: {
          currentRead: 'The seated figure under the tree trunk leaves a wider rock band to the left than to the right.',
          move: 'improve the composition.',
          expectedRead: 'the seated figure reads as the main lower anchor instead of competing with the standing figure.',
          editability: 'yes' as const,
        },
        phase3: {
          teacherNextSteps: 'Make the composition stronger.',
        },
      },
    ];

    const summary = synthesizeVoiceBSummaryFromCategories(
      evidence as CritiqueEvidenceDTO,
      voiceA as unknown as VoiceAStageResult,
      categories as unknown as VoiceBStageResult['categories']
    );

    expect(summary.overallSummary.topPriorities).toHaveLength(2);
    expect(summary.overallSummary.topPriorities[0]).toMatch(/^(group|sharpen)\b/i);
    expect(summary.studioChanges).toHaveLength(2);
    expect(summary.studioChanges[0]?.previewCriterion).toBe('Composition and shape structure');
    expect(summary.studioChanges[0]?.text).toContain('the seated figure under the tree trunk');
    expect(summary.studioChanges[1]?.previewCriterion).toBe('Edge and focus control');
    expect(summary.studioChanges[1]?.text).toContain('the branch edge against the pale sky');
    expect(summary.studioChanges[1]?.text).toContain('edge');
  });
});
