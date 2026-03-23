import { BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { learnPathForCriterion } from '../data/criterionExcellence';
import type { Criterion } from '../types';

type Props = {
  criterion: Criterion;
  className?: string;
};

export function CriterionLearnLink({ criterion, className }: Props) {
  const to = learnPathForCriterion(criterion);
  return (
    <Link
      to={to}
      className={
        className ??
        'mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 transition hover:text-violet-800'
      }
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
      Learn more
      <span className="sr-only"> about {criterion}</span>
    </Link>
  );
}
