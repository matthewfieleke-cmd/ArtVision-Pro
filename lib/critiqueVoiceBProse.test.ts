import { describe, expect, it } from 'vitest';

import {
  renderGroundedTeacherNextSteps,
  renderStructuredVoiceBStep,
} from './critiqueVoiceBProse.js';

describe('renderStructuredVoiceBStep', () => {
  it('avoids repeating the passage lead when the issue already names the anchor', () => {
    const rendered = renderStructuredVoiceBStep({
      index: 0,
      area: 'the jaw edge against the dark collar',
      issue: 'the jaw edge against the dark collar is no crisper than the softer cheek edge into the wall',
      move: 'sharpen the jaw-to-collar break while losing the cheek edge into the wall a little more',
      outcome: 'the face claims first attention while the useful cheek softness still stays atmospheric',
    });

    expect(rendered).toBe(
      '1. The jaw edge against the dark collar is no crisper than the softer cheek edge into the wall. Sharpen the jaw-to-collar break while losing the cheek edge into the wall a little more so the face claims first attention while the useful cheek softness still stays atmospheric.'
    );
  });

  it('still introduces the passage when the issue itself does not name it', () => {
    const rendered = renderStructuredVoiceBStep({
      area: 'the foreground chair back around the sitter',
      issue: 'the route breaks too abruptly through the middle slat',
      move: 'group the middle slat more clearly with the outer scaffold',
      outcome: 'the chair passage reads as one scaffold instead of two competing interruptions',
    });

    expect(rendered).toBe(
      'In the foreground chair back around the sitter, the route breaks too abruptly through the middle slat. Group the middle slat more clearly with the outer scaffold so the chair passage reads as one scaffold instead of two competing interruptions.'
    );
  });
});

describe('renderGroundedTeacherNextSteps', () => {
  it('removes a stacked "The <noun>" echo after a sentence-style anchor title', () => {
    const rendered = renderGroundedTeacherNextSteps({
      area: 'The purple wash across the foreground',
      currentRead:
        'The purple wash across the foreground The wash transitions smoothly into the lighter path, creating a gradient effect',
      move: 'quiet the heaviest purple accents along the path edge so the path reads first',
      expectedRead: 'the path stays the clearer lead while the wash still feels moody',
    });

    expect(rendered).toContain('transitions smoothly');
    expect(rendered).not.toMatch(/foreground The wash/i);
    expect(rendered.startsWith('In the purple wash across the foreground,')).toBe(true);
  });

  it('avoids the repeated "In area, area..." phrasing when the current read already starts with the anchor', () => {
    const rendered = renderGroundedTeacherNextSteps({
      area: 'the branch edge against the pale sky',
      currentRead:
        'the branch edge against the pale sky stays sharp at the fork while the nearby branch edge softens into the cloud',
      move:
        'sharpen the branch edge against the pale sky a little more while losing a nearby edge in that same passage',
      expectedRead: 'the forked branch reads as the single strongest accent in that passage',
    });

    expect(rendered).toBe(
      'The branch edge against the pale sky stays sharp at the fork while the nearby branch edge softens into the cloud. Sharpen the branch edge against the pale sky a little more while losing a nearby edge in that same passage so the forked branch reads as the single strongest accent in that passage.'
    );
  });

  it('does not prefix "In {area}," when the current read already references most anchor words (paraphrased anchor)', () => {
    const rendered = renderGroundedTeacherNextSteps({
      area: 'the distant house against the horizon',
      currentRead: 'the house is small and dark against the bright horizon, suggesting distance',
      move: "darken the house's silhouette against the horizon to increase its presence",
      expectedRead: 'the structure reads more clearly as a distant anchor in the field',
    });

    expect(rendered).toBe(
      "The house is small and dark against the bright horizon, suggesting distance. Darken the house's silhouette against the horizon to increase its presence so the structure reads more clearly as a distant anchor in the field."
    );
    expect(rendered).not.toMatch(/^In the distant house against the horizon,/i);
  });

  it('does not stack a second outcome when the move already ends with a "reads sooner"-style result clause', () => {
    const rendered = renderGroundedTeacherNextSteps({
      area: 'the yellow roof against the dark trees',
      currentRead: 'the yellow roof against the dark trees reads as the brightest value mass in the middle ground',
      move: 'separate the light and dark passages in the yellow roof against the dark trees more clearly so the value structure reads sooner',
      expectedRead: 'the light-dark separation reads sooner',
    });

    expect(rendered).toBe(
      'The yellow roof against the dark trees reads as the brightest value mass in the middle ground. Separate the light and dark passages in the yellow roof against the dark trees more clearly so the value structure reads sooner.'
    );
    expect(rendered).not.toMatch(/reads sooner so /i);
  });

  it('recovers from sentence-like area text without using the whole observation as a location', () => {
    const rendered = renderGroundedTeacherNextSteps({
      area: 'The warm yellow light contrasts with the cool blue exterior, creating a temperature shift.',
      currentRead:
        'The warm yellow light contrasts with the cool blue exterior, creating a temperature shift.',
      move:
        "Sharpen the clearest expressive passage in The warm yellow light contrasts with the cool blue exterior, creating a temperature shift.",
      expectedRead:
        "the painting's festive presence and human warmth will be strengthened",
    });

    expect(rendered).not.toMatch(/Sharpen .* in The warm yellow light contrasts/i);
    expect(rendered).not.toMatch(/^In the warm yellow light contrasts/i);
    expect(rendered).toMatch(/Sharpen the clearest expressive passage/i);
    expect(rendered).toMatch(/temperature shift/i);
  });
});
