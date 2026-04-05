import { describe, expect, it } from 'vitest';

import { CritiqueRetryExhaustedError, CritiqueValidationError } from './critiqueErrors.js';
import {
  createFailedStageSnapshot,
  createStageAttempts,
  createSucceededStageSnapshot,
  stageIdFromErrorStage,
} from './critiquePipeline.js';

describe('critiquePipeline helpers', () => {
  it('maps final-stage failures to validation pipeline stage', () => {
    expect(stageIdFromErrorStage('final')).toBe('validation');
    expect(stageIdFromErrorStage('calibration')).toBe('calibration');
  });

  it('records failed evidence attempts before a later success', () => {
    const attempts = createStageAttempts({
      model: 'gpt-4o',
      failedAttempts: [
        {
          attempt: 1,
          error: 'Evidence stage validation failed.',
          details: ['Visible evidence is too generic for Intent and necessity'],
          repairNotePreview: 'Previous evidence attempt failed...',
        },
      ],
      successAttempt: 2,
    });

    expect(attempts).toEqual([
      {
        attempt: 1,
        status: 'failed',
        model: 'gpt-4o',
        error: 'Evidence stage validation failed.',
        details: ['Visible evidence is too generic for Intent and necessity'],
        repairNotePreview: 'Previous evidence attempt failed...',
      },
      {
        attempt: 2,
        status: 'succeeded',
        model: 'gpt-4o',
      },
    ]);
  });

  it('builds succeeded stage snapshots with attempt history only when needed', () => {
    expect(
      createSucceededStageSnapshot({
        stage: 'evidence',
        model: 'gpt-4o',
        successAttempt: 1,
      })
    ).toEqual({
      stage: 'evidence',
      status: 'succeeded',
      model: 'gpt-4o',
    });

    expect(
      createSucceededStageSnapshot({
        stage: 'evidence',
        model: 'gpt-4o',
        failedAttempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence is too generic for Intent and necessity'],
          },
        ],
        successAttempt: 2,
      })
    ).toEqual({
      stage: 'evidence',
      status: 'succeeded',
      model: 'gpt-4o',
      attempts: [
        {
          attempt: 1,
          status: 'failed',
          model: 'gpt-4o',
          error: 'Evidence stage validation failed.',
          details: ['Visible evidence is too generic for Intent and necessity'],
        },
        {
          attempt: 2,
          status: 'succeeded',
          model: 'gpt-4o',
        },
      ],
    });
  });

  it('builds failed snapshots from retry-exhausted errors with debug attempts', () => {
    const error = new CritiqueRetryExhaustedError('Evidence stage exhausted retries.', 3, {
      stage: 'evidence',
      details: ['Visible evidence does not support anchor for Intent and necessity'],
      debug: {
        attempts: [
          {
            attempt: 1,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence is too generic for Intent and necessity'],
            criterionEvidencePreview: [
              {
                criterion: 'Intent and necessity',
                anchor: 'the outdoor seating area',
                visibleEvidencePreview: ['The outdoor seating area suggests a lively cafe atmosphere.'],
              },
            ],
          },
          {
            attempt: 2,
            error: 'Evidence stage validation failed.',
            details: ['Visible evidence does not support anchor for Intent and necessity'],
            repairNotePreview: 'Previous evidence attempt failed...',
          },
        ],
      },
    });

    expect(createFailedStageSnapshot({ error, model: 'gpt-4o' })).toEqual({
      stage: 'evidence',
      status: 'failed',
      model: 'gpt-4o',
      attempts: [
        {
          attempt: 1,
          status: 'failed',
          model: 'gpt-4o',
          error: 'Evidence stage validation failed.',
          details: ['Visible evidence is too generic for Intent and necessity'],
          criterionEvidencePreview: [
            {
              criterion: 'Intent and necessity',
              anchor: 'the outdoor seating area',
              visibleEvidencePreview: ['The outdoor seating area suggests a lively cafe atmosphere.'],
            },
          ],
        },
        {
          attempt: 2,
          status: 'failed',
          model: 'gpt-4o',
          error: 'Evidence stage validation failed.',
          details: ['Visible evidence does not support anchor for Intent and necessity'],
          repairNotePreview: 'Previous evidence attempt failed...',
        },
      ],
    });
  });

  it('falls back to a single failed attempt when no debug history exists', () => {
    const error = new CritiqueValidationError('Calibration stage failed.', {
      stage: 'calibration',
      details: ['Empty calibration response'],
    });

    expect(createFailedStageSnapshot({ error, model: 'gpt-4o-mini' })).toEqual({
      stage: 'calibration',
      status: 'failed',
      model: 'gpt-4o-mini',
      attempts: [
        {
          attempt: 1,
          status: 'failed',
          model: 'gpt-4o-mini',
          error: 'Calibration stage failed.\n- Empty calibration response',
          details: ['Empty calibration response'],
        },
      ],
    });
  });
});
