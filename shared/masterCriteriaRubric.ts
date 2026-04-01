import type { StyleKey } from './artists.js';
import { CRITERIA_ORDER, RATING_LEVELS, type CriterionLabel, type RatingLevelLabel } from './criteria.js';

export type BandRubric = {
  /** Short bullets for the model; keep concrete and visually checkable in a photo. */
  visibleSignals: string[];
  /** Boundary language: what is still missing before the next band. */
  separatesFromHigher?: string[];
};

/**
 * Criterion-specific rating language used by evidence, calibration, and writing stages.
 * Includes a generic four-band rubric plus style-aware additions and stylization guardrails.
 */
export type CriterionRubric = {
  criterion: CriterionLabel;
  genericBands: Record<RatingLevelLabel, BandRubric>;
  styleSignals: string[];
  stylizationGuardrails: string[];
};

type CriterionRubricSeed = {
  criterion: CriterionLabel;
  styleSignals: string[];
  stylizationGuardrails?: string[];
};

function baseBandRubric(criterion: CriterionLabel): Record<RatingLevelLabel, BandRubric> {
  switch (criterion) {
    case 'Composition and shape structure':
      return {
        Beginner: {
          visibleSignals: [
            'Big shapes feel scattered, accidental, or weakly related to each other.',
            'Focal pull is missing or unstable unless distributed attention still feels controlled.',
            'Stylized flattening or distortion reads as loose placement rather than authored structure.',
          ],
          separatesFromHigher: ['The painting still lacks a dependable large-shape scaffold.'],
        },
        Intermediate: {
          visibleSignals: [
            'Major masses hold together enough to give the eye a usable route.',
            'Some intervals, alignments, or asymmetries feel intentional rather than accidental.',
            'Simplification can be bold, but the picture still keeps enough structural coherence to read deliberately.',
          ],
          separatesFromHigher: ['Secondary shapes still compete or drift enough to weaken the whole design.'],
        },
        Advanced: {
          visibleSignals: [
            'Large-shape organization is strong across most of the rectangle.',
            'Distributed attention, off-center emphasis, or compression still feel controlled rather than merely busy or sparse.',
            'Only selective local refinement remains before the design feels fully inevitable.',
          ],
          separatesFromHigher: ['One or two shape relationships still feel developed rather than exemplary.'],
        },
        Master: {
          visibleSignals: [
            'The entire rectangle feels authored; every major mass and interval belongs to the same compositional logic.',
            'Stylization, asymmetry, openness, or narrative staging all read as fully controlled choices.',
            'No passage feels compositional filler or casually placed.',
          ],
        },
      };
    case 'Value and light structure':
      return {
        Beginner: {
          visibleSignals: [
            'Light and dark groups do not separate convincingly or shift arbitrarily.',
            'Form lighting feels guessy, blunt, or unsupported by the rest of the image.',
            'High contrast or compression may be dramatic, but it does not yet organize the picture clearly.',
          ],
          separatesFromHigher: ['The eye cannot trust the current value pattern to hold the picture together.'],
        },
        Intermediate: {
          visibleSignals: [
            'Main light-dark groups are readable more often than not.',
            'Value decisions support some form or atmosphere, even if local passages remain uncertain.',
            'Stylized value compression still preserves a workable hierarchy.',
          ],
          separatesFromHigher: ['Local value steps still flatten, merge, or overstate important passages.'],
        },
        Advanced: {
          visibleSignals: [
            'The value structure stays coherent across most of the painting and survives a squint test.',
            'Light, compression, or chiaroscuro feel interpreted but controlled.',
            'Only modest local refinement remains in selective passages.',
          ],
          separatesFromHigher: ['A few transitions or emphases still stop short of fully sustained mastery.'],
        },
        Master: {
          visibleSignals: [
            'The value pattern feels inevitable and fully integrated with form, mood, and attention.',
            'Stylized compression or drama remains completely legible and authored.',
            'No meaningful passage needs further light-logic correction.',
          ],
        },
      };
    case 'Color relationships':
      return {
        Beginner: {
          visibleSignals: [
            'Color families clash, drift, or behave without a clear relational logic.',
            'Saturation or bold hue carries attention by loudness rather than by structure.',
            'Expressive or non-natural color may be vivid, but it does not yet hold together as a controlled system.',
          ],
          separatesFromHigher: ['The palette still reads more accidental than intentional.'],
        },
        Intermediate: {
          visibleSignals: [
            'The palette mostly belongs to one world, even if some transitions are abrupt.',
            'Temperature or saturation shifts support parts of the image with partial consistency.',
            'Stylized color choices feel somewhat controlled rather than purely arbitrary.',
          ],
          separatesFromHigher: ['Some passages still need cleaner relational discipline or stronger color hierarchy.'],
        },
        Advanced: {
          visibleSignals: [
            'Color decisions are coherent, purposeful, and supportive across most of the painting.',
            'Bold, muted, symbolic, or naturalistic color all read as chosen rather than defaulted.',
            'Only selective local passages need more precision or subtlety.',
          ],
          separatesFromHigher: ['The chromatic system is strong but not yet fully inexhaustible or inevitable.'],
        },
        Master: {
          visibleSignals: [
            'Color relationships feel fully authored and structurally necessary throughout.',
            'Temperature, saturation, and hue all work together without dead or arbitrary zones.',
            'The palette achieves exceptional unity and distinction at once.',
          ],
        },
      };
    case 'Drawing, proportion, and spatial form':
      return {
        Beginner: {
          visibleSignals: [
            'Placements, proportions, or spatial turns feel unstable or weakly measured.',
            'Stylized distortion reads as inconsistency rather than controlled transformation.',
            'Forms do not hold together convincingly enough to trust the image structure.',
          ],
          separatesFromHigher: ['Large shape relationships are still too unreliable for a higher band.'],
        },
        Intermediate: {
          visibleSignals: [
            'Major placements mostly hold and the image has a usable underlying structure.',
            'Proportions or spatial cues read intentionally more often than not.',
            'Stylization still preserves enough internal order to feel partly controlled.',
          ],
          separatesFromHigher: ['Secondary passages still break down under closer structural scrutiny.'],
        },
        Advanced: {
          visibleSignals: [
            'Shape placement and structural logic remain persuasive across most of the work.',
            'Stylization bends structure without forfeiting conviction.',
            'Only local passages show developmental rather than exemplary command.',
          ],
          separatesFromHigher: ['A few turns, alignments, or intervals still stop short of total authority.'],
        },
        Master: {
          visibleSignals: [
            'Proportion, structure, and spatial intelligence feel fully authored throughout.',
            'Even strong stylization transforms form without losing exact control.',
            'No passage suggests unresolved construction.',
          ],
        },
      };
    case 'Edge and focus control':
      return {
        Beginner: {
          visibleSignals: [
            'Hard and soft edges feel accidental, uniformly scattered, or disconnected from the image priorities.',
            'Lost edges read as uncertainty rather than intention.',
            'Blur, roughness, or stylized diffusion do not yet organize attention convincingly.',
          ],
          separatesFromHigher: ['The picture still lacks a dependable first-read hierarchy.'],
        },
        Intermediate: {
          visibleSignals: [
            'Some passages clearly win attention and some edge changes support that hierarchy.',
            'Softness can be useful in places, but control is uneven across the whole image.',
            'Stylized edges feel partially authored rather than entirely incidental.',
          ],
          separatesFromHigher: ['Hierarchy still drifts or weakens in too many secondary passages.'],
        },
        Advanced: {
          visibleSignals: [
            'Edge hierarchy is deliberate across most of the painting.',
            'Distributed attention, softness, or rough handling still preserve a readable focus logic.',
            'Only local refinements remain in selective transitions.',
          ],
          separatesFromHigher: ['A few transitions still feel strong rather than fully inevitable.'],
        },
        Master: {
          visibleSignals: [
            'Edge control is inseparable from the painting pictorial logic.',
            'Ambiguity, softness, sharpness, or diffusion all feel completely authored.',
            'No edge passage feels casually handled or mechanically resolved.',
          ],
        },
      };
    case 'Surface and medium handling':
      return {
        Beginner: {
          visibleSignals: [
            'Marks or material behavior feel hesitant, inconsistent, or disconnected from form.',
            'The medium is used generically rather than according to its strengths.',
            'Painterly roughness or simplification does not yet read as controlled surface intelligence.',
          ],
          separatesFromHigher: ['The surface still reads as under-controlled for this medium.'],
        },
        Intermediate: {
          visibleSignals: [
            'The medium behaves credibly in several passages, with some purposeful mark or layer decisions.',
            'Handling supports parts of the image even if consistency drops elsewhere.',
            'Stylized surface activity feels partly selected rather than purely uncontrolled.',
          ],
          separatesFromHigher: ['The surface still includes avoidable dead, noisy, or under-resolved passages.'],
        },
        Advanced: {
          visibleSignals: [
            'Material handling is convincing and supports the image across most passages.',
            'Economy, revision, layering, or touch all feel largely intentional for the declared medium.',
            'Only selective areas need more refinement or integration.',
          ],
          separatesFromHigher: ['Some passages still show strong handling rather than exceptional inevitability.'],
        },
        Master: {
          visibleSignals: [
            'Surface intelligence is fully integrated with structure, form, and mood.',
            'The medium is used at an exemplary level rather than merely competently.',
            'No passage feels generic, dead, or mechanically overworked.',
          ],
        },
      };
    case 'Intent and necessity':
      return {
        Beginner: {
          visibleSignals: [
            'Formal decisions do not yet add up to one convincing pictorial aim.',
            'Stylized choices may be vivid, but they do not behave like one coherent system.',
            'The work reads more accidental, copied, or improvised than necessary.',
          ],
          separatesFromHigher: ['The image still lacks a stable internal why.'],
        },
        Intermediate: {
          visibleSignals: [
            'There is a readable aim or direction, and several formal decisions support it.',
            'The picture feels partly coherent even if some choices seem generic or unresolved.',
            'Stylization begins to read as selective rather than random.',
          ],
          separatesFromHigher: ['Too many decisions still feel available to swap out without changing the painting point.'],
        },
        Advanced: {
          visibleSignals: [
            'Most decisions feel subordinate to one clear pictorial logic or emotional aim.',
            'The work stylization, realism, restraint, or excess all support its own terms.',
            'Only selective passages still feel less necessary than the strongest ones.',
          ],
          separatesFromHigher: ['The work is strong, but not every choice yet feels wholly inevitable.'],
        },
        Master: {
          visibleSignals: [
            'The painting feels fully necessary on its own terms; form and purpose are inseparable.',
            'No major decision feels ornamental, generic, or replaceable.',
            'The work reads as exemplary conviction rather than just strong execution.',
          ],
        },
      };
    case 'Presence, point of view, and human force':
      return {
        Beginner: {
          visibleSignals: [
            'The work has little sustained point of view beyond basic subject statement or noise.',
            'Expressive distortion or mood does not yet carry conviction.',
            'Human, atmospheric, or emotional pressure feels generic, tentative, or borrowed.',
          ],
          separatesFromHigher: ['The painting does not yet compel attention through a distinct way of seeing.'],
        },
        Intermediate: {
          visibleSignals: [
            'A viewpoint or mood is present and intermittently convincing.',
            'The image carries some pressure or atmosphere beyond simple description.',
            'Stylization begins to feel personal rather than merely rough or loud.',
          ],
          separatesFromHigher: ['The work presence still weakens in too many passages or feels only partly owned.'],
        },
        Advanced: {
          visibleSignals: [
            'The painting clearly carries a distinct point of view, mood, or human pressure.',
            'The way of seeing remains persuasive across most of the image, not just one focal zone.',
            'Only modest local passages feel less fully inhabited than the strongest ones.',
          ],
          separatesFromHigher: ['The work is memorable, but not yet wholly inseparable from an authored voice.'],
        },
        Master: {
          visibleSignals: [
            'A distinct voice governs the work from edge to edge.',
            'Human force, atmosphere, or pictorial presence feels fully inhabited and unforgettable.',
            'The subject and treatment seem inseparable at an exemplary level.',
          ],
        },
      };
  }
}

