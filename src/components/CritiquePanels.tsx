import { memo, useId, useRef, useState, type ReactNode } from 'react';
import { ChevronDown, Loader2, Wand2 } from 'lucide-react';
import { CriterionLearnLink } from './CriterionLearnLink';
import { InlineGlossaryText } from './GlossarySupport';
import { PaintingOverlay } from './PaintingOverlay';
import { confidenceLabel } from '../critiqueCoach';
import type {
  CompletionRead,
  CritiqueCategory,
  CritiqueResult,
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

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
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
  const anchorFrameRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const panelId = useId();
  const thisCriterionLoading = previewLoading;
  const hasSessionPreview = Boolean(previewEditIdForCriterion && onViewAiEdit);
  const buttonLabel = thisCriterionLoading
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
        </span>
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={headingId}
          className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-1"
        >
          {category.confidence ? (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceBadgeClass(category.confidence)}`}>
                {confidenceLabel(category.confidence)}
              </span>
            </div>
          ) : null}
          {paintingImageSrc && category.anchor ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Stage lighting (approximate region)
                </p>
                <button
                  type="button"
                  onClick={() => setShowOverlay((v) => !v)}
                  className="rounded-full border border-violet-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700 transition hover:bg-violet-50"
                >
                  {showOverlay ? 'Hide overlay' : 'Show overlay'}
                </button>
              </div>
              <div className="mt-1.5 space-y-1">
                <p className="text-[11px] font-medium leading-snug text-slate-700">{category.anchor.areaSummary}</p>
                {category.anchor.evidencePointer &&
                normalizeWhitespace(category.anchor.evidencePointer) !==
                  normalizeWhitespace(category.anchor.areaSummary) ? (
                  <p className="text-[10px] leading-snug text-slate-500">{category.anchor.evidencePointer}</p>
                ) : null}
              </div>
              <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div ref={anchorFrameRef} className="relative">
                  <img src={paintingImageSrc} alt="" className="w-full object-contain bg-slate-100" />
                  {showOverlay ? <PaintingOverlay anchor={category.anchor} containerRef={anchorFrameRef} /> : null}
                </div>
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Critic&apos;s analysis</p>
                <div className="mt-1 text-xs leading-relaxed text-slate-700">
                  <InlineGlossaryText
                    text={category.phase2?.criticsAnalysis ?? ''}
                    section={category.criterion}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-xl bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Teacher&apos;s next steps
              </p>
              <div className="mt-1 text-xs leading-relaxed text-slate-700">
                <InlineGlossaryText
                  text={category.phase3?.teacherNextSteps ?? ''}
                  section={category.criterion}
                />
              </div>
            </div>
          </div>
          {category.preserve ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Preserve</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-950/90">{category.preserve}</p>
            </div>
          ) : null}
          {generateButtonVisible && canGenerateAiEdits && (onGenerateAiEdit || (hasSessionPreview && onViewAiEdit)) ? (
            <div className="rounded-xl border border-violet-200/80 bg-violet-50/60 p-3">
              <button
                type="button"
                disabled={
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

function OverallSummaryCardView({ critique }: { critique: CritiqueResult }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const panelId = useId();
  const os = critique.overallSummary;
  const summaryText = normalizeWhitespace(critique.summary || os?.analysis || '');
  if (!summaryText && !critique.completionRead && !critique.comparisonNote) return null;

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
          {summaryText ? (
            <div className="space-y-3">
              <div className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                <InlineGlossaryText text={summaryText} />
              </div>
            </div>
          ) : null}
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
        const generateButtonVisible = Boolean(category.anchor);
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
