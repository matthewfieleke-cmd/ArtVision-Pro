import { afterEach, describe, expect, it } from 'vitest';

import { getOpenAIStageModelMap, resolveOpenAIModel } from './openaiModels.js';

const ENV_KEYS = [
  'OPENAI_MODEL',
  'OPENAI_CRITIQUE_MODEL',
  'OPENAI_MODEL_CLASSIFY',
  'OPENAI_MODEL_EVIDENCE',
  'OPENAI_MODEL_CALIBRATION',
  'OPENAI_MODEL_WRITE',
  'OPENAI_MODEL_VALIDATE',
  'OPENAI_MODEL_CLARITY',
  'OPENAI_MODEL_FALLBACK',
  'OPENAI_IMAGE_EDIT_MODEL',
] as const;

const ORIGINAL_ENV = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function resetEnv(): void {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key];
    if (original === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = original;
    }
  }
}

afterEach(() => {
  resetEnv();
});

describe('resolveOpenAIModel', () => {
  it('prefers a direct override over environment variables', () => {
    process.env.OPENAI_MODEL_WRITE = 'env-write-model';

    expect(resolveOpenAIModel('voiceA', 'override-model')).toBe('override-model');
  });

  it('uses stage-specific critique env vars before critique or shared fallbacks', () => {
    process.env.OPENAI_MODEL = 'shared-model';
    process.env.OPENAI_CRITIQUE_MODEL = 'critique-model';
    process.env.OPENAI_MODEL_EVIDENCE = 'evidence-model';

    expect(resolveOpenAIModel('evidence')).toBe('evidence-model');
  });

  it('uses the shared model for classification when no stage-specific override exists', () => {
    process.env.OPENAI_MODEL = 'shared-model';

    expect(resolveOpenAIModel('classification')).toBe('shared-model');
  });

  it('falls back to built-in defaults when no env vars are set', () => {
    expect(resolveOpenAIModel('voiceB')).toBe('gpt-4o');
    expect(resolveOpenAIModel('clarity')).toBe('gpt-4o-mini');
    expect(resolveOpenAIModel('imageEdit')).toBe('gpt-image-1.5');
  });
});

describe('getOpenAIStageModelMap', () => {
  it('returns a complete stage map with per-stage fallbacks', () => {
    process.env.OPENAI_MODEL = 'shared-model';
    process.env.OPENAI_CRITIQUE_MODEL = 'critique-model';
    process.env.OPENAI_MODEL_WRITE = 'writer-model';

    expect(getOpenAIStageModelMap()).toEqual({
      classification: 'shared-model',
      evidence: 'critique-model',
      voiceA: 'writer-model',
      voiceB: 'writer-model',
      validation: 'critique-model',
      clarity: 'shared-model',
      fallback: 'shared-model',
      imageEdit: 'gpt-image-1.5',
    });
  });
});