const DEFAULT_STYLIZATION_GUARDRAILS: Partial<Record<CriterionLabel, string[]>> = {
  'Composition and shape structure': [
    'Flatness, distortion, or asymmetry stay Beginner when the big-shape logic still feels unstable.',
  ],
  'Value and light structure': [
    'Dramatic contrast or expressive compression do not rise above Beginner unless they still organize the image clearly.',
  ],
  'Color relationships': [
    'Bold hue or saturation is not enough; color must still behave as a controlled relational system.',
  ],
  'Drawing, proportion, and spatial form': [
    'Distortion only counts as stylization when the structural logic remains convincing inside the chosen mode.',
  ],
  'Edge and focus control': [
    'Rough, soft, or diffuse edges stay low when they dissolve hierarchy accidentally instead of authoring attention.',
  ],
  'Surface and medium handling': [
    'Visible texture, scratch, or speed do not raise the band unless the medium still feels controlled.',
  ],
  'Intent and necessity': [
    'Symbolic marks, simplification, or expressive noise remain Beginner when they do not add up to one pictorial aim.',
  ],
  'Presence, point of view, and human force': [
    'Emotional temperature stays low if the image feels merely loud, awkward, or borrowed rather than inhabited.',
  ],
};

const REALISM_SIGNALS: CriterionRubricSeed[] = [
  {
    criterion: 'Composition and shape structure',
    styleSignals: [
      'Frieze or pyramid grouping with clear figure-ground and measured spatial depth can support Master in realism.',
      'Mirror, doorway, and multi-figure staging should still feel structurally accountable rather than merely busy.',
    ],
  },
  {
    criterion: 'Value and light structure',
    styleSignals: [
      'Big readable masses, differentiated dark families, and believable reflected light separate Advanced from Master in realism.',
      'Spotlit drama, compressed dusk, or luminous interior light only count high when form and hierarchy remain exact.',
    ],
  },
  {
    criterion: 'Color relationships',
    styleSignals: ['Restrained harmony, temperature logic in greys, and chromatic restraint that still feels alive support higher bands.'],
  },
  {
    criterion: 'Drawing, proportion, and spatial form',
    styleSignals: ['Construction, anatomy, and architecture must still hold under close scrutiny; stylized realism cannot hide weak placement.'],
  },
  {
    criterion: 'Edge and focus control',
    styleSignals: ['Selective sharpness, softened recession, and lost edges in flesh or fabric must all feel optically exact rather than generic.'],
  },
  {
    criterion: 'Surface and medium handling',
    styleSignals: ['Facture should support description without deadening the surface; shorthand and finish need to feel equally authored.'],
  },
  {
    criterion: 'Intent and necessity',
    styleSignals: ['Realism reads higher when observation, staging, and facture all serve one lived or social point rather than generic polish.'],
  },
  {
    criterion: 'Presence, point of view, and human force',
    styleSignals: ['Higher bands require more than likeness; the work must carry a distinct way of seeing or human weight.'],
  },
];

