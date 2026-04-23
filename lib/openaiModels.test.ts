import { afterEach, describe, expect, it } from 'vitest';

import {
  buildOpenAISamplingParam,
  getOpenAIStageModelMap,
  isReasoningCapableModel,
  resolveOpenAIModel,
} from './openaiModels.js';

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
  'OPENAI_REASONING_EFFORT',
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
    expect(resolveOpenAIModel('voiceB')).toBe('gpt-5.4');
    expect(resolveOpenAIModel('clarity')).toBe('gpt-5.4');
    expect(resolveOpenAIModel('imageEdit')).toBe('gpt-image-2');
  });
});

describe('isReasoningCapableModel', () => {
  it('recognises the gpt-5 reasoning family', () => {
    expect(isReasoningCapableModel('gpt-5')).toBe(true);
    expect(isReasoningCapableModel('gpt-5.4')).toBe(true);
    expect(isReasoningCapableModel('gpt-5-mini')).toBe(true);
    expect(isReasoningCapableModel('gpt-5-nano')).toBe(true);
  });

  it('recognises o-series reasoning models', () => {
    expect(isReasoningCapableModel('o1-preview')).toBe(true);
    expect(isReasoningCapableModel('o3-mini')).toBe(true);
    expect(isReasoningCapableModel('o4')).toBe(true);
  });

  it('treats gpt-5-chat-latest as a non-reasoning chat model', () => {
    // gpt-5-chat-latest still accepts `temperature` and rejects
    // `reasoning_effort`, so the helper must keep it on the chat-model path.
    expect(isReasoningCapableModel('gpt-5-chat-latest')).toBe(false);
  });

  it('returns false for gpt-4o / gpt-4-turbo / gpt-3.5', () => {
    expect(isReasoningCapableModel('gpt-4o')).toBe(false);
    expect(isReasoningCapableModel('gpt-4-turbo')).toBe(false);
    expect(isReasoningCapableModel('gpt-3.5-turbo')).toBe(false);
  });
});

describe('buildOpenAISamplingParam', () => {
  it('emits temperature for non-reasoning chat models', () => {
    expect(
      buildOpenAISamplingParam('gpt-4o', { temperature: 0.25, reasoningEffort: 'medium' })
    ).toEqual({ temperature: 0.25 });
    // gpt-5-chat-latest uses the chat-model sampling path too.
    expect(
      buildOpenAISamplingParam('gpt-5-chat-latest', { temperature: 0.2, reasoningEffort: 'high' })
    ).toEqual({ temperature: 0.2 });
  });

  it('omits temperature and emits reasoning_effort for reasoning models', () => {
    expect(
      buildOpenAISamplingParam('gpt-5.4', { temperature: 0.12, reasoningEffort: 'medium' })
    ).toEqual({ reasoning_effort: 'medium' });
    expect(
      buildOpenAISamplingParam('o3-mini', { temperature: 0.12, reasoningEffort: 'low' })
    ).toEqual({ reasoning_effort: 'low' });
  });

  it('omits reasoning_effort entirely when no effort is supplied for reasoning models', () => {
    // Some endpoints would reject `reasoning_effort: undefined`; the helper
    // must return an empty spread object, never `{ reasoning_effort:
    // undefined }`.
    expect(buildOpenAISamplingParam('gpt-5.4', { temperature: 0.12 })).toEqual({});
  });

  it('lets OPENAI_REASONING_EFFORT override the per-stage effort for reasoning models', () => {
    process.env.OPENAI_REASONING_EFFORT = 'low';
    expect(
      buildOpenAISamplingParam('gpt-5.4', { temperature: 0.12, reasoningEffort: 'high' })
    ).toEqual({ reasoning_effort: 'low' });
  });

  it('ignores an invalid OPENAI_REASONING_EFFORT override', () => {
    process.env.OPENAI_REASONING_EFFORT = 'banana';
    expect(
      buildOpenAISamplingParam('gpt-5.4', { temperature: 0.12, reasoningEffort: 'medium' })
    ).toEqual({ reasoning_effort: 'medium' });
  });

  it('does not emit reasoning_effort on non-reasoning models even when the env override is set', () => {
    process.env.OPENAI_REASONING_EFFORT = 'high';
    expect(
      buildOpenAISamplingParam('gpt-4o', { temperature: 0.25, reasoningEffort: 'medium' })
    ).toEqual({ temperature: 0.25 });
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
      imageEdit: 'gpt-image-2',
    });
  });
});
