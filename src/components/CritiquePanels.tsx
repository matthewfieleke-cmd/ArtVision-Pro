import { useId, useState } from 'react';
import { ChevronDown, Loader2, Wand2 } from 'lucide-react';
import { CriterionLearnLink } from './CriterionLearnLink';
import { confidenceLabel, levelWidth } from '../critiqueCoach';
import type { CritiqueCategory, CritiqueResult, WorkCompletionState } from '../types';

type CritiquePanelsProps = {
  critique: CritiqueResult;
  onLearnMore?: () => void;
  canGenerateAiEdits?: boolean;
  onGenerateAiEditForChange?: (changeIndex: number) => void;
  onGenerateAiEditAll?: () => void;
  previewLoading?: boolean;
  /** Only the matching button shows a spinner. */
  previewLoadingTarget?: null | { kind: 'combined' } | { kind: 'single'; changeIndex: number };
  previewAllProgress?: { current: number; total: number } | null;
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
  onLearnMore?: () => void;
};

function subskillBarWidth(score: number): string {
  return `${Math.max(10, Math.round(score * 100))}%`;
}

function normalizeLabel(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

function hasUsableSubskills(category: CritiqueCategory): boolean {
  if (!category.subskills?.length) return false;

  const parentRank = LEVEL_RANK[category.level];
  const evidenceLabels = new Set(
    (category.evidenceSignals ?? []).map((signal) => normalizeLabel(signal))
  );

  return category.subskills.every((subskill) => {
    const label = subskill.label.trim();
    if (label.length === 0 || label.length > 36) return false;
    if (label.includes('.') || label.split(/\s+/).length > 4) return false;
    if (evidenceLabels.has(normalizeLabel(label))) return false;
    return LEVEL_RANK[subskill.level] <= parentRank;
  });
}

function hasDriverDetails(category: CritiqueCategory): boolean {
  return Boolean(category.evidenceSignals?.length || hasUsableSubskills(category));
}

function CategoryCard({ category, onLearnMore }: CategoryCardProps) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const panelId = useId();

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
          <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <span
              className="block h-full rounded-full bg-violet-500 transition-all duration-700"
              style={{ width: levelWidth(category.level) }}
            />
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
          {category.level}
        </span>
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
            {category.nextTarget ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {category.nextTarget}
              </span>
            ) : null}
          </div>
          <p className="text-sm leading-relaxed text-slate-600">{category.feedback}</p>
          {hasDriverDetails(category) ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What is driving this read</p>
              {category.evidenceSignals?.length ? (
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-700">
                  {category.evidenceSignals.map((signal) => (
                    <li key={signal} className="flex gap-2">
                      <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
                      <span>{signal}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {hasUsableSubskills(category) ? (
                <div className={`${category.evidenceSignals?.length ? 'mt-3 border-t border-slate-200 pt-3' : 'mt-2'} space-y-2`}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sub-skill snapshot</p>
                  {category.subskills!.map((subskill) => (
                    <div key={subskill.label}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-slate-700">{subskill.label}</p>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {subskill.level}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white">
                        <div
                          className="h-full rounded-full bg-violet-400 transition-all duration-700"
                          style={{ width: subskillBarWidth(subskill.score) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
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
            <p className="mt-1 text-xs leading-relaxed text-slate-700">{category.actionPlan}</p>
          </div>
          {category.practiceExercise ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Practice this skill</p>
              <p className="mt-1 text-xs leading-relaxed text-violet-950/90">{category.practiceExercise}</p>
            </div>
          ) : null}
          <CriterionLearnLink criterion={category.criterion} onClick={onLearnMore} />
        </div>
      ) : null}
    </article>
  );
}

export function CritiquePanels({
  critique,
  onLearnMore,
  canGenerateAiEdits = false,
  onGenerateAiEditForChange,
  onGenerateAiEditAll,
  previewLoading = false,
  previewLoadingTarget = null,
  previewAllProgress = null,
}: CritiquePanelsProps) {
  return (
    <div className="space-y-3">
      {critique.simple ? (
        <section className="rounded-2xl border border-violet-200/80 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Studio read</p>
          {critique.completionRead ? (
            <div className="mt-3 rounded-xl border border-slate-200/90 bg-slate-50/90 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset ${completionBadgeClasses(critique.completionRead.state)}`}
                >
                  {completionLabel(critique.completionRead.state)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${confidenceBadgeClass(critique.completionRead.confidence)}`}
                  title="How sure the app is about in-progress vs finished, from the photo"
                >
                  {completionConfidenceLabel(critique.completionRead.confidence)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-700">{critique.completionRead.rationale}</p>
              {critique.completionRead.cues.length ? (
                <ul className="mt-2 space-y-1 text-[11px] leading-relaxed text-slate-600">
                  {critique.completionRead.cues.map((cue) => (
                    <li key={cue} className="flex gap-2">
                      <span className="mt-[0.3rem] h-1 w-1 shrink-0 rounded-full bg-slate-400" aria-hidden />
                      <span>{cue}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="mt-3 space-y-4">
            <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Analysis · Voice A</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Critical read — style, medium, and finish level inform tone and emphasis.
              </p>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What works</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{critique.simple.studioAnalysis.whatWorks}</p>
                </div>
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">What could improve</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">
                    {critique.simple.studioAnalysis.whatCouldImprove}
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Changes to make · Voice B</p>
              <p className="mt-1 text-[11px] font-medium text-slate-600">
                Concrete studio moves for this painting. Generate an AI edit to see an illustrative pass for one line or
                for all lines together (saved with the work when you save to Studio).
              </p>
              <ol className="mt-3 space-y-3 text-sm leading-relaxed text-slate-800">
                {critique.simple.studioChanges.map((ch, idx) => {
                  const thisLoading =
                    previewLoading &&
                    previewLoadingTarget?.kind === 'single' &&
                    previewLoadingTarget.changeIndex === idx;
                  return (
                    <li key={`${idx}-${ch.previewCriterion}`} className="flex flex-col gap-2 rounded-lg border border-violet-200/60 bg-white/90 p-3">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="flex min-w-0 flex-1 gap-2">
                          <span className="min-w-[1.25rem] font-semibold text-violet-700">{idx + 1}.</span>
                          <div className="min-w-0 flex-1">
                            <p>{ch.text}</p>
                            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                              Relates to: {ch.previewCriterion}
                            </p>
                          </div>
                        </div>
                        {canGenerateAiEdits && onGenerateAiEditForChange ? (
                          <button
                            type="button"
                            disabled={previewLoading}
                            aria-busy={thisLoading}
                            onClick={() => onGenerateAiEditForChange(idx)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-xs font-bold text-violet-800 shadow-sm transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {thisLoading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Wand2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                            {thisLoading ? 'Generating…' : 'Generate AI edit'}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {canGenerateAiEdits && onGenerateAiEditAll ? (
                <button
                  type="button"
                  disabled={previewLoading}
                  aria-busy={previewLoading && previewLoadingTarget?.kind === 'combined'}
                  onClick={() => onGenerateAiEditAll()}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-violet-400 disabled:text-white"
                >
                  {previewLoading && previewLoadingTarget?.kind === 'combined' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Wand2 className="h-4 w-4" aria-hidden />
                  )}
                  {previewLoading && previewLoadingTarget?.kind === 'combined'
                    ? previewAllProgress
                      ? `Generating all (${previewAllProgress.current}/${previewAllProgress.total})…`
                      : 'Preparing…'
                    : 'Generate AI image with all suggested changes'}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      {critique.photoQuality ? (
        <section
          className={`rounded-2xl border p-4 text-sm ${
            critique.photoQuality.level === 'good'
              ? 'border-emerald-200 bg-emerald-50/80 text-emerald-950'
              : critique.photoQuality.level === 'fair'
                ? 'border-amber-200 bg-amber-50/90 text-amber-950'
                : 'border-red-200 bg-red-50/90 text-red-950'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide">
                Photo quality {critique.photoQuality.level === 'good' ? 'looks solid' : 'needs caution'}
              </p>
              <p className="mt-1 leading-relaxed">{critique.photoQuality.summary}</p>
            </div>
            {critique.overallConfidence ? (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${confidenceBadgeClass(critique.overallConfidence)}`}>
                {confidenceLabel(critique.overallConfidence)}
              </span>
            ) : null}
          </div>
          {critique.photoQuality.issues.length ? (
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">Limits in this photo</p>
              <ul className="mt-1 space-y-1 text-xs leading-relaxed">
                {critique.photoQuality.issues.map((issue) => (
                  <li key={issue} className="flex gap-2">
                    <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {critique.photoQuality.tips.length ? (
            <div className="mt-3">
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">For a better re-shoot</p>
              <ul className="mt-1 space-y-1 text-xs leading-relaxed">
                {critique.photoQuality.tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" aria-hidden />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      {critique.comparisonNote ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <span className="text-xs font-bold uppercase tracking-wide text-amber-800">vs. previous</span>
          <p className="mt-1 leading-relaxed text-amber-950/95">{critique.comparisonNote}</p>
        </div>
      ) : null}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Full critique summary</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{critique.summary}</p>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Detailed criterion breakdown</p>
      {critique.categories.map((category) => (
        <CategoryCard key={category.criterion} category={category} onLearnMore={onLearnMore} />
      ))}
    </div>
  );
}