const IMPRESSIONISM_SIGNALS: CriterionRubricSeed[] = [
  {
    criterion: 'Composition and shape structure',
    styleSignals: ['Casual crops and open design only count high when the big intervals still feel placed rather than incidental.'],
  },
  {
    criterion: 'Value and light structure',
    styleSignals: ['Light may be high-key or broken, but the picture still needs a legible value scaffold beneath the atmosphere.'],
  },
  {
    criterion: 'Color relationships',
    styleSignals: ['Broken color, complement vibration, and domestic palette shifts should feel relationally controlled, not muddied.'],
  },
  {
    criterion: 'Drawing, proportion, and spatial form',
    styleSignals: ['Open drawing still needs enough structural accountability to keep gesture, figure, or landscape from collapsing.'],
  },
  {
    criterion: 'Edge and focus control',
    styleSignals: ['Lost edges in light and found edges in silhouette should feel timed and selective rather than merely soft.'],
  },
  {
    criterion: 'Surface and medium handling',
    styleSignals: ['Touch, dash, or patch should read as disciplined notation, not as repetitive busyness or under-finished surface.'],
  },
  {
    criterion: 'Intent and necessity',
    styleSignals: ['Apparent spontaneity only rises high when crop, light, and touch all answer the same sensation of the moment.'],
  },
  {
    criterion: 'Presence, point of view, and human force',
    styleSignals: ['Atmosphere, weather, intimacy, or leisure should carry a specific lived viewpoint rather than generic prettiness.'],
  },
];

