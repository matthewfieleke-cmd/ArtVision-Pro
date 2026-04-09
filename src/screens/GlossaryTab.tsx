import { CRITERIA_ORDER } from '../../shared/criteria';

type Entry = { term: string; definition: string };

const GENERAL: Entry[] = [
  {
    term: 'Anchor / passage',
    definition:
      'A specific, pointable area of the painting (often described as one shape or zone against another). Critiques stay tied to these passages so feedback refers to real places on your canvas.',
  },
  {
    term: 'Value',
    definition:
      'How light or dark something is, independent of hue. “Value structure” is the big-picture arrangement of lights and darks.',
  },
  {
    term: 'Chroma / saturation',
    definition: 'How intense or muted a color is. Low chroma is closer to gray; high chroma is more vivid.',
  },
  {
    term: 'Color temperature',
    definition:
      'Whether a color reads warmer (yellow, orange, red bias) or cooler (blue, green bias) relative to its neighbors—not how “hot” the subject is.',
  },
  {
    term: 'Edge',
    definition:
      'The boundary between two shapes or colors. Edges can be hard, soft, lost, or found; they control where the eye notices contrast.',
  },
  {
    term: 'Lost and found',
    definition:
      'Edges or shapes that appear and disappear—sharp in one stretch, soft or merged in another—often to guide attention.',
  },
  {
    term: 'Brushwork / handling',
    definition:
      'How paint or marks are applied: direction, thickness, wetness, scumble, hatch, etc. Distinct from the subject matter.',
  },
  {
    term: 'Wash',
    definition: 'A thin, often transparent layer of color—common in watercolor and sometimes in thin oil or acrylic.',
  },
  {
    term: 'Impasto / load',
    definition: 'Paint applied thickly so the surface has physical relief and catches light.',
  },
  {
    term: 'Focal hierarchy',
    definition:
      'Which areas read first, second, and later. Not every painting needs one loud center; some distribute attention on purpose.',
  },
];

const BY_CRITERION: Record<string, Entry[]> = {
  'Composition and shape structure': [
    {
      term: 'Big shape / scaffold',
      definition:
        'The main flat or volumetric masses and how they sit in the rectangle—before detail or narrative.',
    },
    {
      term: 'Interval / gap',
      definition: 'The space or rhythm between shapes. Uneven intervals can create tension or confusion.',
    },
  ],
  'Value and light structure': [
    {
      term: 'Key',
      definition: 'The overall value range of the picture—high-key (mostly light), low-key (mostly dark), or full range.',
    },
    {
      term: 'Compression',
      definition:
        'When lights and darks are squeezed into a narrow range; can feel subtle or, if unintended, flat.',
    },
  ],
  'Color relationships': [
    {
      term: 'Harmony vs discord',
      definition:
        'Whether hues relate in a controlled way (kinship, complements, neutrals) or clash in a way that reads intentional or accidental.',
    },
  ],
  'Drawing, proportion, and spatial form': [
    {
      term: 'Proportion / alignment',
      definition:
        'How believably forms occupy space—lengths, tilts, overlaps, and how clearly one thing sits in front of another.',
    },
  ],
  'Edge and focus control': [
    {
      term: 'Selective focus',
      definition:
        'Sharpening or softening edges on purpose so some passages advance and others recede.',
    },
  ],
  'Surface and medium handling': [
    {
      term: 'Tooth / support',
      definition:
        'The texture of paper or canvas that accepts dry or wet media; affects how marks sit and layer.',
    },
  ],
  'Intent and necessity': [
    {
      term: 'Necessity',
      definition:
        'Whether a choice reads inevitable for this picture—what would be lost if you removed or changed it.',
    },
  ],
  'Presence, point of view, and human force': [
    {
      term: 'Point of view',
      definition:
        'Where the viewer seems to stand emotionally and physically—distance, angle, and what the picture addresses.',
    },
  ],
};

type Props = {
  isDesktop?: boolean;
};

export function GlossaryTab({ isDesktop = false }: Props) {
  return (
    <div
      className={`animate-fade-in text-slate-800 ${isDesktop ? 'min-h-0 flex-1 overflow-y-auto pr-1' : 'px-4 pb-28 pt-4 md:pb-8'}`}
    >
      <header className={isDesktop ? 'mb-6' : 'mb-6 text-center'}>
        <h1 className="font-display text-2xl font-normal tracking-tight text-slate-900 lg:text-3xl">Glossary</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 lg:max-w-2xl">
          Terms that appear often in critiques. Wording in the app stays plain; use this screen when a word needs a quick
          studio definition.
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-600">General</h2>
        <dl className="mt-4 space-y-5">
          {GENERAL.map(({ term, definition }) => (
            <div key={term} className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
              <dt className="font-semibold text-slate-900">{term}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">{definition}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-600">By criterion</h2>
        {CRITERIA_ORDER.map((criterion) => {
          const entries = BY_CRITERION[criterion];
          if (!entries?.length) return null;
          return (
            <div key={criterion}>
              <h3 className="text-sm font-semibold text-slate-800">{criterion}</h3>
              <dl className="mt-3 space-y-4">
                {entries.map(({ term, definition }) => (
                  <div key={term} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4">
                    <dt className="font-medium text-slate-900">{term}</dt>
                    <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">{definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </section>
    </div>
  );
}
