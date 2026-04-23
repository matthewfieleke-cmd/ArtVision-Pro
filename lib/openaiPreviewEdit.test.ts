import { describe, expect, it } from 'vitest';

import { imageEditModelSupportsInputFidelity } from './openaiPreviewEdit.js';

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
