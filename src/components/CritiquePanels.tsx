import { CriterionLearnLink } from './CriterionLearnLink';
import { confidenceLabel, levelWidth } from '../critiqueCoach';
import type { CritiqueCategory, CritiqueResult } from '../types';

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
};

function subskillBarWidth(score: number): string {
  return `${Math.max(10, Math.round(score * 100))}%`;
}

function CategoryCard({ category }: CategoryCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{category.criterion}</h3>
        <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800">
          {category.level}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all duration-700"
          style={{ width: levelWidth(category.level) }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
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
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{category.feedback}</p>
      {category.subskills?.length ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sub-skills behind the grade</p>
          <div className="mt-2 space-y-2">
            {category.subskills.map((subskill) => (
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
        </div>
      ) : null}
      {category.evidenceSignals?.length ? (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Why this grade</p>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-700">
            {category.evidenceSignals.map((signal) => (
              <li key={signal} className="flex gap-2">
                <span className="mt-[0.35rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" aria-hidden />
                <span>{signal}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {category.preserve ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Preserve</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-950/90">{category.preserve}</p>
        </div>
      ) : null}
      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Next level</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-700">{category.actionPlan}</p>
      </div>
      {category.practiceExercise ? (
        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/70 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Practice exercise</p>
          <p className="mt-1 text-xs leading-relaxed text-violet-950/90">{category.practiceExercise}</p>
        </div>
      ) : null}
      <CriterionLearnLink criterion={category.criterion} />
    </article>
  );
}

type Props = {
  critique: CritiqueResult;
};

export function CritiquePanels({ critique }: Props) {
  return (
    <div className="space-y-3">
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
      <p className="text-sm leading-relaxed text-slate-600">{critique.summary}</p>
      {critique.categories.map((category) => (
        <CategoryCard key={category.criterion} category={category} />
      ))}
    </div>
  );
}