const EXPRESSIONISM_SIGNALS: CriterionRubricSeed[] = [
  {
    criterion: 'Composition and shape structure',
    styleSignals: ['Distortion, diagonal stress, or iconic centrality only read high when the image still holds together as one pressure system.'],
  },
  {
    criterion: 'Value and light structure',
    styleSignals: ['Non-natural value can score high only when it still creates hierarchy, emotional staging, or graphic conviction.'],
  },
  {
    criterion: 'Color relationships',
    styleSignals: ['Feverish or symbolic color needs internal logic; loud chroma alone is not enough.'],
  },
  {
    criterion: 'Drawing, proportion, and spatial form',
    styleSignals: ['Elongation and exposed structure must intensify the image rather than reveal weak construction.'],
  },
  {
    criterion: 'Edge and focus control',
    styleSignals: ['Nervous contour, blunt blocks, or haloed impasto only rise high when they still guide attention deliberately.'],
  },
  {
    criterion: 'Surface and medium handling',
    styleSignals: ['Scratch, drag, and overwrite should feel chosen for emotional temperature rather than merely rough.'],
  },
  {
    criterion: 'Intent and necessity',
    styleSignals: ['Distortion, color, and energy must all serve one emotional pressure; otherwise the work stays lower.'],
  },
  {
    criterion: 'Presence, point of view, and human force',
    styleSignals: ['Roughness can still be Master only when it intensifies conviction instead of reading unresolved by accident.'],
  },
];

