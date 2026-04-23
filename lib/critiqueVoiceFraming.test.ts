import { describe, expect, it } from 'vitest';

import {
  buildCriterionPrompt,
  PARALLEL_CRITERIA_SYSTEM_MESSAGE,
} from './critiqueParallelCriteria.js';
import {
  buildSynthesisPrompt,
  SYNTHESIS_SYSTEM_MESSAGE,
} from './critiqueSynthesisStage.js';
import type { CritiqueEvidenceDTO } from './critiqueTypes.js';
import type { CriterionWritingResult } from './critiqueParallelCriteria.js';
import { CRITERIA_ORDER } from '../shared/criteria.js';

/**
 * These tests pin the expert-panel framing and paragraph-shape guidance to
 * the live prompts that the three-stage pipeline actually sends to OpenAI.
 * The panel names + the reader framing already existed in
 * `shared/critiqueVoiceA.ts` but had drifted out of the live pipeline; if
 * that happens again the critic/teacher voice becomes generic and the
 * user-visible critique gets noticeably blander.
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

function minimalCriterionResultsFixture(): CriterionWritingResult[] {
  return CRITERIA_ORDER.map((criterion) => ({
    criterion,
    voiceACritique: 'placeholder critic paragraph for synthesis tests',
    voiceBSuggestions: 'placeholder teacher paragraph for synthesis tests',
    preserve: 'placeholder preserve line',
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

  it('teaches the Voice B four-beat shape (where → now → try → afterward)', () => {
    // Each beat label is normative — the user-visible teacher card is the
    // single most-read part of every critique, so this test is intentionally
    // load-bearing. If someone weakens the shape the test must fail.
    expect(sys).toMatch(/\*\*Where\.\*\*/);
    expect(sys).toMatch(/\*\*What is happening now\.\*\*/);
    expect(sys).toMatch(/\*\*What to try\.\*\*/);
    expect(sys).toMatch(/\*\*What you should see afterward\.\*\*/);
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
    evidence: minimalEvidenceFixture(),
  });

  it('targets one criterion at a time and carries its evidence', () => {
    expect(prompt).toMatch(/Value and light structure/);
    expect(prompt).toMatch(/Anchor.*the anchored passage for tests/s);
  });

  it('requires the Voice A paragraph to make a structural claim, not paraphrase evidence', () => {
    expect(prompt).toMatch(/ONE structural claim/);
    expect(prompt).toMatch(/Do not paraphrase the evidence neutrally/);
  });

  it('requires Voice B to follow the four-beat shape with one primary move', () => {
    expect(prompt).toMatch(/where → what now → what to try → what you should see/);
    expect(prompt).toMatch(/ONE primary move/);
  });

  it('threads the declared medium into the Voice B instruction so moves respect it', () => {
    // `buildCriterionPrompt` is given Oil on Canvas above; the prompt must
    // pass that through explicitly so the teacher does not prescribe
    // watercolor-shaped moves on oil.
    expect(prompt).toMatch(/Oil on Canvas/);
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
