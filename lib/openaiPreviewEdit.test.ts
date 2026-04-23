import { describe, expect, it } from 'vitest';

import {
  imageEditModelMaxNPerRequest,
  imageEditModelSupportsInputFidelity,
} from './openaiPreviewEdit.js';

describe('imageEditModelSupportsInputFidelity', () => {
  it('is true for gpt-image-1 family', () => {
    expect(imageEditModelSupportsInputFidelity('gpt-image-1')).toBe(true);
    expect(imageEditModelSupportsInputFidelity('gpt-image-1.5')).toBe(true);
    expect(imageEditModelSupportsInputFidelity('gpt-image-1-mini')).toBe(true);
  });

  it('is false for gpt-image-2', () => {
    expect(imageEditModelSupportsInputFidelity('gpt-image-2')).toBe(false);
  });

  it('is false for dall-e models', () => {
    expect(imageEditModelSupportsInputFidelity('dall-e-3')).toBe(false);
  });
});

describe('imageEditModelMaxNPerRequest', () => {
  it('caps gpt-image-2 at 1 candidate per request', () => {
    // gpt-image-2 rejects n > 1 with a 400; multi-candidate requires
    // parallel requests.
    expect(imageEditModelMaxNPerRequest('gpt-image-2')).toBe(1);
  });

  it('allows up to 4 candidates per request for gpt-image-1 family', () => {
    expect(imageEditModelMaxNPerRequest('gpt-image-1')).toBe(4);
    expect(imageEditModelMaxNPerRequest('gpt-image-1.5')).toBe(4);
    expect(imageEditModelMaxNPerRequest('gpt-image-1-mini')).toBe(4);
  });

  it('defaults to 4 candidates per request for unknown / legacy models', () => {
    expect(imageEditModelMaxNPerRequest('dall-e-3')).toBe(4);
  });
});
