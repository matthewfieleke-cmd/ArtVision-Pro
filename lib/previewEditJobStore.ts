import type { PreviewEditRequestBody, PreviewEditResponseBody } from './previewEditTypes.js';

type PreviewJobRecord = {
  promise: Promise<PreviewEditResponseBody>;
  result?: PreviewEditResponseBody;
  error?: Error;
  expiresAt: number;
};

const JOB_TTL_MS = 10 * 60 * 1000;
const jobs = new Map<string, PreviewJobRecord>();

function pruneExpiredJobs(now = Date.now()): void {
  for (const [key, record] of jobs) {
    if (record.expiresAt <= now) jobs.delete(key);
  }
}

function normalizedKey(body: PreviewEditRequestBody): string | null {
  const requestId = body.requestId?.trim();
  return requestId && requestId.length > 0 ? requestId : null;
}

async function runWithKey(
  key: string | null,
  runner: () => Promise<PreviewEditResponseBody>
): Promise<PreviewEditResponseBody> {
  pruneExpiredJobs();
  if (!key) return runner();

  const existing = jobs.get(key);
  if (existing) {
    if (existing.result) return existing.result;
    if (existing.error) throw existing.error;
    return existing.promise;
  }

  const promise = runner()
    .then((result) => {
      const record = jobs.get(key);
      if (record) {
        record.result = result;
        record.error = undefined;
        record.expiresAt = Date.now() + JOB_TTL_MS;
      }
      return result;
    })
    .catch((error: unknown) => {
      const err = error instanceof Error ? error : new Error('Preview edit failed');
      const record = jobs.get(key);
      if (record) {
        record.error = err;
        record.result = undefined;
        record.expiresAt = Date.now() + 60 * 1000;
      }
      throw err;
    });

  jobs.set(key, {
    promise,
    expiresAt: Date.now() + JOB_TTL_MS,
  });

  return promise;
}

export async function runPreviewEditWithDedup(
  body: PreviewEditRequestBody,
  runner: () => Promise<PreviewEditResponseBody>
): Promise<PreviewEditResponseBody> {
  return runWithKey(normalizedKey(body), runner);
}

export async function runPreviewEditJob(
  apiKey: string,
  body: PreviewEditRequestBody,
  runner: (apiKey: string, body: PreviewEditRequestBody) => Promise<PreviewEditResponseBody>
): Promise<PreviewEditResponseBody> {
  return runWithKey(normalizedKey(body), () => runner(apiKey, body));
}

export async function runOrReusePreviewJob(
  requestId: string | undefined,
  runner: () => Promise<PreviewEditResponseBody>
): Promise<PreviewEditResponseBody> {
  const key = requestId?.trim();
  return runWithKey(key && key.length > 0 ? key : null, runner);
}
