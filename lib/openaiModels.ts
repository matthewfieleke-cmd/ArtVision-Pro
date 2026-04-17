export type OpenAIStageModelRole =
  | 'classification'
  | 'evidence'
  | 'voiceA'
  | 'voiceB'
  | 'validation'
  | 'clarity'
  | 'fallback'
  | 'imageEdit';

const DEFAULT_CHAT_MODEL = 'gpt-4o';
const DEFAULT_IMAGE_EDIT_MODEL = 'gpt-image-1.5';

type StageModelConfig = {
  role: OpenAIStageModelRole;
  envKeys: string[];
  fallback: string;
};

const STAGE_MODEL_CONFIG: Record<OpenAIStageModelRole, StageModelConfig> = {
  classification: {
    role: 'classification',
    envKeys: ['OPENAI_MODEL_CLASSIFY', 'OPENAI_MODEL'],
    fallback: DEFAULT_CHAT_MODEL,
  },
  evidence: {
    role: 'evidence',
    envKeys: ['OPENAI_MODEL_EVIDENCE', 'OPENAI_CRITIQUE_MODEL', 'OPENAI_MODEL'],
    fallback: DEFAULT_CHAT_MODEL,
  },
  voiceA: {
    role: 'voiceA',
    envKeys: ['OPENAI_MODEL_WRITE', 'OPENAI_CRITIQUE_MODEL', 'OPENAI_MODEL'],
    fallback: DEFAULT_CHAT_MODEL,
  },
  voiceB: {
    role: 'voiceB',
    envKeys: ['OPENAI_MODEL_WRITE', 'OPENAI_CRITIQUE_MODEL', 'OPENAI_MODEL'],
    fallback: DEFAULT_CHAT_MODEL,
  },
  validation: {
    role: 'validation',
    envKeys: ['OPENAI_MODEL_VALIDATE', 'OPENAI_CRITIQUE_MODEL', 'OPENAI_MODEL'],
    fallback: DEFAULT_CHAT_MODEL,
  },
  clarity: {
    role: 'clarity',
    envKeys: ['OPENAI_MODEL_CLARITY', 'OPENAI_MODEL'],
    fallback: 'gpt-4o-mini',
  },
  fallback: {
    role: 'fallback',
    envKeys: ['OPENAI_MODEL_FALLBACK', 'OPENAI_MODEL_VALIDATE', 'OPENAI_MODEL'],
    fallback: DEFAULT_CHAT_MODEL,
  },
  imageEdit: {
    role: 'imageEdit',
    envKeys: ['OPENAI_IMAGE_EDIT_MODEL'],
    fallback: DEFAULT_IMAGE_EDIT_MODEL,
  },
};

function readEnvModel(envKey: string): string | undefined {
  const raw = process.env[envKey]?.trim();
  return raw ? raw : undefined;
}

export function resolveOpenAIModel(role: OpenAIStageModelRole, override?: string): string {
  const directOverride = override?.trim();
  if (directOverride) return directOverride;

  const config = STAGE_MODEL_CONFIG[role];
  for (const envKey of config.envKeys) {
    const value = readEnvModel(envKey);
    if (value) return value;
  }

  return config.fallback;
}

/**
 * Returns true for model ids whose `max_completion_tokens` budget is shared
 * with invisible "reasoning tokens" (GPT-5 family, o1/o3/o4 reasoning models).
 * These models spend a large portion of the budget on internal chain-of-thought
 * before emitting any visible output, so a budget tuned for gpt-4o will
 * truncate them mid-response.
 */
function isReasoningCapableModel(model: string): boolean {
  const normalized = (model ?? '').trim().toLowerCase();
  return normalized.startsWith('gpt-5') || /^o\d/.test(normalized);
}

/**
 * OpenAI made two breaking changes for the GPT-5 family and o-series reasoning
 * models relative to gpt-4o:
 *
 *   1. The request parameter is renamed `max_tokens` → `max_completion_tokens`.
 *   2. `max_completion_tokens` is shared between invisible reasoning tokens and
 *      visible output tokens, so the same numeric budget yields far less
 *      visible JSON than gpt-4o would produce.
 *
 * This helper returns the correct key as a spreadable object AND scales the
 * numeric budget up for reasoning-capable models so stages stop truncating.
 * For gpt-4o / gpt-4-turbo / gpt-3.5, the returned value is byte-for-byte
 * identical to what the call sites used to send directly.
 *
 * Usage:
 *
 *   body: JSON.stringify({
 *     model,
 *     ...buildOpenAIMaxTokensParam(model, OBSERVATION_MAX_TOKENS),
 *     ...
 *   })
 *
 * The scaling multiplier is conservative: a 4x cap gives reasoning models
 * enough headroom for typical `medium` reasoning effort plus a full JSON
 * payload, while remaining a cap (not a target) that the model will not hit
 * on shorter responses.
 */
const REASONING_MODEL_TOKEN_MULTIPLIER = 4;

export function buildOpenAIMaxTokensParam(
  model: string,
  value: number
): { max_tokens: number } | { max_completion_tokens: number } {
  if (isReasoningCapableModel(model)) {
    return {
      max_completion_tokens: Math.ceil(value * REASONING_MODEL_TOKEN_MULTIPLIER),
    };
  }
  return { max_tokens: value };
}

export function getOpenAIStageModelMap(overrides?: Partial<Record<OpenAIStageModelRole, string>>) {
  return {
    classification: resolveOpenAIModel('classification', overrides?.classification),
    evidence: resolveOpenAIModel('evidence', overrides?.evidence),
    voiceA: resolveOpenAIModel('voiceA', overrides?.voiceA),
    voiceB: resolveOpenAIModel('voiceB', overrides?.voiceB),
    validation: resolveOpenAIModel('validation', overrides?.validation),
    clarity: resolveOpenAIModel('clarity', overrides?.clarity),
    fallback: resolveOpenAIModel('fallback', overrides?.fallback),
    imageEdit: resolveOpenAIModel('imageEdit', overrides?.imageEdit),
  };
}