const ABSTRACT_SIGNALS: CriterionRubricSeed[] = [
  {
    criterion: 'Composition and shape structure',
    styleSignals: ['All-over rhythm, stacked intervals, or open-field abstraction only count high when the whole rectangle feels governed.'],
  },
  {
    criterion: 'Value and light structure',
    styleSignals: ['Close-value fields or luminous stain must still create active space rather than sleepy sameness.'],
  },
  {
    criterion: 'Color relationships',
    styleSignals: ['Color must behave as a system with high stakes per plane, interval, or chord—not as attractive but arbitrary parts.'],
  },
  {
    criterion: 'Drawing, proportion, and spatial form',
    styleSignals: ['Non-representational spacing still needs accountable interval logic; abstraction does not exempt weak proportion.'],
  },
  {
    criterion: 'Edge and focus control',
    styleSignals: ['Feathered stain, knife edges, or linear skeins should all feel specific to the abstract structure, not leftover artifacts.'],
  },
  {
    criterion: 'Surface and medium handling',
    styleSignals: ['Drip, pour, sand, veil, or graphic flatness only rise high when the surface reads as a disciplined system.'],
  },
  {
    criterion: 'Intent and necessity',
    styleSignals: ['Abstraction reaches higher bands when intervals, color, and gesture all obey one pictorial law.'],
  },
  {
    criterion: 'Presence, point of view, and human force',
    styleSignals: ['Reduction, ornament, or gesture should still generate inhabited presence rather than novelty alone.'],
  },
];

