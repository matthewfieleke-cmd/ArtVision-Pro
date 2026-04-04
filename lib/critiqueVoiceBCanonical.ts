import type { VoiceBCanonicalPlan, VoiceBPlan, VoiceBStep } from '../shared/critiqueContract.js';
import type { CriterionAnchor, CriterionEditPlan } from '../shared/critiqueAnchors.js';
import { CRITIQUE_DONT_CHANGE_PATTERN, CRITIQUE_PRESERVE_VERB_PATTERN } from './critiqueTextRules.js';

type VoiceBLegacyCompatible = {
  phase3?: { teacherNextSteps?: string };
  actionPlanSteps?: VoiceBStep[];
  editPlan?: CriterionEditPlan;
  voiceBPlan?: VoiceBPlan;
  preserve?: string;
};

type VoiceBCanonicalCarrier = VoiceBLegacyCompatible & {
  anchor?: CriterionAnchor;
  plan?: VoiceBCanonicalPlan;
};

function clean(text: string | undefined): string | undefined {
  const normalized = text?.trim();
  return normalized ? normalized : undefined;
}

export function deriveActionPlanStepFromCanonical(
  anchor: CriterionAnchor | undefined,
  plan: VoiceBCanonicalPlan | undefined
): VoiceBStep | undefined {
  if (!anchor || !plan) return undefined;
  return {
    area: anchor.areaSummary,
    currentRead: plan.currentRead,
    move: plan.move,
    expectedRead: plan.expectedRead,
    ...(plan.preserve ? { preserve: plan.preserve } : {}),
    priority: 'primary',
  };
}

export function deriveEditPlanFromCanonical(
  anchor: CriterionAnchor | undefined,
  plan: VoiceBCanonicalPlan | undefined
): CriterionEditPlan | undefined {
  if (!anchor || !plan) return undefined;
  return {
    targetArea: anchor.areaSummary,
    preserveArea: plan.preserve ?? anchor.evidencePointer,
    issue: plan.currentRead,
    intendedChange: plan.move,
    expectedOutcome: plan.expectedRead,
    editability: plan.editability,
  };
}

export function deriveLegacyVoiceBPlanFromCanonical(
  plan: VoiceBCanonicalPlan | undefined
): VoiceBPlan | undefined {
  if (!plan) return undefined;
  return {
    currentRead: plan.currentRead,
    bestNextMove: plan.move,
    expectedRead: plan.expectedRead,
  };
}

export function canonicalPlanFromLegacy(
  category: VoiceBLegacyCompatible
): VoiceBCanonicalPlan | undefined {
  const step = category.actionPlanSteps?.[0];
  const currentRead = clean(step?.currentRead) ?? clean(category.editPlan?.issue) ?? clean(category.voiceBPlan?.currentRead);
  const move = clean(step?.move) ?? clean(category.editPlan?.intendedChange) ?? clean(category.voiceBPlan?.bestNextMove);
  const expectedRead =
    clean(step?.expectedRead) ?? clean(category.editPlan?.expectedOutcome) ?? clean(category.voiceBPlan?.expectedRead);
  const preserve = clean(step?.preserve) ?? clean(category.editPlan?.preserveArea) ?? clean(category.preserve);

  if (!currentRead || !move || !expectedRead) return undefined;

  const teacherNextSteps = clean(category.phase3?.teacherNextSteps) ?? '';
  const editability =
    category.editPlan?.editability ??
    (CRITIQUE_DONT_CHANGE_PATTERN.test(teacherNextSteps) || CRITIQUE_PRESERVE_VERB_PATTERN.test(move) ? 'no' : 'yes');

  return {
    currentRead,
    move,
    expectedRead,
    ...(preserve ? { preserve } : {}),
    editability,
  };
}

export function hydrateVoiceBCanonicalCategory<T extends VoiceBCanonicalCarrier>(category: T): T {
  const plan = category.plan ?? canonicalPlanFromLegacy(category);
  if (!plan) return category;
  const hydrated: VoiceBCanonicalCarrier = {
    ...category,
    plan,
  };
  if (!hydrated.actionPlanSteps) {
    const step = deriveActionPlanStepFromCanonical(hydrated.anchor, plan);
    if (step) hydrated.actionPlanSteps = [step];
  }
  if (!hydrated.editPlan) {
    const editPlan = deriveEditPlanFromCanonical(hydrated.anchor, plan);
    if (editPlan) hydrated.editPlan = editPlan;
  }
  if (!hydrated.voiceBPlan) {
    const legacyPlan = deriveLegacyVoiceBPlanFromCanonical(plan);
    if (legacyPlan) hydrated.voiceBPlan = legacyPlan;
  }
  return hydrated as T;
}
