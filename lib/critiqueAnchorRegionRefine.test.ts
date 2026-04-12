import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { normalizedRegionSchema } from './critiqueZodSchemas.js';

describe('anchor region refine schema', () => {
  it('accepts exactly eight regions', () => {
    const row = { x: 0.1, y: 0.2, width: 0.3, height: 0.25 };
    const regions = Array.from({ length: 8 }, () => ({ ...row }));
    const parsed = z.object({ regions: z.array(normalizedRegionSchema).length(8) }).safeParse({ regions });
    expect(parsed.success).toBe(true);
  });
});
