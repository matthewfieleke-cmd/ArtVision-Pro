export type OpenAIStageModelRole =
  | 'classification'
  | 'evidence'
  | 'voiceA'
  | 'voiceB'
  | 'validation'
  | 'clarity'
  | 'fallback'
  | 'imageEdit';

const DEFAULT_CHAT_MODEL = 'gpt-5.4';
const DEFAULT_IMAGE_EDIT_MODEL = 'gpt-image-2';

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
    fallback: DEFAULT_CHAT_MODEL,
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
 * before emitting any visible output, so a completion budget sized for
 * non-reasoning chat models can truncate them mid-response.
 */
export function isReasoningCapableModel(model: string): boolean {
  const normalized = (model ?? '').trim().toLowerCase();
  // gpt-5-chat-latest still behaves like a non-reasoning chat model and
  // accepts `temperature`; everything else in the gpt-5 family (gpt-5,
  // gpt-5.1, gpt-5.4, gpt-5-mini, gpt-5-nano, …) rejects custom temperature
  // and exposes `reasoning_effort` instead.
  if (normalized.startsWith('gpt-5-chat')) return false;
  return normalized.startsWith('gpt-5') || /^o\d/.test(normalized);
}

/**
 * Reasoning-capable models on the Chat Completions API (gpt-5 family, o-series)
 * do two things differently from the gpt-4o-era chat models:
 *
 *   1. They **reject** any non-default `temperature` (and `top_p`) value with a
 *      `400 invalid_request_error`. The only legal value is the implicit
 *      default of 1, so the field must be **omitted entirely**.
 *   2. They expose `reasoning_effort` (`low` | `medium` | `high`) as the
 *      primary quality/cost/latency knob, replacing the sampling knobs.
 *
 * `buildOpenAISamplingParam` returns the correct spreadable object for a given
 * model + desired temperature + desired reasoning effort:
 *
 *   - For non-reasoning chat models (gpt-4o, gpt-4-turbo, gpt-3.5, and
 *     `gpt-5-chat-latest`), it returns `{ temperature }`. `reasoning_effort`
 *     is dropped because those endpoints reject it.
 *   - For reasoning-capable models, it returns
 *     `{ reasoning_effort }` and **does not send `temperature`**, which is
 *     what these models require.
 *
 * The `reasoningEffort` argument lets each stage pick a level that matches its
 * job (e.g. vision-evidence and synthesis want `medium`; quick classifier
 * calls want `low`), with a global `OPENAI_REASONING_EFFORT` override for
 * operators who want to tune cost/latency globally.
 */
export type OpenAIReasoningEffort = 'low' | 'medium' | 'high';

const REASONING_EFFORT_VALUES: readonly OpenAIReasoningEffort[] = ['low', 'medium', 'high'];

function isReasoningEffort(value: string): value is OpenAIReasoningEffort {
  return (REASONING_EFFORT_VALUES as readonly string[]).includes(value);
}

function readGlobalReasoningEffortOverride(): OpenAIReasoningEffort | undefined {
  const raw = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  if (!raw) return undefined;
  return isReasoningEffort(raw) ? raw : undefined;
}

export function buildOpenAISamplingParam(
  model: string,
  options: { temperature: number; reasoningEffort?: OpenAIReasoningEffort }
):
  | { temperature: number }
  | { reasoning_effort: OpenAIReasoningEffort }
  | Record<string, never> {
  if (isReasoningCapableModel(model)) {
    const effort = readGlobalReasoningEffortOverride() ?? options.reasoningEffort;
    return effort ? { reasoning_effort: effort } : {};
  }
  return { temperature: options.temperature };
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
