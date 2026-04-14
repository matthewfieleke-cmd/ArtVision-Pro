import { Fragment, useMemo, useState } from 'react';
import type { GlossaryEntry, GlossarySection } from '../glossaryData';
import { findGlossaryEntriesForText, GLOSSARY_SECTION_ORDER, searchGlossaryEntries } from '../glossaryData';

export function GlossaryEntryCard({
  entry,
  compact = false,
}: {
  entry: GlossaryEntry;
  compact?: boolean;
}) {
  return (
    <article
      className={
        compact
          ? 'rounded-xl border border-violet-200/80 bg-violet-50/60 p-3'
          : 'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{entry.term}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
          {entry.section}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-700">{entry.definition}</p>
      <div className="mt-3 space-y-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Why it matters</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-700">{entry.whyItMatters}</p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Example in critique</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-700">"{entry.critiqueExample}"</p>
        </div>
      </div>
    </article>
  );
}

export function GlossaryTermChips({
  texts,
  section,
  label = 'Glossary in this section',
}: {
  texts: string[];
  section?: GlossarySection;
  label?: string;
}) {
  const entries = useMemo(
    () => findGlossaryEntriesForText(texts, { section, limit: 4 }),
    [texts, section]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0] ?? null;

  if (!entries.length) return null;

  return (
    <div className="rounded-xl border border-violet-200/70 bg-violet-50/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {entries.map((entry) => {
          const active = entry.id === (selected?.id ?? entries[0]?.id);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                active
                  ? 'border-violet-300 bg-white text-violet-800 shadow-sm'
                  : 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-white'
              }`}
            >
              {entry.term}
            </button>
          );
        })}
      </div>
      {selected ? <div className="mt-3"><GlossaryEntryCard entry={selected} compact /></div> : null}
    </div>
  );
}

export function GlossaryDirectory({
  query,
  section,
}: {
  query: string;
  section: GlossarySection | 'All';
}) {
  const entries = useMemo(() => searchGlossaryEntries(query, section), [query, section]);
  const grouped = useMemo(() => {
    const map = new Map<GlossarySection, GlossaryEntry[]>();
    for (const sectionName of GLOSSARY_SECTION_ORDER) {
      map.set(sectionName, []);
    }
    for (const entry of entries) {
      const bucket = map.get(entry.section) ?? [];
      bucket.push(entry);
      map.set(entry.section, bucket);
    }
    return map;
  }, [entries]);

  if (!entries.length) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-medium text-slate-800">No glossary terms matched.</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          Try a broader search like "edge", "value", or "presence", or switch back to All sections.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {GLOSSARY_SECTION_ORDER.map((sectionName) => {
        const sectionEntries = grouped.get(sectionName) ?? [];
        if (!sectionEntries.length) return null;
        return (
          <section key={sectionName}>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-600">
              {sectionName === 'General' ? 'General' : sectionName}
            </h2>
            <div className="mt-4 space-y-4">
              {sectionEntries.map((entry) => (
                <GlossaryEntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function longestFirst(entries: readonly GlossaryEntry[]): GlossaryEntry[] {
  return [...entries].sort((left, right) => right.term.length - left.term.length);
}

function InlineDefinition({
  entry,
  open,
  onToggle,
}: {
  entry: GlossaryEntry;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <span className="inline">
      <button
        type="button"
        onClick={onToggle}
        className="rounded-sm border-b border-violet-300/80 bg-violet-50/70 px-0.5 text-[0.98em] font-medium text-violet-800 decoration-violet-400 underline-offset-2 transition hover:bg-violet-100/80"
      >
        {entry.term}
      </button>
      {open ? (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 block w-full animate-fade-in rounded-xl border border-violet-200/80 bg-violet-50/70 px-3 py-2 text-left text-xs leading-relaxed text-slate-700 shadow-sm"
        >
          {entry.definition}
        </button>
      ) : null}
    </span>
  );
}

export function InlineGlossaryText({
  text,
  section,
  className = 'whitespace-pre-line text-sm leading-relaxed text-slate-700',
}: {
  text: string;
  section?: GlossarySection;
  className?: string;
}) {
  const entries = useMemo(
    () => longestFirst(findGlossaryEntriesForText([text], { section, limit: 12 })),
    [section, text]
  );
  const [openId, setOpenId] = useState<string | null>(null);

  if (!text.trim() || entries.length === 0) {
    return <p className={className}>{text}</p>;
  }

  const matchers = entries
    .map((entry) => ({
      entry,
      regex: new RegExp(`\\b${escapeRegExp(entry.term)}\\b`, 'i'),
    }))
    .filter((candidate) => candidate.regex.test(text));

  if (!matchers.length) {
    return <p className={className}>{text}</p>;
  }

  const chunks: Array<{ kind: 'text'; value: string } | { kind: 'term'; entry: GlossaryEntry }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    let nextMatch:
      | {
          start: number;
          end: number;
          entry: GlossaryEntry;
        }
      | undefined;

    for (const { entry, regex } of matchers) {
      regex.lastIndex = 0;
      const slice = text.slice(cursor);
      const match = regex.exec(slice);
      if (!match || match.index === undefined) continue;
      const start = cursor + match.index;
      const end = start + match[0].length;
      if (
        !nextMatch ||
        start < nextMatch.start ||
        (start === nextMatch.start && end - start > nextMatch.end - nextMatch.start)
      ) {
        nextMatch = { start, end, entry };
      }
    }

    if (!nextMatch) {
      chunks.push({ kind: 'text', value: text.slice(cursor) });
      break;
    }

    if (nextMatch.start > cursor) {
      chunks.push({ kind: 'text', value: text.slice(cursor, nextMatch.start) });
    }

    chunks.push({ kind: 'term', entry: nextMatch.entry });
    cursor = nextMatch.end;
  }

  return (
    <p className={className}>
      {chunks.map((chunk, index) => {
        if (chunk.kind === 'text') {
          return <Fragment key={`text-${index}`}>{chunk.value}</Fragment>;
        }
        return (
          <InlineDefinition
            key={`term-${chunk.entry.id}-${index}`}
            entry={chunk.entry}
            open={openId === chunk.entry.id}
            onToggle={() => setOpenId((current) => (current === chunk.entry.id ? null : chunk.entry.id))}
          />
        );
      })}
    </p>
  );
}

