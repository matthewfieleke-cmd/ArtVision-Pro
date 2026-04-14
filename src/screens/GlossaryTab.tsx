import { useMemo, useState } from 'react';
import type { CriterionLabel } from '../../shared/criteria';
import type { GlossaryEntry, GlossarySection } from '../glossaryData';
import {
  findGlossaryEntriesForText,
  GLOSSARY_SECTION_ORDER,
  normalizeGlossarySearchText,
  searchGlossaryEntries,
} from '../glossaryData';
import {
  GLOSSARY_FILTER_OPTIONS,
  isCriterionGlossarySection,
} from '../components/glossarySupportOptions';

type Props = {
  isDesktop?: boolean;
};

function CategoryBadge({
  category,
  active,
  onClick,
}: {
  category: GlossarySection | 'All';
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? 'border-violet-300 bg-violet-100 text-violet-800'
          : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700'
      }`}
    >
      {category}
    </button>
  );
}

function EntryCard({ entry }: { entry: GlossaryEntry }) {
  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-slate-900">{entry.term}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {entry.section}
        </span>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-700">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Plain meaning</p>
          <p className="mt-1.5">{entry.definition}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Why it matters</p>
          <p className="mt-1.5">{entry.whyItMatters}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Example in critique</p>
          <p className="mt-1.5 italic text-slate-600">"{entry.critiqueExample}"</p>
        </div>
      </div>
    </article>
  );
}

export function GlossaryTab({ isDesktop = false }: Props) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<GlossarySection | 'All'>('All');
  const normalizedQuery = normalizeGlossarySearchText(query);

  const filteredEntries = useMemo(
    () => searchGlossaryEntries(normalizedQuery, activeCategory),
    [activeCategory, normalizedQuery]
  );

  const groupedByCriterion = useMemo(() => {
    const byCriterion = new Map<CriterionLabel, GlossaryEntry[]>();
    for (const sectionName of GLOSSARY_SECTION_ORDER) {
      if (isCriterionGlossarySection(sectionName)) byCriterion.set(sectionName, []);
    }
    for (const entry of filteredEntries) {
      if (entry.section !== 'General' && byCriterion.has(entry.section)) {
        byCriterion.get(entry.section as CriterionLabel)!.push(entry);
      }
    }
    return byCriterion;
  }, [filteredEntries]);

  const quickAccessEntries = useMemo(
    () =>
      findGlossaryEntriesForText(
        ['anchor passage value edge color temperature focal hierarchy carrier passage'],
        { limit: 6 }
      ),
    []
  );

  return (
    <div
      className={`animate-fade-in text-slate-800 ${isDesktop ? 'min-h-0 flex-1 overflow-y-auto pr-1' : 'px-4 pb-28 pt-4 md:pb-8'}`}
    >
      <header className={isDesktop ? 'mb-6' : 'mb-6 text-center'}>
        <h1 className="font-display text-2xl font-normal tracking-tight text-slate-900 lg:text-3xl">Glossary</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 lg:max-w-2xl">
          Studio terms that appear in critiques. Search for a word, browse by category, or use the example lines to see
          how a term shows up inside the app’s feedback.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Search terms</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search edge, chroma, scumble, focal hierarchy..."
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-violet-300 focus:bg-white"
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <CategoryBadge category="All" active={activeCategory === 'All'} onClick={() => setActiveCategory('All')} />
          {GLOSSARY_FILTER_OPTIONS.filter((category) => category !== 'All').map((category) => (
            <CategoryBadge
              key={category}
              category={category}
              active={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            />
          ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {filteredEntries.length} term{filteredEntries.length === 1 ? '' : 's'} match
          {normalizedQuery ? ` “${query.trim()}”` : ''}.
        </p>
      </section>

      <section className="mt-8 space-y-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-600">All matching terms</h2>
        {filteredEntries.length ? (
          <div className="space-y-4">
            {filteredEntries.map((entry) => (
              <EntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 text-sm leading-relaxed text-slate-600 shadow-sm">
            No glossary terms match that search yet. Try a simpler phrase like “edge,” “value,” or “temperature.”
          </div>
        )}
      </section>

      <section className="mt-10 space-y-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-600">By criterion</h2>
        {GLOSSARY_SECTION_ORDER.filter((sectionName): sectionName is CriterionLabel => sectionName !== 'General').map((criterion) => {
          const entries = groupedByCriterion.get(criterion) ?? [];
          if (!entries.length) return null;
          return (
            <div key={criterion}>
              <h3 className="text-sm font-semibold text-slate-800">{criterion}</h3>
              <div className="mt-3 space-y-4">
                {entries.map((entry) => (
                  <EntryCard key={`${criterion}-${entry.id}`} entry={entry} />
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="mt-10 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-600">Quick access terms</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          These are the terms most likely to appear in critiques and overlays:
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickAccessEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setQuery(entry.term);
                setActiveCategory('All');
              }}
              className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 transition hover:bg-violet-50"
            >
              {entry.term}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
