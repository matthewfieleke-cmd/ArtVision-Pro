import { memo, useId, useState, type ReactNode } from 'react';
import { ChevronDown, Loader2, Wand2 } from 'lucide-react';
import { CriterionLearnLink } from './CriterionLearnLink';
import { PaintingOverlay } from './PaintingOverlay';
import { confidenceLabel, levelWidth } from '../critiqueCoach';
import { splitNumberedSteps } from '../../lib/numberedSteps';
import type {
  CompletionRead,
  CritiqueCategory,
  CritiqueResult,
  CritiqueSubskill,
  PhotoQualityAssessment,
  SuggestedTitle,
  WorkCompletionState,
} from '../types';

type CritiquePanelsProps = {
  critique: CritiqueResult;
  paintingImageSrc?: string;
  onLearnMore?: () => void;
  canGenerateAiEdits?: boolean;
  onGenerateAiEditForCriterion?: (criterion: CritiqueCategory['criterion']) => void;
  /** Latest session preview id per criterion (for “View AI edit” after generation). */
  previewEditIdByCriterion?: Partial<Record<CritiqueCategory['criterion'], string>>;
  onFocusSessionPreviewForCriterion?: (criterion: CritiqueCategory['criterion']) => void;
  previewLoading?: boolean;
  /** Only the matching button shows a spinner. */
  previewLoadingTarget?: null | { kind: 'single'; criterion: CritiqueCategory['criterion'] };
  /** Rendered directly under Voice B (e.g. AI edits session), before photo quality / categories. */
  voiceBFooter?: ReactNode;
  /** Current title field (highlights which suggestion is active). */
  workingTitle?: string;
  onSelectSuggestedTitle?: (title: string) => void;
};

function ActionPlanBlock({ actionPlan }: { actionPlan: string }) {
  const steps = splitNumberedSteps(actionPlan);
  if (!steps.length) {
    return <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-700">{actionPlan}</p>;
  }
  return (
    <ol className="mt-1 space-y-2 pl-4 text-xs leading-relaxed text-slate-700">
      {steps.map((step, idx) => (
        <li key={`${idx}-${step}`} className="list-decimal">
          {step}
        </li>
      ))}
    </ol>
  );
}

function completionBadgeClasses(state: WorkCompletionState): string {
  switch (state) {
    case 'unfinished':
      return 'bg-amber-100 text-amber-900 ring-amber-200/80';
    case 'likely_finished':
      return 'bg-emerald-100 text-emerald-900 ring-emerald-200/80';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200/80';
  }
}

function completionLabel(state: WorkCompletionState): string {
  switch (state) {
    case 'unfinished':
      return 'Reads as in progress';
    case 'likely_finished':
      return 'Reads as largely finished';
    default:
      return 'Finish unclear from photo';
  }
}

function completionConfidenceLabel(confidence: CritiqueCategory['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'High confidence in this finish read';
    case 'medium':
      return 'Moderate confidence in this finish read';
    default:
      return 'Low confidence in this finish read';
  }
}

const LEVEL_RANK = {
  Beginner: 0,
  Intermediate: 1,
  Advanced: 2,
  Master: 3,
} as const;

