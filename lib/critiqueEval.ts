import type { CritiqueResultDTO } from './critiqueTypes.js';
import { CritiqueRuntimeEvalError } from './critiqueErrors.js';
import { hasAnchorReference, tokenOverlapRatio } from './critiqueGrounding.js';
import {
  GENERIC_MAIN_ISSUE_PATTERNS,
  GENERIC_VOICE_A_PATTERNS,
  matchesAnyRegExp,
  VAGUE_OR_GENERIC_STUDIO_PATTERNS,
} from './critiqueTextRules.js';

export type CritiqueEvalResult = {
  genericMainIssue: boolean;
  genericVoiceA: boolean;
  genericNextSteps: boolean;
  vagueVoiceB: boolean;
  weakEvidence: boolean;
  weakGrounding: boolean;
  duplicatedCoaching: boolean;
  suspiciousOverpraise: boolean;
  blockingIssues: string[];
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
    simple && matchesAnyRegExp(improveText, GENERIC_MAIN_ISSUE_PATTERNS)
  );

  const genericVoiceA = Boolean(
    simple && matchesAnyRegExp(`${worksText} ${improveText}`, GENERIC_VOICE_A_PATTERNS)
  );

  const genericNextSteps = Boolean(
    simple &&
      simple.studioChanges.some((ch) => matchesAnyRegExp(ch.text, VAGUE_OR_GENERIC_STUDIO_PATTERNS))
  );

  const vagueVoiceB = Boolean(
    simple &&
      simple.studioChanges.some((ch) => matchesAnyRegExp(ch.text, VAGUE_OR_GENERIC_STUDIO_PATTERNS))
  );

  const weakEvidence = critique.categories.some(
    (category) =>
      !category.evidenceSignals ||
      category.evidenceSignals.length < 2 ||
      category.evidenceSignals.some((signal) => signal.trim().length < 12)
  );

  const weakGrounding = critique.categories.some((category) => {
    const teacher = category.phase3.teacherNextSteps;
    const critic = category.phase2.criticsAnalysis;
    return (
      !hasAnchorReference(teacher, category.anchor?.areaSummary, category.anchor?.evidencePointer, 'pass') ||
      !hasAnchorReference(critic, category.anchor?.areaSummary, category.anchor?.evidencePointer, 'pass')
    );
  });

  const duplicatedCoaching = critique.categories.some((category, index) =>
    critique.categories.slice(index + 1).some((other) => {
      const currentAdvice = `${category.phase3.teacherNextSteps} ${category.actionPlanSteps?.[0]?.move ?? ''}`;
      const otherAdvice = `${other.phase3.teacherNextSteps} ${other.actionPlanSteps?.[0]?.move ?? ''}`;
      return tokenOverlapRatio(currentAdvice, otherAdvice) >= 0.72;
    })
  );

  const suspiciousOverpraise = Boolean(
    simple &&
      containsAny(`${worksText} ${improveText} ${critique.summary}`, [
        /childlike.*expert/i,
        /scribble.*master/i,
        /naive.*advanced/i,
        /simplified forms?.*advanced/i,
        /kindergarten/i,
      ])
  );

  const notes: string[] = [];
  notes.push(
    genericMainIssue
      ? 'The “what could improve” paragraph still leans on generic correction language, which several of the 11 experts would likely find too default and insufficiently tied to the work’s actual terms.'
      : 'The “what could improve” paragraph is more grounded in the painting’s own terms than in earlier generic outputs.'
  );
  notes.push(
    genericNextSteps
      ? 'Some studio change lines still fall back on stock advice such as more contrast, stronger focal point, vague edge fixes, vague narrative additions, or unspecified color-transition cleanup.'
      : 'The studio change lines are more exact and less trapped in stock “clarify / contrast / focus” moves.'
  );
  notes.push(
    vagueVoiceB
      ? 'Voice B still includes teacherly but underspecified moves (for example: define edges, enhance narrative, smooth transitions) without naming the exact passage, the exact visual problem there, and the exact move to make.'
      : 'Voice B usually states where, what, and how rather than relying on generic “improve this area” coaching.'
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
    weakGrounding
      ? 'At least one criterion drifts away from its anchored passage, so the coaching would be hard to trust on-canvas.'
      : 'The category-level coaching stays tied to concrete anchored passages instead of drifting into abstract advice.'
  );
  notes.push(
    duplicatedCoaching
      ? 'Two or more criteria are effectively giving the same teaching move, which weakens the eight-part rubric.'
      : 'The criterion coaching stays distinct enough to feel like eight different levers rather than one repeated note.'
  );
  notes.push(
    suspiciousOverpraise
      ? 'The response appears to over-credit childlike or underdeveloped handling as if it were mature stylization; this should be treated as a calibration failure.'
      : 'There is no obvious sign that the response is mistaking novice handling for successful stylization.'
  );
  notes.push(
    simple
      ? 'Overall, this response would probably help the artist improve, but the key question remains whether it respects the work’s own terms or still pushes generic correction.'
      : 'Without a clear simple feedback layer, the response would be less immediately usable for the painter.'
  );

  const blockingIssues: string[] = [];
  if (weakEvidence) blockingIssues.push('The critique does not provide enough visible proof for several criteria.');
  if (weakGrounding) blockingIssues.push('The critique drifts away from its anchored evidence passages.');
  if (duplicatedCoaching) blockingIssues.push('The teaching advice repeats across criteria instead of staying distinct.');
  if (genericNextSteps || vagueVoiceB) blockingIssues.push('The teaching advice is still too generic to be actionable.');

  return {
    genericMainIssue,
    genericVoiceA,
    genericNextSteps,
    vagueVoiceB,
    weakEvidence,
    weakGrounding,
    duplicatedCoaching,
    suspiciousOverpraise,
    blockingIssues,
    notes,
  };
}

export function assertCritiqueQualityGate(critique: CritiqueResultDTO): CritiqueEvalResult {
  const evaluation = evaluateCritiqueQuality(critique);
  if (evaluation.blockingIssues.length > 0) {
    throw new CritiqueRuntimeEvalError('Critique quality gate rejected the response.', {
      stage: 'final',
      details: evaluation.blockingIssues,
    });
  }
  return evaluation;
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
