/**
 * Opt-in structured timing logs for the critique pipeline (Vercel / local API).
 * Set CRITIQUE_INSTRUMENT=true to emit one JSON line per sub-step plus a summary.
 */

export type CritiqueInstrumentStage = {
  stage: string;
  ms: number;
};

export type CritiqueMutationRecord = {
  category: 'normalization' | 'repair' | 'policyOverride';
  label: string;
};

export type CritiqueInstrumenter = {
  enabled: boolean;
  time<T>(stage: string, fn: () => Promise<T>): Promise<T>;
  record(stage: string, ms: number): void;
  recordMutation(category: CritiqueMutationRecord['category'], label: string): void;
  logSummary(extra?: Record<string, unknown>): void;
};

/** No overhead when instrumentation is off (does not record or log). */
export const noopCritiqueInstrumenter: CritiqueInstrumenter = {
  enabled: false,
  async time(_stage, fn) {
    return fn();
  },
  record() {},
  recordMutation() {},
  logSummary() {},
};

export function createCritiqueInstrumenter(enabled: boolean): CritiqueInstrumenter {
  const stages: CritiqueInstrumentStage[] = [];
  const mutations: CritiqueMutationRecord[] = [];

  return {
    enabled,

    async time<T>(stage: string, fn: () => Promise<T>): Promise<T> {
      if (!enabled) {
        return fn();
      }
      const t0 = Date.now();
      try {
        return await fn();
      } finally {
        const ms = Date.now() - t0;
        stages.push({ stage, ms });
        console.info(JSON.stringify({ type: 'critique_instrument', stage, ms }));
      }
    },

    record(stage: string, ms: number): void {
      if (!enabled) return;
      stages.push({ stage, ms });
      console.info(JSON.stringify({ type: 'critique_instrument', stage, ms }));
    },

    recordMutation(category: CritiqueMutationRecord['category'], label: string): void {
      if (!enabled) return;
      const mutation = { category, label };
      mutations.push(mutation);
      console.info(JSON.stringify({ type: 'critique_mutation', ...mutation }));
    },

    logSummary(extra?: Record<string, unknown>): void {
      if (!enabled || (stages.length === 0 && mutations.length === 0)) return;
      const totalMs = stages.reduce((sum, entry) => sum + entry.ms, 0);
      console.info(
        JSON.stringify({
          type: 'critique_instrument_summary',
          totalMs,
          stages,
          mutations,
          ...extra,
        })
      );
    },
  };
}

export function critiqueInstrumentEnabled(): boolean {
  return process.env.CRITIQUE_INSTRUMENT === 'true';
}
