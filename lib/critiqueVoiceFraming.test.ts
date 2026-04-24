import { describe, expect, it } from 'vitest';

import {
  buildCriterionPrompt,
  PARALLEL_CRITERIA_SYSTEM_MESSAGE,
  type CriterionWritingResult,
} from './critiqueParallelCriteria.js';
import {
  buildSynthesisPrompt,
  SYNTHESIS_SYSTEM_MESSAGE,
} from './critiqueSynthesisStage.js';
import type { CritiqueEvidenceDTO } from './critiqueTypes.js';
import type { ObservationBank } from './critiqueZodSchemas.js';
import { CRITERIA_ORDER } from '../shared/criteria.js';

/**
 * These tests pin the voice framing the three-stage pipeline sends to
 * OpenAI. The load-bearing invariants are:
 *   1. The composite-critic and composite-teacher panels are present and
 *      positioned as what the model NOTICES, not as a writing template.
 *   2. The reader is framed as a serious hobbyist / art student.
 *   3. The writing register is INSTRUCTIONAL — declarative + evaluative for
 *      Voice A, imperative for Voice B. Conversational tells ("let's",
 *      "you might", "try to") are explicitly banned.
 *   4. The Voice B four-beat shape is present.
 *   5. The framework is painting-agnostic: example passages span
 *      figurative, landscape, still life, and abstract / mark-level work.
 *
 * If any of these drift out of the live prompts, the critique voice
 * silently gets blander or narrower. The tests fail loudly so that doesn't
 * happen without someone updating this pin.
 */

function minimalEvidenceFixture(): CritiqueEvidenceDTO {
  const criterionEvidence = CRITERIA_ORDER.map((criterion) => ({
    criterion,
    observationPassageId: 'p1',
    anchor: 'the anchored passage for tests',
    visibleEvidence: ['a visible event in the anchored passage for tests'],
    strengthRead: 'the passage already carries the main read',
    tensionRead: 'nothing is urgently unresolved here',
    preserve: 'keep the passage as it is',
    confidence: 'medium' as const,
  }));
  return {
    intentHypothesis: 'the picture aims at a quiet interior read',
    strongestVisibleQualities: ['cohesive value world'],
    mainTensions: ['one slightly dominant edge'],
    completionRead: {
      state: 'likely_finished',
      confidence: 'medium',
      cues: ['consistent finish'],
      rationale: 'edges and corners read resolved',
    },
    photoQualityRead: { level: 'good', summary: 'clear phone shot', issues: [] },
    comparisonObservations: [],
    criterionEvidence,
  };
}

function minimalObservationBank(): ObservationBank {
  return {
    passages: [
      {
        id: 'p1',
        label: 'the jaw edge against the hair',
        role: 'edge',
        visibleFacts: [
          'the jaw edge against the hair loses its contour on the shadow side',
          'the jaw edge against the hair keeps a crisp contour on the lit side',
        ],
      },
      {
        id: 'p2',
        label: 'the bright cadmium strip where it meets the olive field',
        role: 'color',
        visibleFacts: [
          'the bright cadmium strip where it meets the olive field creates the strongest chroma jump in the image',
          'the bright cadmium strip where it meets the olive field is partially interrupted by a darker band at the top edge',
        ],
      },
    ],
    visibleEvents: [
      {
        passageId: 'p1',
        passage: 'the jaw edge against the hair',
        event: 'the jaw edge merges into the hair on the shadow side, flattening the forward plane',
        signalType: 'edge',
      },
      {
        passageId: 'p2',
        passage: 'the bright cadmium strip where it meets the olive field',
        event: 'the cadmium strip sits on top of the olive field and leaves a thin dark gap along the lower join',
        signalType: 'color',
      },
    ],
    mediumCues: [
      'broad opaque handling consistent with direct oil painting',
      'wet-into-wet softening visible along the shadow-side hair-to-jaw edge',
      'a small scraped-back correction is visible in the lower right',
    ],
    photoCaveats: [],
    intentCarriers: [
      {
        passageId: 'p1',
        passage: 'the jaw edge against the hair',
        reason: 'this passage carries the figure-to-ground decision the painting hinges on',
      },
      {
        passageId: 'p2',
        passage: 'the bright cadmium strip where it meets the olive field',
        reason: 'this passage carries the chromatic accent that organises the picture',
      },
    ],
  };
}