function confidenceBadgeClass(confidence?: CritiqueCategory['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'bg-emerald-100 text-emerald-800';
    case 'medium':
      return 'bg-sky-100 text-sky-800';
    case 'low':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}

type CategoryCardProps = {
  category: CritiqueCategory;
  paintingImageSrc?: string;
  canGenerateAiEdits?: boolean;
  generateButtonVisible?: boolean;
  onGenerateAiEdit?: () => void;
  previewEditIdForCriterion?: string;
  onViewAiEdit?: () => void;
  previewLoading?: boolean;
  onLearnMore?: () => void;
};

/** 1 = worst, 10 = best; sub-skill snapshot only (criterion cards still use rating levels elsewhere). */
function subskillGradeOnTen(subskill: CritiqueSubskill): number {
  if (Number.isFinite(subskill.score)) {
    const g = Math.round(subskill.score * 9) + 1;
    return Math.min(10, Math.max(1, g));
  }
  const fromLevel: Record<string, number> = {
    Beginner: 2,
    Intermediate: 5,
    Advanced: 8,
    Master: 10,
  };
  return fromLevel[subskill.level] ?? 5;
}

function subskillBarWidthFromGrade(grade: number): string {
  const pct = Math.max(8, Math.round(((grade - 1) / 9) * 100));
  return `${pct}%`;
}

function normalizeLabel(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function hasUsableSubskills(category: CritiqueCategory): boolean {
  if (!category.subskills?.length) return false;

  const evidenceLabels = new Set(
    (category.evidenceSignals ?? []).map((signal) => normalizeLabel(signal))
  );

  return category.subskills.every((subskill) => {
    const label = subskill.label.trim();
    if (label.length === 0 || label.length > 36) return false;
    if (label.includes('.') || label.split(/\s+/).length > 4) return false;
    if (evidenceLabels.has(normalizeLabel(label))) return false;
    if (category.level) {
      const parentRank = LEVEL_RANK[category.level];
      if (LEVEL_RANK[subskill.level] > parentRank) return false;
    }
    return true;
  });
}

function CategoryCard({
  category,
  paintingImageSrc,
  canGenerateAiEdits = false,
  generateButtonVisible = false,
  onGenerateAiEdit,
  previewEditIdForCriterion,
  onViewAiEdit,
  previewLoading = false,
  onLearnMore,
}: CategoryCardProps) {
  const [open, setOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const headingId = useId();
  const panelId = useId();
  const hasRating = Boolean(category.level);
  const thisCriterionLoading = previewLoading;
  const hasSessionPreview = Boolean(previewEditIdForCriterion && onViewAiEdit);
  const buttonLabel =
    category.editPlan?.editability === 'no'
      ? 'This criterion is not available for AI edit on this painting.'
      : thisCriterionLoading
        ? 'Generating…'
        : hasSessionPreview
          ? 'View AI edit'
          : 'Generate AI edit';

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        id={headingId}
        className="flex w-full items-start gap-2 px-4 py-3 text-left transition hover:bg-slate-50/90"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${category.criterion}`}
      >
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">{category.criterion}</span>
          {hasRating ? (
            <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <span
                className="block h-full rounded-full bg-violet-500 transition-all duration-700"
                style={{ width: levelWidth(category.level!) }}
              />
            </span>
          ) : null}
        </span>
        {hasRating ? (
          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
            {category.level}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-1"
        >
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {category.confidence ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceBadgeClass(category.confidence)}`}>
                {confidenceLabel(category.confidence)}
              </span>
            ) : null}
            {hasRating && category.nextTarget ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {category.nextTarget}
              </span>
            ) : null}
          </div>
          {paintingImageSrc && category.anchor ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Referenced area</p>
                <button
                  type="button"
                  onClick={() => setShowOverlay((v) => !v)}
                  className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 transition hover:bg-violet-50"
                >
                  {showOverlay ? 'Hide overlay' : 'Show overlay'}
                </button>
              </div>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="relative">
                  <img src={paintingImageSrc} alt="" className="w-full object-contain bg-slate-100" />
                  {showOverlay ? <PaintingOverlay anchor={category.anchor} /> : null}
                </div>
              </div>
            </div>
          ) : null}
          <p className="text-sm leading-relaxed text-slate-600">{category.feedback}</p>
          {hasUsableSubskills(category) ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sub-skill snapshot</p>
              <p className="mt-1 text-[11px] leading-snug text-slate-500">1–10 scale (10 is strongest) within this criterion.</p>
              <div className="mt-2 space-y-3">
              {category.subskills!.map((subskill) => {
                const grade = subskillGradeOnTen(subskill);
                return (
                  <div key={subskill.label}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-700">{subskill.label}</p>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-700" title="Sub-skill strength on a 1–10 scale">
                        {grade}/10
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-violet-400 transition-all duration-700"
                        style={{ width: subskillBarWidthFromGrade(grade) }}
                      />
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          ) : null}
          {category.preserve ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Preserve</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-950/90">{category.preserve}</p>
            </div>
          ) : null}
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">How to improve it</p>
            <ActionPlanBlock actionPlan={category.actionPlan} />
          </div>
          {hasRating && category.practiceExercise ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Practice this skill</p>
              <p className="mt-1 text-xs leading-relaxed text-violet-950/90">{category.practiceExercise}</p>
            </div>
          ) : null}
          {generateButtonVisible && canGenerateAiEdits && (onGenerateAiEdit || (hasSessionPreview && onViewAiEdit)) ? (
            <div className="rounded-xl border border-violet-200/80 bg-violet-50/60 p-3">
              <button
                type="button"
                disabled={
                  category.editPlan?.editability === 'no' ||
                  thisCriterionLoading ||
                  (!hasSessionPreview && !onGenerateAiEdit)
                }
                aria-busy={thisCriterionLoading}
                onClick={() => {
                  if (thisCriterionLoading) return;
                  if (hasSessionPreview && onViewAiEdit) {
                    onViewAiEdit();
                  } else if (onGenerateAiEdit) {
                    onGenerateAiEdit();
                  }
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-800 shadow-sm transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                {thisCriterionLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" aria-hidden />
                )}
                {buttonLabel}
              </button>
            </div>
          ) : null}
          <CriterionLearnLink criterion={category.criterion} onClick={onLearnMore} />
        </div>
      ) : null}
    </article>
  );
}

