import { describe, expect, it } from 'vitest';

import {
  mapNormalizedRegionToContainerPercent,
  mapNormalizedRegionToImageRectPercent,
  objectContainDisplayRect,
} from './anchorOverlayLayout';

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

  it('keeps overflowing regions inside the displayed image', () => {
    const p = mapNormalizedRegionToContainerPercent(
      { x: 0.8, y: 0.75, width: 0.5, height: 0.5 },
      100,
      100,
      100,
      100
    );
    expect(parseFloat(p.left)).toBeCloseTo(80);
    expect(parseFloat(p.top)).toBeCloseTo(75);
    expect(parseFloat(p.width)).toBeCloseTo(20);
    expect(parseFloat(p.height)).toBeCloseTo(25);
  });

  it('treats invalid region values as an empty safe box', () => {
    const p = mapNormalizedRegionToContainerPercent(
      { x: Number.NaN, y: Number.NaN, width: Number.NaN, height: Number.NaN },
      100,
      100,
      100,
      100
    );
    expect(p).toEqual({ left: '0%', top: '0%', width: '0%', height: '0%' });
  });
});

describe('mapNormalizedRegionToImageRectPercent', () => {
  it('matches the image-fills-container case', () => {
    // Image rect fills the container exactly; aspect matches natural.
    const p = mapNormalizedRegionToImageRectPercent(
      { x: 0, y: 0, width: 1, height: 1 },
      { width: 100, height: 100 },
      { left: 0, top: 0, width: 100, height: 100 },
      100,
      100
    );
    expect(p).toEqual({ left: '0%', top: '0%', width: '100%', height: '100%' });
  });

  it('aligns to a centered intrinsic-width image inside a wider container', () => {
    // The desktop-compact drift case: a 100×100 image centered in a 200-wide
    // container (50px gutters). The full-image region must land on the image,
    // not the container.
    const p = mapNormalizedRegionToImageRectPercent(
      { x: 0, y: 0, width: 1, height: 1 },
      { width: 200, height: 100 },
      { left: 50, top: 0, width: 100, height: 100 },
      100,
      100
    );
    expect(parseFloat(p.left)).toBeCloseTo(25);
    expect(parseFloat(p.top)).toBeCloseTo(0);
    expect(parseFloat(p.width)).toBeCloseTo(50);
    expect(parseFloat(p.height)).toBeCloseTo(100);
  });

  it('handles object-contain letterboxing within the image element', () => {
    // Image element is 100×100 but the bitmap is 100×50, so contain leaves
    // 25px bands top/bottom inside the element.
    const p = mapNormalizedRegionToImageRectPercent(
      { x: 0, y: 0, width: 0.1, height: 0.1 },
      { width: 100, height: 100 },
      { left: 0, top: 0, width: 100, height: 100 },
      100,
      50
    );
    expect(parseFloat(p.left)).toBeCloseTo(0);
    expect(parseFloat(p.width)).toBeCloseTo(10);
    expect(parseFloat(p.top)).toBeCloseTo(25);
    expect(parseFloat(p.height)).toBeCloseTo(5);
  });

  it('returns an empty safe box for a zero-size container', () => {
    const p = mapNormalizedRegionToImageRectPercent(
      { x: 0, y: 0, width: 1, height: 1 },
      { width: 0, height: 0 },
      { left: 0, top: 0, width: 0, height: 0 },
      100,
      100
    );
    expect(p).toEqual({ left: '0%', top: '0%', width: '0%', height: '0%' });
  });
});
