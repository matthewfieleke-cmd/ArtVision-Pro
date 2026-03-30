export type NormalizedRegion = {
  /** Left edge as a fraction of image width (0-1). */
  x: number;
  /** Top edge as a fraction of image height (0-1). */
  y: number;
  /** Region width as a fraction of image width (0-1). */
  width: number;
  /** Region height as a fraction of image height (0-1). */
  height: number;
};

/**
 * One anchored visual passage that the critique, overlay, and AI edit all reference.
 * The prose should reuse `areaSummary` verbatim so the UI can stay aligned.
 */
export type CriterionAnchor = {
  /** Short phrase the user can recognize in the painting, e.g. "the chair back in the foreground". */
  areaSummary: string;
  /** What about that area matters for this criterion. */
  evidencePointer: string;
  /** Approximate connected region in normalized coordinates. */
  region: NormalizedRegion;
};

/**
 * Machine-readable edit instructions consumed by the AI preview system.
 * Kept separate from Voice B prose so the edit model gets an exact target.
 */
export type CriterionEditPlan = {
  targetArea: string;
  preserveArea: string;
  issue: string;
  intendedChange: string;
  expectedOutcome: string;
  editability: 'yes' | 'no';
};
