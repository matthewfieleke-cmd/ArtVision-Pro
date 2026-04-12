import { describe, expect, it } from 'vitest';

import { mapNormalizedRegionToContainerPercent, objectContainDisplayRect } from './anchorOverlayLayout';

describe('objectContainDisplayRect', () => {
  it('centers a wide image in a tall container', () => {
    const r = objectContainDisplayRect(100, 200, 200, 100);
    expect(r.width).toBe(100);
    expect(r.height).toBe(50);
    expect(r.x).toBe(0);
    expect(r.y).toBe(75);
  });

  it('centers a tall image in a wide container', () => {
    const r = objectContainDisplayRect(200, 100, 100, 200);
    expect(r.width).toBe(50);
    expect(r.height).toBe(100);
    expect(r.x).toBe(75);
    expect(r.y).toBe(0);
  });
});

describe('mapNormalizedRegionToContainerPercent', () => {
  it('maps top-left corner of image into letterboxed layout', () => {
    // Container 100×100, image 100×50 (letterbox top/bottom 25px bands)
    const p = mapNormalizedRegionToContainerPercent(
      { x: 0, y: 0, width: 0.1, height: 0.1 },
      100,
      100,
      100,
      50
    );
    expect(p.left).toBe('0%');
    expect(p.width).toBe('10%');
    expect(p.top).toBe('25%');
    expect(p.height).toBe('5%');
  });

  it('maps full image to full container when aspect matches', () => {
    const p = mapNormalizedRegionToContainerPercent(
      { x: 0, y: 0, width: 1, height: 1 },
      100,
      100,
      100,
      100
    );
    expect(p).toEqual({ left: '0%', top: '0%', width: '100%', height: '100%' });
  });
});