function minimalTopLevelContext() {
  return {
    intentHypothesis: 'a quiet portrait held together by one chromatic accent',
    strongestVisibleQualities: ['cohesive value world', 'one decisive chromatic accent'],
    mainTensions: ['the jaw-to-hair edge dissolves on the shadow side'],
  };
}

function minimalCriterionResultsFixture(): CriterionWritingResult[] {
  return CRITERIA_ORDER.map((criterion) => ({
    criterion,
    anchor: {
      areaSummary: 'the anchored passage for tests',
      evidencePointer: 'a visible event in the anchored passage for tests',
      region: { x: 0.2, y: 0.2, width: 0.35, height: 0.35 },
    },
    visibleEvidence: ['the anchored passage for tests carries the main read'],
    tensionRead: 'nothing is urgently unresolved here',
    voiceACritique: 'placeholder critic paragraph for synthesis tests',
    voiceBSuggestions: 'placeholder teacher paragraph for synthesis tests',
    preserve: 'placeholder preserve line',
    editPlan: {
      targetArea: 'the anchored passage for tests',
      preserveArea: 'the surrounding passages that are already working',
      issue: 'no unresolved issue — placeholder for tests',
      intendedChange: 'keep the anchored passage as it is',
      expectedOutcome: 'the passage continues to carry the main read',
      editability: 'no',
    },
    confidence: 'medium',
  }));
}

