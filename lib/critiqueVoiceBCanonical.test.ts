import { describe, expect, it } from 'vitest';
import type { CritiqueCategory } from '../shared/critiqueContract.js';

import {
  canonicalPlanFromLegacy,
  deriveActionPlanStepFromCanonical,
  deriveEditPlanFromCanonical,
  deriveLegacyVoiceBPlanFromCanonical,
  hydrateVoiceBCanonicalCategory,
} from './critiqueVoiceBCanonical';

describe('critiqueVoiceBCanonical', () => {
  it('derives legacy edit fields from canonical plan', () => {
    const anchor = {
      areaSummary: 'the edge where the shoulder meets the dark wall',
      evidencePointer: 'The shoulder edge softens into the wall, weakening separation.',
      region: { x: 0.1, y: 0.2, width: 0.3, height: 0.25 },
    };
    const plan = {
      currentRead: 'The shoulder edge softens into the wall, weakening separation.',
      move: 'sharpen the shoulder edge against the dark wall.',
      expectedRead: 'The shoulder will separate sooner and hold the figure forward.',
      preserve: 'Keep the nearby soft transitions in the sleeve.',
      editability: 'yes' as const,
    };

    expect(deriveActionPlanStepFromCanonical(anchor, plan)).toEqual({
      area: anchor.areaSummary,
      currentRead: plan.currentRead,
      move: plan.move,
      expectedRead: plan.expectedRead,
      preserve: plan.preserve,
      priority: 'primary',
    });

    expect(deriveEditPlanFromCanonical(anchor, plan)).toEqual({
      targetArea: anchor.areaSummary,
      preserveArea: plan.preserve,
      issue: plan.currentRead,
      intendedChange: plan.move,
      expectedOutcome: plan.expectedRead,
      editability: 'yes',
    });

    expect(deriveLegacyVoiceBPlanFromCanonical(plan)).toEqual({
      currentRead: plan.currentRead,
      bestNextMove: plan.move,
      expectedRead: plan.expectedRead,
    });
  });

  it('falls back to anchor evidence when canonical preserve text is too generic for editPlan', () => {
    const anchor = {
      areaSummary: 'the broken color in the water reflection',
      evidencePointer: 'Short orange and blue strokes break across the reflection instead of blending into one smooth stripe.',
      region: { x: 0.2, y: 0.35, width: 0.25, height: 0.2 },
    };
    const plan = {
      currentRead:
        'Short orange and blue strokes break across the reflection instead of blending into one smooth stripe.',
      move: 'group the shortest orange breaks inside the reflection so the vertical pull reads more continuously.',
      expectedRead: 'The reflection will still shimmer, but it will hold together as one clearer vertical passage.',
      preserve: 'Keep the nearby handling transitions intact.',
      editability: 'yes' as const,
    };

    expect(deriveEditPlanFromCanonical(anchor, plan)).toEqual({
      targetArea: anchor.areaSummary,
      preserveArea: anchor.evidencePointer,
      issue: plan.currentRead,
      intendedChange: plan.move,
      expectedOutcome: plan.expectedRead,
      editability: 'yes',
    });
  });

  it('falls back to anchor evidence when preserve text is passage-adjacent but still abstract', () => {
    const anchor = {
      areaSummary: 'the orange sun against the blue-gray sky',
      evidencePointer: 'The sun sits as a small hot circle against the cooler blue-gray sky above the harbor.',
      region: { x: 0.45, y: 0.12, width: 0.18, height: 0.16 },
    };
    const plan = {
      currentRead: 'The sun sits as a small hot circle against the cooler blue-gray sky above the harbor.',
      move: 'quiet the brightest halo around the sun so the hot circle stays intense without spreading too broadly.',
      expectedRead: 'The sun will stay decisive while the surrounding sky remains quieter and more open.',
      preserve: 'Preserve the strong focal point created by the orange sun against the blue-gray sky.',
      editability: 'yes' as const,
    };

    expect(deriveEditPlanFromCanonical(anchor, plan)).toEqual({
      targetArea: anchor.areaSummary,
      preserveArea: anchor.evidencePointer,
      issue: plan.currentRead,
      intendedChange: plan.move,
      expectedOutcome: plan.expectedRead,
      editability: 'yes',
    });
  });

  it('builds a canonical plan from legacy voice b fields', () => {
    const category = {
      phase3: {
        teacherNextSteps:
          '1. Sharpen the shoulder edge against the dark wall so the figure separates sooner.',
      },
      actionPlanSteps: [
        {
          area: 'the edge where the shoulder meets the dark wall',
          currentRead: 'The shoulder edge softens into the wall, weakening separation.',
          move: 'sharpen the shoulder edge against the dark wall.',
          expectedRead: 'The shoulder will separate sooner and hold the figure forward.',
          preserve: 'Keep the nearby soft transitions in the sleeve.',
          priority: 'primary' as const,
        },
      ],
      editPlan: {
        targetArea: 'the edge where the shoulder meets the dark wall',
        preserveArea: 'Keep the nearby soft transitions in the sleeve.',
        issue: 'The shoulder edge softens into the wall, weakening separation.',
        intendedChange: 'sharpen the shoulder edge against the dark wall.',
        expectedOutcome: 'The shoulder will separate sooner and hold the figure forward.',
        editability: 'yes' as const,
      },
      voiceBPlan: {
        currentRead: 'The shoulder edge softens into the wall, weakening separation.',
        bestNextMove: 'sharpen the shoulder edge against the dark wall.',
        expectedRead: 'The shoulder will separate sooner and hold the figure forward.',
      },
      preserve: 'Keep the nearby soft transitions in the sleeve.',
    };

    expect(canonicalPlanFromLegacy(category)).toEqual({
      currentRead: 'The shoulder edge softens into the wall, weakening separation.',
      move: 'sharpen the shoulder edge against the dark wall.',
      expectedRead: 'The shoulder will separate sooner and hold the figure forward.',
      preserve: 'Keep the nearby soft transitions in the sleeve.',
      editability: 'yes',
    });
  });

  it('hydrates canonical plan and legacy compatibility fields together', () => {
    const category = hydrateVoiceBCanonicalCategory<CritiqueCategory>({
      criterion: 'Edge and focus control' as const,
      phase1: { visualInventory: 'A soft shoulder edge meets a dark wall.' },
      phase2: { criticsAnalysis: 'The shoulder loses separation where it meets the wall.' },
      phase3: {
        teacherNextSteps:
          '1. Sharpen the shoulder edge against the dark wall so the figure separates sooner.',
      },
      anchor: {
        areaSummary: 'the edge where the shoulder meets the dark wall',
        evidencePointer: 'The shoulder edge softens into the wall, weakening separation.',
        region: { x: 0.1, y: 0.2, width: 0.3, height: 0.25 },
      },
      plan: {
        currentRead: 'The shoulder edge softens into the wall, weakening separation.',
        move: 'sharpen the shoulder edge against the dark wall.',
        expectedRead: 'The shoulder will separate sooner and hold the figure forward.',
        preserve: 'Keep the nearby soft transitions in the sleeve.',
        editability: 'yes' as const,
      },
    });

    expect(category.plan?.move).toBe('sharpen the shoulder edge against the dark wall.');
    if (!category.actionPlanSteps?.[0] || !category.editPlan || !category.voiceBPlan) {
      throw new Error('Expected legacy Voice B compatibility fields to be derived.');
    }
    expect(category.actionPlanSteps[0].area).toBe('the edge where the shoulder meets the dark wall');
    expect(category.editPlan.targetArea).toBe('the edge where the shoulder meets the dark wall');
    expect(category.voiceBPlan.bestNextMove).toBe('sharpen the shoulder edge against the dark wall.');
  });
});
