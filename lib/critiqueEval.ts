import type { CritiqueResultDTO } from './critiqueTypes.js';

export type CritiqueEvalResult = {
  genericMainIssue: boolean;
  genericNextSteps: boolean;
  weakEvidence: boolean;
  notes: string[];
};

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function evaluateCritiqueQuality(critique: CritiqueResultDTO): CritiqueEvalResult {
  const simple = critique.simpleFeedback;
  const genericMainIssue = Boolean(
    simple &&
      containsAny(simple.mainIssue, [
        /clearer focal/i,
        /stronger focal/i,
        /enhance depth/i,
        /more depth/i,
        /more contrast/i,
        /spatial definition/i,
        /guide the viewer/i,
        /more cohesion/i,
      ])
  );

  const genericNextSteps = Boolean(
    simple &&
      simple.nextSteps.some((step) =>
        containsAny(step, [
          /increase contrast/i,
          /enhance definition/i,
          /refine edges/i,
          /create a stronger focal point/i,
          /improve spatial clarity/i,
          /more cohesive/i,
          /enhance focus/i,
        ])
      )
  );

  const weakEvidence = critique.categories.some(
    (category) =>
      !category.evidenceSignals ||
      category.evidenceSignals.length < 2 ||
      category.evidenceSignals.some((signal) => signal.trim().length < 12)
  );

  const notes: string[] = [];
  notes.push(
    genericMainIssue
      ? 'The top-level main issue still leans on generic correction language, which several of the 11 experts would likely find too default and insufficiently tied to the work’s actual terms.'
      : 'The top-level main issue is more grounded in the painting’s own terms than in earlier generic outputs.'
  );
  notes.push(
    genericNextSteps
      ? 'Some next steps still fall back on stock advice such as more contrast, stronger focal point, or sharper definition.'
      : 'The next steps are more exact and less trapped in stock “clarify / contrast / focus” moves.'
  );
  notes.push(
    weakEvidence
      ? 'The evidence layer is still weaker than the 11-expert standard would want; the stricter historians and painter-teachers would expect more visible proof.'
      : 'The evidence layer gives a visible basis for judgment, which makes the critique more trustworthy.'
  );
  notes.push(
    simple
      ? 'Overall, this response would probably help the artist improve, but the key question remains whether it respects the work’s own terms or still pushes generic correction.'
      : 'Without a clear simple feedback layer, the response would be less immediately usable for the painter.'
  );

  return {
    genericMainIssue,
    genericNextSteps,
    weakEvidence,
    notes,
  };
}