describe('parallel-criteria system message (Voice A + Voice B framing)', () => {
  const sys = PARALLEL_CRITERIA_SYSTEM_MESSAGE;

  it('names the Voice A composite-critic expert panel', () => {
    expect(sys).toMatch(/T\. J\. Clark/);
    expect(sys).toMatch(/Rosalind Krauss/);
    expect(sys).toMatch(/Alexander Nemerov/);
    expect(sys).toMatch(/Linda Nochlin/);
    expect(sys).toMatch(/Michael Fried/);
    expect(sys).toMatch(/John Berger/);
    expect(sys).toMatch(/Michael Baxandall/);
  });

  it('names the Voice B composite-teacher expert panel', () => {
    expect(sys).toMatch(/Jacob Collins/);
    expect(sys).toMatch(/Steven Assael/);
    expect(sys).toMatch(/Odd Nerdrum/);
    expect(sys).toMatch(/Peter Doig/);
  });

  it('frames the reader as a serious hobbyist / art student', () => {
    expect(sys).toMatch(/serious hobbyist|art student/i);
  });

  it('pins the INSTRUCTIONAL register and bans conversational tells', () => {
    // This is the load-bearing difference between the current voice
    // architecture and the earlier conversational one. If someone
    // re-softens the register to "friend at the easel", these tests must
    // fail loudly.
    expect(sys).toMatch(/INSTRUCTIONAL/);
    expect(sys).toMatch(/imperative/i);
    // Conversational phrases must appear as explicit bans, not as
    // recommended register.
    expect(sys).toMatch(/let's/i);
    expect(sys).toMatch(/you might/i);
    expect(sys).toMatch(/try to/i);
  });

  it('frames the expert panels as what to notice, not how to write', () => {
    // If a future edit re-elevates the panel framing, these must fail.
    expect(sys).toMatch(/what to notice/i);
    expect(sys).toMatch(/private (?:context|reasoning)/i);
  });

  it('teaches the Voice B four-beat shape (where → now → try → afterward)', () => {
    expect(sys).toMatch(/\*\*Where\.\*\*/);
    expect(sys).toMatch(/\*\*What is happening now\.\*\*/);
    expect(sys).toMatch(/\*\*What to try\.\*\*/);
    expect(sys).toMatch(/\*\*The visible result afterward\.\*\*/);
  });

  it('provides painting-agnostic example passages (figurative + landscape + still life + abstract)', () => {
    // If the examples drift back toward only figurative passages the
    // prompt silently biases the model's anchor choices across all
    // painting types. Pin at least two clearly non-figurative example
    // passages so the model always sees them in its scratchpad.
    expect(sys).toMatch(/cadmium strip|olive field/i);
    expect(sys).toMatch(/impasto cluster|band cutting/i);
  });

  it('forbids surfacing the expert-panel names in user-visible text', () => {
    expect(sys).toMatch(/never name .* critic|never name any critic/i);
    expect(sys).toMatch(/never name any teacher|never name .* teacher/i);
  });
});

describe('buildCriterionPrompt (per-criterion user prompt)', () => {
  const prompt = buildCriterionPrompt({
    criterion: 'Value and light structure',
    style: 'Impressionism',
    medium: 'Oil on Canvas',
    observationBank: minimalObservationBank(),
    topLevelContext: minimalTopLevelContext(),
  });

  it('targets one criterion at a time and carries the observation bank', () => {
    expect(prompt).toMatch(/Value and light structure/);
    expect(prompt).toMatch(/the jaw edge against the hair/);
    expect(prompt).toMatch(/the bright cadmium strip where it meets the olive field/);
  });

  it('asks the writer to own the anchor, region, and editPlan', () => {
    expect(prompt).toMatch(/Pick ONE anchor passage/);
    expect(prompt).toMatch(/normalized bounding box/i);
    expect(prompt).toMatch(/Emit editPlan/);
  });

  it('requires Voice A in the instructional register', () => {
    expect(prompt).toMatch(/Write Voice A \(critic\) — instructional register/);
  });

  it('requires Voice B in the instructional register with one primary move', () => {
    expect(prompt).toMatch(/Write Voice B \(teacher\) — instructional register/);
    expect(prompt).toMatch(/One primary move/);
  });

  it('threads the declared medium so moves respect it', () => {
    expect(prompt).toMatch(/Oil on Canvas/);
  });

  it('reminds the writer the framework is painting-agnostic', () => {
    expect(prompt).toMatch(/painting-agnostic/i);
  });

  it('keeps the no-names ban on the user prompt too (belt-and-braces)', () => {
    expect(prompt).toMatch(/Never name critics, teachers, artists/);
  });
});

describe('synthesis system message', () => {
  const sys = SYNTHESIS_SYSTEM_MESSAGE;

  it('retains the expert-panel framing so the voice matches the per-criterion stage', () => {
    expect(sys).toMatch(/T\. J\. Clark/);
    expect(sys).toMatch(/Jacob Collins/);
  });

  it('teaches the next-session priorities shape', () => {
    expect(sys).toMatch(/next-session plan|next session plan/i);
    expect(sys).toMatch(/Prioritise ruthlessly/);
  });

  it('frames the reader as a serious hobbyist / art student', () => {
    expect(sys).toMatch(/serious hobbyist|art student/i);
  });

  it('carries the instructional register through to synthesis', () => {
    expect(sys).toMatch(/INSTRUCTIONAL|instructional register/);
  });
});

describe('buildSynthesisPrompt', () => {
  const prompt = buildSynthesisPrompt({
    style: 'Realism',
    medium: 'Watercolor',
    evidence: minimalEvidenceFixture(),
    criterionResults: minimalCriterionResultsFixture(),
  });

  it('asks topPriorities to be a next-session plan, not a wish list', () => {
    expect(prompt).toMatch(/NEXT SESSION plan/);
    expect(prompt).toMatch(/not a list of aspirations/);
  });

  it('asks studioAnalysis.whatCouldImprove to name ONE primary problem', () => {
    expect(prompt).toMatch(/ONE primary structural problem/);
  });

  it('requires studioChanges to start with concrete studio verbs', () => {
    expect(prompt).toMatch(/starts with a concrete studio verb/);
  });
});
