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
