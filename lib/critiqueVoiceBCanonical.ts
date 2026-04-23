import type { VoiceBCanonicalPlan, VoiceBPlan, VoiceBStep } from '../shared/critiqueContract.js';
import type { CriterionAnchor, CriterionEditPlan } from '../shared/critiqueAnchors.js';

/**
 * Small self-contained regexes and helpers used by the legacy-critique
 * hydration path (App.tsx still calls `hydrateVoiceBCanonicalCategory` on
 * older saved critiques so their plan shape matches what the preview-edit
 * UI expects). These were previously imported from `critiqueTextRules` and
 * `critiqueGrounding`, which have been retired; inlining them keeps this
 * module self-sufficient without reintroducing the dead modules.
 */
const CRITIQUE_DONT_CHANGE_PATTERN = /^\s*(?:1\.\s*)?don['\u2019]t change a thing\./i;
const CRITIQUE_PRESERVE_VERB_PATTERN =
  /^\s*(preserve|keep|protect|leave|hold|maintain|continue)\b/i;

const GENERIC_ANCHOR_PATTERNS: RegExp[] = [
  /^\s*the (background|foreground|painting overall|composition overall|canvas|image|work|picture|scene)\s*$/i,
  /^\s*(left|right|center) side of the painting\s*$/i,
  /^\s*arrangement of elements\s*$/i,
  /^\s*spatial relationships\s*$/i,
];

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function isConcreteAnchor(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (normalized.length < 8) return false;
  if (GENERIC_ANCHOR_PATTERNS.some((pattern) => pattern.test(normalized))) return false;
  // At least two non-trivial words so "the chair" alone is still considered
  // underspecified. Stopword check is approximate — this helper only gates
  // whether preserve text is specific enough to surface; if nothing qualifies
  // we fall back to the anchor's own evidence pointer, which is always safe.
  const words = normalized
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3);
  return words.length >= 2;
}

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

const GENERIC_PRESERVE_AREA_PATTERN =
  /\b((nearby|surrounding|adjacent)\s+(handling|transitions?|surface|texture|textures|edges?|passages?|areas?|strengths?)|strong (focal point|compositional line|axis|contrast|atmosphere|mood)|harmonious contrast|dynamic compositional line|central organizing element)\b/i;

function clean(text: string | undefined): string | undefined {
  const normalized = text?.trim();
  return normalized ? normalized : undefined;
}

function concretePreserveArea(
  anchor: CriterionAnchor,
  plan: VoiceBCanonicalPlan
): string {
  const preserve = clean(plan.preserve);
  return preserve && isConcreteAnchor(preserve) && !GENERIC_PRESERVE_AREA_PATTERN.test(preserve)
    ? preserve
    : anchor.evidencePointer;
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
    preserveArea: concretePreserveArea(anchor, plan),
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