const STYLE_SIGNAL_SEEDS: Record<StyleKey, CriterionRubricSeed[]> = {
  Realism: REALISM_SIGNALS,
  Impressionism: IMPRESSIONISM_SIGNALS,
  Expressionism: EXPRESSIONISM_SIGNALS,
  'Abstract Art': ABSTRACT_SIGNALS,
};

function buildStyleRubric(style: StyleKey): CriterionRubric[] {
  const seeds = STYLE_SIGNAL_SEEDS[style];
  return CRITERIA_ORDER.map((criterion) => {
    const seed = seeds.find((row) => row.criterion === criterion);
    return {
      criterion,
      genericBands: baseBandRubric(criterion),
      styleSignals: seed?.styleSignals ?? [],
      stylizationGuardrails: seed?.stylizationGuardrails ?? DEFAULT_STYLIZATION_GUARDRAILS[criterion] ?? [],
    };
  });
}

const BY_STYLE: Record<StyleKey, CriterionRubric[]> = {
  Realism: buildStyleRubric('Realism'),
  Impressionism: buildStyleRubric('Impressionism'),
  Expressionism: buildStyleRubric('Expressionism'),
  'Abstract Art': buildStyleRubric('Abstract Art'),
};

export function getCriterionRubric(style: string, criterion: CriterionLabel): CriterionRubric | null {
  const key = style as StyleKey;
  const rows = BY_STYLE[key];
  if (!rows) return null;
  return rows.find((row) => row.criterion === criterion) ?? null;
}

export function getCriterionMasterSignals(style: string, criterion: CriterionLabel): string[] {
  const rubric = getCriterionRubric(style, criterion);
  if (!rubric) return [];
  return [...rubric.genericBands.Master.visibleSignals, ...rubric.styleSignals];
}

/** Full four-band rubric block for prompts. */
export function formatRubricForPrompt(style: string): string {
  const key = style as StyleKey;
  const rows = BY_STYLE[key];
  if (!rows) return '';
  return rows
    .map((row) => {
      const parts: string[] = [`${row.criterion}:`];
      for (const band of RATING_LEVELS) {
        const rubric = row.genericBands[band];
        parts.push(`- ${band}: ${rubric.visibleSignals.join(' ')}`);
        if (rubric.separatesFromHigher?.length) {
          parts.push(`  Not yet higher because: ${rubric.separatesFromHigher.join(' ')}`);
        }
      }
      if (row.styleSignals.length) {
        parts.push(`- Style-aware signals for ${style}: ${row.styleSignals.join(' ')}`);
      }
      if (row.stylizationGuardrails.length) {
        parts.push(`- Stylization guardrails: ${row.stylizationGuardrails.join(' ')}`);
      }
      return parts.join('\n');
    })
    .join('\n\n');
}

function assertRubricOrder(): void {
  for (const style of Object.keys(BY_STYLE) as StyleKey[]) {
    const rubric = BY_STYLE[style];
    if (rubric.length !== CRITERIA_ORDER.length) throw new Error(`Rubric length mismatch for ${style}`);
    const seen = new Set(rubric.map((row) => row.criterion));
    for (const criterion of CRITERIA_ORDER) {
      if (!seen.has(criterion)) {
        throw new Error(`Rubric criterion missing at ${style}: ${criterion}`);
      }
    }
    for (const row of rubric) {
      for (const band of RATING_LEVELS) {
        if (!row.genericBands[band] || row.genericBands[band].visibleSignals.length === 0) {
          throw new Error(`Rubric band missing at ${style} / ${row.criterion} / ${band}`);
        }
      }
    }
  }
}

assertRubricOrder();
