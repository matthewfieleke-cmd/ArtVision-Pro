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
  const improveText = simple?.studioAnalysis.whatCouldImprove ?? '';
  const worksText = simple?.studioAnalysis.whatWorks ?? '';
  const genericMainIssue = Boolean(
    simple &&
      containsAny(improveText, [
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

  const genericVoiceA = Boolean(
    simple &&
      containsAny(`${worksText} ${improveText}`, [
        /\bcaptures?\b/i,
        /\beffectively uses?\b/i,
        /\bcreates a sense of\b/i,
        /\bstrong sense of\b/i,
        /\baims to\b/i,
      ])
  );

  const genericNextSteps = Boolean(
    simple &&
      simple.studioChanges.some((ch) =>
        containsAny(ch.text, [
          /increase contrast/i,
          /enhance definition/i,
          /refine edges/i,
          /create a stronger focal point/i,
          /improve spatial clarity/i,
          /more cohesive/i,
          /enhance focus/i,
          /\brefine the edges\b/i,
          /\badjust the lighting\b/i,
          /\badd subtle variations\b/i,
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
      ? 'The “what could improve” paragraph still leans on generic correction language, which several of the 11 experts would likely find too default and insufficiently tied to the work’s actual terms.'
      : 'The “what could improve” paragraph is more grounded in the painting’s own terms than in earlier generic outputs.'
  );
  notes.push(
    genericNextSteps
      ? 'Some studio change lines still fall back on stock advice such as more contrast, stronger focal point, or sharper definition.'
      : 'The studio change lines are more exact and less trapped in stock “clarify / contrast / focus” moves.'
  );
  notes.push(
    genericVoiceA
      ? 'Voice A still sounds somewhat like product-summary praise (“captures,” “effectively uses,” “creates a sense of”) instead of close, expert-specific judgment.'
      : 'Voice A sounds closer to a serious critic-teacher than to a generic art-app summary.'
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

/** Markdown lines for QA / review scripts (studioAnalysis + studioChanges). */
export function studioReadMarkdownLines(
  critique: CritiqueResultDTO,
  opts?: {
    title?: string;
    analysisSectionTitle?: string;
    changesSectionTitle?: string;
  }
): string[] {
  const s = critique.simpleFeedback;
  const title = opts?.title ?? '### Studio read';
  const analysisSectionTitle = opts?.analysisSectionTitle ?? '#### Analysis';
  const changesSectionTitle = opts?.changesSectionTitle ?? '#### Changes to make';
  const lines: string[] = [title, ''];
  if (!s) {
    lines.push('- _(no studio read)_', '');
    return lines;
  }
  lines.push(analysisSectionTitle);
  lines.push('');
  lines.push(`- **What works:** ${s.studioAnalysis.whatWorks}`);
  lines.push(`- **What could improve:** ${s.studioAnalysis.whatCouldImprove}`);
  lines.push('');
  lines.push(changesSectionTitle);
  lines.push('');
  for (let i = 0; i < s.studioChanges.length; i++) {
    const ch = s.studioChanges[i]!;
    lines.push(`${i + 1}. **${ch.previewCriterion}** — ${ch.text}`);
  }
  lines.push('');
  return lines;
}
