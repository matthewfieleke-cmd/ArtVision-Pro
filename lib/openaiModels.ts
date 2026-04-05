export type OpenAIStageModelRole =
  | 'classification'
  | 'evidence'
  | 'calibration'
  | 'voiceA'
  | 'voiceB'
  | 'validation'
  | 'fallback'
  | 'imageEdit';

const DEFAULT_CHAT_MODEL = 'gpt-4o';
const DEFAULT_IMAGE_EDIT_MODEL = 'gpt-image-1';

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
  calibration: {
    role: 'calibration',
    envKeys: ['OPENAI_MODEL_CALIBRATION', 'OPENAI_CRITIQUE_MODEL', 'OPENAI_MODEL'],
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

export function getOpenAIStageModelMap(overrides?: Partial<Record<OpenAIStageModelRole, string>>) {
  return {
    classification: resolveOpenAIModel('classification', overrides?.classification),
    evidence: resolveOpenAIModel('evidence', overrides?.evidence),
    calibration: resolveOpenAIModel('calibration', overrides?.calibration),
    voiceA: resolveOpenAIModel('voiceA', overrides?.voiceA),
    voiceB: resolveOpenAIModel('voiceB', overrides?.voiceB),
    validation: resolveOpenAIModel('validation', overrides?.validation),
    fallback: resolveOpenAIModel('fallback', overrides?.fallback),
    imageEdit: resolveOpenAIModel('imageEdit', overrides?.imageEdit),
  };
}
