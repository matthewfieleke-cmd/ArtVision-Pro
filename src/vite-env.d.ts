/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CRITIQUE_API_URL?: string;
  /** Set to "true" to skip the API and use local heuristic only */
  readonly VITE_USE_LOCAL_CRITIQUE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