function photoQualityBriefCopy(level: PhotoQualityAssessment['level']): string {
  switch (level) {
    case 'good':
      return 'Photo quality looks solid for judging the work.';
    case 'fair':
      return 'Photo quality is usable but has some limits—take the critique with a bit of caution.';
    default:
      return 'Photo quality is limiting—critique confidence is lower until you can re-shoot more evenly.';
  }
}

function OverallSummaryCardView({ critique }: { critique: CritiqueResult }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const panelId = useId();
  const os = critique.overallSummary;
  if (!os) return null;

  return (
    <article className="overflow-hidden rounded-2xl border border-violet-200/80 bg-white shadow-sm">
      <button
        type="button"
        id={headingId}
        className="flex w-full items-start gap-2 px-4 py-3 text-left transition hover:bg-slate-50/90"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Collapse' : 'Expand'} overall summary`}
      >
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Overall summary</span>
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-1"
        >
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Photo quality</p>
            {critique.photoQuality ? (
              <>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{photoQualityBriefCopy(critique.photoQuality.level)}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{critique.photoQuality.summary}</p>
                {critique.photoQuality.issues.length ? (
                  <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-600">
                    {critique.photoQuality.issues.slice(0, 4).map((issue) => (
                      <li key={issue} className="flex gap-2">
                        <span className="mt-[0.3rem] h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {critique.photoQuality.tips.length ? (
                  <div className="mt-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Re-shoot tips</p>
                    <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-slate-600">
                      {critique.photoQuality.tips.slice(0, 3).map((tip) => (
                        <li key={tip} className="flex gap-2">
                          <span className="mt-[0.3rem] h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                No separate photo-quality read is attached to this critique.
              </p>
            )}
          </div>
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Finished vs in progress</p>
            {critique.completionRead ? (
              <CompletionReadBrief read={critique.completionRead} />
            ) : (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                No finish-state read is attached to this critique.
              </p>
            )}
          </div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{os.analysis}</p>
          {os.topPriorities.length ? (
            <div className="rounded-xl border border-violet-200/70 bg-violet-50/60 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Top priorities · Voice B</p>
              <ol className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700">
                {os.topPriorities.map((priority) => (
                  <li key={priority} className="flex gap-2">
                    <span className="mt-[0.25rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
                    <span>{priority}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {critique.comparisonNote ? (
            <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-600">Vs. previous: </span>
              {critique.comparisonNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function normalizeTitles(raw: unknown[]): SuggestedTitle[] {
  const categories: SuggestedTitle['category'][] = ['formalist', 'tactile', 'intent'];
  return raw.map((entry, i) => {
    if (typeof entry === 'string') {
      return {
        category: categories[i % 3] ?? 'formalist',
        title: entry,
        rationale: '',
      };
    }
    if (entry && typeof entry === 'object') {
      const e = entry as Record<string, unknown>;
      return {
        category: (typeof e.category === 'string' && ['formalist', 'tactile', 'intent'].includes(e.category)
          ? e.category
          : categories[i % 3] ?? 'formalist') as SuggestedTitle['category'],
        title: typeof e.title === 'string' ? e.title : String(e.title ?? ''),
        rationale: typeof e.rationale === 'string' ? e.rationale : '',
      };
    }
    return { category: categories[i % 3] ?? 'formalist', title: String(entry ?? ''), rationale: '' };
  });
}

const TITLE_CATEGORY_LABELS: Record<SuggestedTitle['category'], { label: string; accent: string }> = {
  formalist: { label: 'Formalist', accent: 'bg-blue-50 text-blue-700 ring-blue-200' },
  tactile: { label: 'Tactile', accent: 'bg-amber-50 text-amber-700 ring-amber-200' },
  intent: { label: 'Intent', accent: 'bg-violet-50 text-violet-700 ring-violet-200' },
};

function SuggestedTitlesCard({
  titles,
  workingTitle,
  onSelectSuggestedTitle,
}: {
  titles: SuggestedTitle[];
  workingTitle?: string;
  onSelectSuggestedTitle?: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const panelId = useId();
  if (titles.length === 0) return null;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        id={headingId}
        className="flex w-full items-start gap-2 px-4 py-3 text-left transition hover:bg-slate-50/90"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Collapse' : 'Expand'} suggested painting titles`}
      >
        <ChevronDown
          className={`mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">Suggested titles</span>
          <span className="mt-0.5 block text-xs text-slate-500">
            Three title options derived from your painting&apos;s criterion analysis. Tap to use.
          </span>
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="space-y-4 border-t border-slate-100 px-4 pb-4 pt-3"
        >
          {titles.map((entry) => {
            const meta = TITLE_CATEGORY_LABELS[entry.category] ?? TITLE_CATEGORY_LABELS.formalist;
            const titleText = entry.title || '';
            const selected = workingTitle?.trim() === titleText.trim();
            return (
              <div key={`${entry.category}-${titleText}`} className="space-y-1">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${meta.accent}`}
                >
                  {meta.label}
                </span>
                <div>
                  {onSelectSuggestedTitle ? (
                    <button
                      type="button"
                      onClick={() => onSelectSuggestedTitle(titleText)}
                      className={`text-left text-sm leading-snug underline decoration-violet-300 decoration-1 underline-offset-2 transition hover:decoration-violet-500 ${
                        selected ? 'font-semibold text-violet-900' : 'text-slate-800'
                      }`}
                    >
                      {titleText}
                    </button>
                  ) : (
                    <span className="text-sm leading-snug text-slate-800">{titleText}</span>
                  )}
                </div>
                {entry.rationale ? (
                  <p className="text-xs leading-relaxed text-slate-500">{entry.rationale}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}

function CompletionReadBrief({ read }: { read: CompletionRead }) {
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${completionBadgeClasses(read.state)}`}
        >
          {completionLabel(read.state)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceBadgeClass(read.confidence)}`}
          title="How sure the app is about in-progress vs finished, from the photo"
        >
          {completionConfidenceLabel(read.confidence)}
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-700">{read.rationale}</p>
      {read.cues.length ? (
        <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-600">
          {read.cues.map((cue) => (
            <li key={cue} className="flex gap-2">
              <span className="mt-[0.3rem] h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
              <span>{cue}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export const CritiquePanels = memo(function CritiquePanels({
  critique,
  paintingImageSrc,
  onLearnMore,
  canGenerateAiEdits = false,
  onGenerateAiEditForCriterion,
  previewEditIdByCriterion,
  onFocusSessionPreviewForCriterion,
  previewLoading = false,
  previewLoadingTarget = null,
  voiceBFooter,
  workingTitle,
  onSelectSuggestedTitle,
}: CritiquePanelsProps) {
  return (
    <div className="space-y-3">
      <OverallSummaryCardView critique={critique} />
      {voiceBFooter ? (
        <div id="critique-session-ai-edits" className="min-w-0 scroll-mt-4">
          {voiceBFooter}
        </div>
      ) : null}
      {critique.suggestedPaintingTitles && critique.suggestedPaintingTitles.length >= 3 ? (
        <SuggestedTitlesCard
          titles={normalizeTitles(critique.suggestedPaintingTitles.slice(0, 3))}
          workingTitle={workingTitle}
          onSelectSuggestedTitle={onSelectSuggestedTitle}
        />
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Criterion cards</p>
      {critique.categories.map((category) => {
        const generateButtonVisible =
          category.level !== 'Master' &&
          category.editPlan?.editability === 'yes' &&
          Boolean(category.editPlan);
        const thisLoading =
          previewLoading &&
          previewLoadingTarget?.kind === 'single' &&
          previewLoadingTarget.criterion === category.criterion;
        const previewId = previewEditIdByCriterion?.[category.criterion];
        return (
          <CategoryCard
            key={category.criterion}
            category={category}
            paintingImageSrc={paintingImageSrc}
            canGenerateAiEdits={canGenerateAiEdits}
            generateButtonVisible={generateButtonVisible}
            onGenerateAiEdit={
              onGenerateAiEditForCriterion ? () => onGenerateAiEditForCriterion(category.criterion) : undefined
            }
            previewEditIdForCriterion={previewId}
            onViewAiEdit={
              previewId && onFocusSessionPreviewForCriterion
                ? () => onFocusSessionPreviewForCriterion(category.criterion)
                : undefined
            }
            previewLoading={thisLoading}
            onLearnMore={onLearnMore}
          />
        );
      })}
    </div>
  );
});
