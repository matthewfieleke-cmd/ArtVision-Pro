import type {
  CompletionRead,
  CritiqueCategory,
  CritiqueResult,
  CritiqueSimpleFeedback,
  Criterion,
  CritiqueSubskill,
  Medium,
  PhotoQualityAssessment,
  RatingLevel,
  Style,
} from './types';
import { ARTISTS_BY_STYLE, CRITERIA } from './types';
import {
  deriveLocalCategoryConfidence,
  deriveLocalEvidenceSignals,
  deriveLocalPracticeExercise,
  deriveLocalPreserveText,
  finalizeCritiqueResult,
} from './critiqueCoach';
import type { ImageMetrics } from './imageMetrics';
import { clamp01, computeImageMetrics } from './imageMetrics';
import { deriveLocalCompletionRead } from './paintingCompletion';

function scoreToLevel(score: number): RatingLevel {
  if (score < 0.28) return 'Beginner';
  if (score < 0.52) return 'Intermediate';
  if (score < 0.78) return 'Advanced';
  return 'Master';
}

function normalizeCritiqueSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Match API shape: 2+ numbered steps grounded in this capture (template + metric-tied move). */
function combineLocalActionPlan(templateAction: string, specificStep: string): string {
  const a = normalizeCritiqueSpaces(templateAction);
  const b = normalizeCritiqueSpaces(specificStep);
  if (!a) return `1. ${b}`;
  if (!b) return `1. ${a}`;
  return `1. ${a}\n2. ${b}`;
}

/** 3+ sentences: evidence-style cues from metrics, level read, then benchmark (mirrors API feedback depth). */
function buildLocalCategoryFeedback(
  criterion: Criterion,
  templateFeedback: string,
  evidenceSignals: string[],
  benchmarks: readonly string[],
  style: Style
): string {
  const label = criterion.toLowerCase();
  const parts = evidenceSignals.map((s) => s.trim()).filter((s) => s.length > 0).slice(0, 2);
  const p1 =
    parts.length >= 2
      ? `On this capture, signals that feed the ${label} read include: ${parts[0]!} ${parts[1]!.endsWith('.') ? parts[1]! : `${parts[1]!}.`}`
      : parts.length === 1
        ? `On this capture, one signal behind the ${label} read is: ${parts[0]!.endsWith('.') ? parts[0]! : `${parts[0]!}.`}`
        : `This offline read infers ${label} from measurable structure in the photo (contrast, edges, color, texture—not subject recognition).`;
  const p2 = templateFeedback.trim();
  const m0 = benchmarks[0] ?? 'the named masters for this style';
  const m1 = benchmarks[1] ?? m0;
  const p3 = `Compare your next choices to ${m0} and ${m1} as ${style} reference points for how far to push ${label}.`;
  return normalizeCritiqueSpaces(`${p1} ${p2} ${p3}`);
}

type LocalCategoryScore = {
  score: number;
  level: RatingLevel;
  subskills: CritiqueSubskill[];
};

const CATEGORY_THRESHOLDS: Record<Criterion, readonly [number, number, number]> = {
  'Composition and shape structure': [0.33, 0.56, 0.78],
  'Value and light structure': [0.34, 0.58, 0.8],
  'Color relationships': [0.3, 0.55, 0.78],
  'Drawing, proportion, and spatial form': [0.4, 0.63, 0.84],
  'Edge and focus control': [0.32, 0.56, 0.8],
  'Surface and medium handling': [0.3, 0.55, 0.78],
  'Intent and necessity': [0.32, 0.56, 0.79],
  'Presence, point of view, and human force': [0.36, 0.6, 0.82],
};

function centeredScore(value: number, target: number, tolerance: number): number {
  return clamp01(1 - Math.abs(value - target) / tolerance);
}

function subskill(label: string, score: number): CritiqueSubskill {
  const bounded = clamp01(score);
  return {
    label,
    score: bounded,
    level: scoreToLevel(bounded),
  };
}

function categoryLevel(criterion: Criterion, score: number): RatingLevel {
  const [beginnerCutoff, intermediateCutoff, advancedCutoff] = CATEGORY_THRESHOLDS[criterion];
  if (score < beginnerCutoff) return 'Beginner';
  if (score < intermediateCutoff) return 'Intermediate';
  if (score < advancedCutoff) return 'Advanced';
  return 'Master';
}

function assessPhotoQuality(m: ImageMetrics): PhotoQualityAssessment {
  const issues: string[] = [];
  const tips: string[] = [];

  if (m.contrast < 0.1) {
    issues.push('Low contrast makes value grouping harder to judge.');
    tips.push('Re-shoot in diffuse light and avoid glare so lights and darks separate more clearly.');
  }
  if (m.edgeDensity < 0.1) {
    issues.push('Soft focus or camera distance reduces structural detail.');
    tips.push('Move closer, square the phone to the canvas, and let the camera refocus before capturing.');
  }
  if (m.edgeBalance > 0.34) {
    issues.push('Too many sharp accents may come from texture glare or a busy crop.');
    tips.push('Crop to the painting edges and reduce side-light reflections on textured passages.');
  }
  if (m.saturationMean < 0.04) {
    issues.push('Muted color capture limits confidence in palette advice.');
    tips.push('Use neutral daylight or correct white balance before trusting color critique.');
  }
  if (m.highlightClip > 0.02) {
    issues.push('Bright glare or overexposure is clipping highlight passages.');
    tips.push('Tilt the camera to avoid reflections and lower exposure until bright paint still shows shape.');
  }
  if (m.shadowClip > 0.02) {
    issues.push('Shadow passages are clipping too dark to judge clearly.');
    tips.push('Add softer fill light or raise exposure until dark masses keep visible separation.');
  }
  if (m.borderActivity > 0.22) {
    issues.push('The frame edge looks busy, suggesting background clutter or an incomplete crop.');
    tips.push('Fill more of the frame with the painting and trim away wall, easel, and surrounding objects.');
  }
  if (m.centerFocus < 0.34 && m.focalOffset > 0.58) {
    issues.push('The capture may be skewed or off-axis, making structure harder to compare fairly.');
    tips.push('Stand square to the canvas and keep the lens centered so the rectangle reads evenly.');
  }

  const level =
    issues.length >= 4
      ? 'poor'
      : issues.length >= 2
        ? 'fair'
        : 'good';

  const summary =
    level === 'good'
      ? 'Photo quality looks solid enough for a useful critique.'
      : level === 'fair'
        ? 'This critique is usable, but a cleaner photo would make some judgments more trustworthy.'
        : 'Photo quality is limiting the critique; treat lower-confidence categories as provisional.';

  return {
    level,
    summary,
    issues,
    tips,
  };
}

function styleMediumBias(style: Style, medium: Medium): Record<Criterion, number> {
  const base: Record<Criterion, number> = {
    'Composition and shape structure': 0,
    'Value and light structure': 0,
    'Color relationships': 0,
    'Drawing, proportion, and spatial form': 0,
    'Edge and focus control': 0,
    'Surface and medium handling': 0,
    'Intent and necessity': 0,
    'Presence, point of view, and human force': 0,
  };

  if (style === 'Impressionism') {
    base['Color relationships'] += 0.06;
    base['Edge and focus control'] += 0.05;
    base['Surface and medium handling'] += 0.05;
    base['Value and light structure'] -= 0.03;
  }
  if (style === 'Expressionism') {
    base['Presence, point of view, and human force'] += 0.08;
    base['Drawing, proportion, and spatial form'] -= 0.04;
    base['Surface and medium handling'] += 0.04;
  }
  if (style === 'Abstract Art') {
    base['Composition and shape structure'] += 0.05;
    base['Intent and necessity'] += 0.05;
    base['Drawing, proportion, and spatial form'] -= 0.06;
  }
  if (medium === 'Pastel') {
    base['Edge and focus control'] += 0.06;
    base['Surface and medium handling'] -= 0.02;
  }
  if (medium === 'Drawing') {
    base['Edge and focus control'] -= 0.05;
    base['Drawing, proportion, and spatial form'] += 0.06;
  }
  if (medium === 'Watercolor') {
    base['Value and light structure'] += 0.04;
    base['Edge and focus control'] += 0.04;
  }
  if (medium === 'Oil on Canvas') {
    base['Surface and medium handling'] += 0.04;
  }
  if (medium === 'Acrylic') {
    base['Surface and medium handling'] += 0.04;
    base['Edge and focus control'] += 0.02;
  }

  return base;
}

function categoryBreakdown(
  criterion: Criterion,
  metrics: ImageMetrics,
  bias: Record<Criterion, number>
): LocalCategoryScore {
  let subskills: CritiqueSubskill[] = [];
  let score = 0;

  switch (criterion) {
    case 'Composition and shape structure': {
      subskills = [
        subskill(
          'Focal hierarchy',
          0.7 * centeredScore(metrics.focalOffset, 0.3, 0.32) +
            0.3 * clamp01(1 - metrics.edgeBalance * 1.05)
        ),
        subskill(
          'Big-shape clarity',
          0.55 * metrics.valueSpread + 0.45 * metrics.contrast
        ),
        subskill(
          'Eye-path control',
          0.55 * centeredScore(metrics.edgeDensity, 0.24, 0.24) +
            0.45 * clamp01(1 - metrics.edgeBalance)
        ),
      ];
      score =
        0.38 * subskills[0]!.score +
        0.34 * subskills[1]!.score +
        0.28 * subskills[2]!.score +
        bias['Composition and shape structure'];
      break;
    }
    case 'Value and light structure': {
      subskills = [
        subskill('Light-dark grouping', metrics.valueSpread),
        subskill(
          'Contrast range',
          0.7 * metrics.contrast + 0.3 * centeredScore(metrics.edgeDensity, 0.22, 0.22)
        ),
        subskill(
          'Midtone restraint',
          clamp01(1 - metrics.saturationStd * 1.25)
        ),
      ];
      score =
        0.46 * subskills[0]!.score +
        0.34 * subskills[1]!.score +
        0.2 * subskills[2]!.score +
        bias['Value and light structure'];
      break;
    }
    case 'Color relationships': {
      subskills = [
        subskill('Palette harmony', metrics.colorHarmony),
        subskill(
          'Chroma control',
          centeredScore(metrics.saturationStd, 0.12, 0.14)
        ),
        subskill(
          'Accent strength',
          clamp01(metrics.saturationMean * 1.35)
        ),
      ];
      score =
        0.42 * subskills[0]!.score +
        0.31 * subskills[1]!.score +
        0.27 * subskills[2]!.score +
        bias['Color relationships'];
      break;
    }
    case 'Drawing, proportion, and spatial form': {
      subskills = [
        subskill(
          'Big-shape placement',
          0.6 * metrics.edgeDensity + 0.4 * metrics.contrast
        ),
        subskill(
          'Plane separation',
          0.55 * metrics.contrast + 0.45 * metrics.valueSpread
        ),
        subskill(
          'Structural restraint',
          clamp01(1 - metrics.textureScore * 0.55)
        ),
      ];
      score =
        0.39 * subskills[0]!.score +
        0.36 * subskills[1]!.score +
        0.25 * subskills[2]!.score +
        bias['Drawing, proportion, and spatial form'];
      break;
    }
    case 'Edge and focus control': {
      subskills = [
        subskill(
          'Hard-soft range',
          centeredScore(metrics.edgeDensity, 0.28, 0.28)
        ),
        subskill(
          'Focal edge concentration',
          centeredScore(metrics.edgeBalance, 0.18, 0.2)
        ),
        subskill('Value support', metrics.valueSpread),
      ];
      score =
        0.34 * subskills[0]!.score +
        0.42 * subskills[1]!.score +
        0.24 * subskills[2]!.score +
        bias['Edge and focus control'];
      break;
    }
    case 'Surface and medium handling': {
      subskills = [
        subskill('Mark energy', metrics.textureScore),
        subskill('Mark separation', metrics.edgeDensity),
        subskill(
          'Handling control',
          0.55 * centeredScore(metrics.edgeBalance, 0.2, 0.22) +
            0.45 * centeredScore(metrics.textureScore, 0.2, 0.2)
        ),
      ];
      score =
        0.4 * subskills[0]!.score +
        0.28 * subskills[1]!.score +
        0.32 * subskills[2]!.score +
        bias['Surface and medium handling'];
      break;
    }
    case 'Intent and necessity': {
      subskills = [
        subskill(
          'Internal coherence',
          0.45 * metrics.colorHarmony +
            0.3 * clamp01(1 - metrics.edgeBalance * 1.1) +
            0.25 * centeredScore(metrics.saturationStd, 0.12, 0.16)
        ),
        subskill(
          'Hierarchy discipline',
          0.55 * centeredScore(metrics.focalOffset, 0.3, 0.32) +
            0.45 * clamp01(1 - metrics.edgeBalance)
        ),
        subskill(
          'Decision economy',
          0.55 * clamp01(1 - metrics.borderActivity * 1.8) +
            0.45 * clamp01(1 - metrics.textureScore * 0.6)
        ),
      ];
      score =
        0.4 * subskills[0]!.score +
        0.34 * subskills[1]!.score +
        0.26 * subskills[2]!.score +
        bias['Intent and necessity'];
      break;
    }
    case 'Presence, point of view, and human force': {
      subskills = [
        subskill(
          'Atmospheric pressure',
          0.45 * metrics.textureScore +
            0.3 * clamp01(metrics.saturationStd * 1.2) +
            0.25 * centeredScore(metrics.valueSpread, 0.24, 0.2)
        ),
        subskill(
          'Focal conviction',
          0.55 * centeredScore(metrics.focalOffset, 0.32, 0.34) +
            0.45 * metrics.centerFocus
        ),
        subskill(
          'Expressive risk',
          0.4 * clamp01(metrics.saturationStd * 1.35) +
            0.35 * metrics.textureScore +
            0.25 * metrics.focalOffset
        ),
      ];
      score =
        0.38 * subskills[0]!.score +
        0.34 * subskills[1]!.score +
        0.28 * subskills[2]!.score +
        bias['Presence, point of view, and human force'];
      break;
    }
  }

  const bounded = clamp01(score);
  return {
    score: bounded,
    level: categoryLevel(criterion, bounded),
    subskills,
  };
}

function buildPaintingSpecificAction(
  criterion: Criterion,
  level: RatingLevel,
  medium: Medium,
  metrics: ImageMetrics,
  evidenceSignals: string[]
): string {
  const where = evidenceSignals[0]?.trim() || 'the busiest visible area of this painting';
  const second = evidenceSignals[1]?.trim();

  const mediumPhrase =
    medium === 'Drawing'
      ? 'line weight and value grouping'
      : medium === 'Watercolor'
        ? 'wash edges and reserved lights'
        : medium === 'Pastel'
          ? 'stroke pressure and layering on the tooth'
          : 'edge weight and a small temperature or value shift';

  switch (criterion) {
    case 'Composition and shape structure': {
      if (level === 'Master') {
        return `Where ${where}${second ? ` and ${second}` : ''}, keep the current rhythm but nudge one supporting mass slightly so the loop of attention feels a touch more intentional.`;
      }
      if (metrics.focalOffset < 0.28) {
        return `Because ${where}, shift the strongest focal pull slightly off dead-center and tie one secondary shape to it with a repeated direction or value echo so the path through the image is easier to follow.`;
      }
      return `Where ${where}, reduce competing accents in one peripheral zone—softer value or fewer small marks—so the main motif reads first without flattening the whole layout.`;
    }
    case 'Value and light structure': {
      if (level === 'Master') {
        return `Hold the big value pattern you already have; refine only one halftone transition ${second ? `near ${second}` : 'along a major turning form'} so the form reads more cleanly without breaking the squint read.`;
      }
      if (metrics.valueSpread < 0.2) {
        return `Because ${where}, separate one key light shape from what sits behind it with a modest value step so the masses still read when you step back.`;
      }
      return `Where ${where}, group shadow families into fewer steps and let one carefully placed accent (highlight or deep note) clarify which plane leads.`;
    }
    case 'Color relationships': {
      if (level === 'Master') {
        return `Keep the palette world defined by ${where}; adjust chroma or temperature in one narrow band ${second ? `against ${second}` : 'at a major transition'} so vibration stays controlled.`;
      }
      if (metrics.colorHarmony < 0.55) {
        return `Where ${where}, limit mixes and decide warm-versus-cool dominance for that passage so neighboring hues stop competing as separate ideas.`;
      }
      return `Along the boundary implied by ${where}${second ? ` and ${second}` : ''}, shift temperature slightly so the transition describes space instead of flattening into one hue.`;
    }
    case 'Drawing, proportion, and spatial form': {
      if (level === 'Master') {
        return `Deepen overlap or silhouette poetry ${second ? `around ${second}` : ''} while keeping the read you already trust in ${where}.`;
      }
      return `Rebuild the weakest big-shape relationship ${where} with plumb lines or halves before detail, then match angles to the strongest silhouette you already believe in${second ? ` and check it against ${second}` : ''}.`;
    }
    case 'Edge and focus control': {
      if (level === 'Master') {
        return `Keep selective sharpness; try one short lost edge ${where} so mystery increases without losing hierarchy.`;
      }
      if (metrics.edgeBalance > 0.28) {
        return `Where ${where}, soften or lose edges in secondary areas and reserve your hardest edge for the one contour that should win the first read.`;
      }
      return `Along ${where}, sharpen one strategic contour and soften the competing neighbor so focus and depth stop asking for equal attention.`;
    }
    case 'Surface and medium handling': {
      if (level === 'Master') {
        return `Refine quieter passages so the boldest handling ${where} reads as choice, not noise.`;
      }
      return `In ${where}, use larger, committed marks for the big planes and repeat only 3–4 stroke types so ${medium.toLowerCase()} reads deliberate instead of scrubbed or hesitant.`;
    }
    case 'Intent and necessity': {
      if (level === 'Master') {
        return `Protect the necessity already visible ${where}; take one measured risk in a supporting passage so the whole still reads as one argument.`;
      }
      return `Using ${where} as your anchor, remove or quiet one passage that still feels decorative relative to the main aim, then rebuild the biggest shapes so every major decision serves the same idea.`;
    }
    case 'Presence, point of view, and human force': {
      if (level === 'Master') {
        return `Protect the mood carried by ${where}; deepen it with one pacing or silence choice instead of adding more descriptive detail.`;
      }
      return `Name the pressure you want from ${where}, then change one concrete thing there—${mediumPhrase}—so the feeling reads as authored, not accidental.`;
    }
    default:
      return `In ${where}, make one focused adjustment using ${mediumPhrase} so this area supports the rest of the painting more clearly.`;
  }
}

function buildCategory(
  criterion: Criterion,
  level: RatingLevel,
  style: Style,
  medium: Medium,
  benchmarks: readonly string[],
  metrics: ImageMetrics,
  subskills: CritiqueSubskill[]
): CritiqueCategory {
  const masterNames = benchmarks.join(', ');
  const evidenceSignals = deriveLocalEvidenceSignals(criterion, metrics);
  const templates: Record<
    Criterion,
    Record<RatingLevel, { feedback: string; action: string }>
  > = {
    'Composition and shape structure': {
      Beginner: {
        feedback: `The arrangement reads as scattered: focal pull and rhythm are hard to follow at a glance.`,
        action: `Thumbnail in 3–5 big shapes. Shift the main interest off dead-center (rule of thirds) and repeat one directional cue (line or value) to lead the eye—study how ${masterNames} stage the main motif.`,
      },
      Intermediate: {
        feedback: `A clear subject exists, but secondary accents compete or the frame feels static.`,
        action: `Reduce one busy area with softer value or fewer details; strengthen a single entry path into the picture. Compare your structure to a strong compositional read in ${masterNames}.`,
      },
      Advanced: {
        feedback: `Structure holds together: major masses and focal hierarchy are mostly intentional.`,
        action: `Fine-tune spacing and edge priority so the eye moves in a loop, not a ping-pong. Push one area of deliberate asymmetry for tension, as in mature work by ${masterNames}.`,
      },
      Master: {
        feedback: `The composition feels authoritative: rhythm, balance, and focal emphasis work as a unified statement.`,
        action: `Keep this clarity while experimenting with subtler counter-rhythms in supporting passages—at the Master tier, ${masterNames} reward both control and surprise.`,
      },
    },
    'Value and light structure': {
      Beginner: {
        feedback: `Lights and darks collapse together; the image loses readability when you squint.`,
        action: `Group shadows into fewer values and separate one key light shape from the background. Squint test until you see 3–5 major value masses, then compare to the legible light logic in ${masterNames}.`,
      },
      Intermediate: {
        feedback: `Some value separation appears, but key areas still merge or flatten inconsistently.`,
        action: `Choose the darkest dark and lightest light you need for the idea, then hold midtones in service of that range. Push shadow families darker in temperature-neutral ways (medium-dependent).`,
      },
      Advanced: {
        feedback: `Value pattern supports the story; major masses read at distance.`,
        action: `Refine halftone transitions so form turns without losing the big pattern. Add one carefully placed accent (highlight or deep accent) for punch—study restraint in ${masterNames}.`,
      },
      Master: {
        feedback: `Value orchestration feels inevitable: emphasis, depth, and atmosphere align.`,
        action: `Maintain this discipline while exploring subtler compression in selected passages—Master-level work by ${masterNames} often hides complexity inside simple reads.`,
      },
    },
    'Color relationships': {
      Beginner: {
        feedback: `Color feels accidental or muddied; harmony and contrast are not yet steering mood.`,
        action: `Limit palette (fewer mixes per passage). Decide warm vs cool dominance per area and use complements for neutralizing, not random browns. Reference controlled palettes in ${masterNames}.`,
      },
      Intermediate: {
        feedback: `There are promising hues, but relationships wobble (over-neutralized shadows or competing accents).`,
        action: `Map major colors to roles: sky key, ground key, accent. Tie shadow temperature to light source logic for ${medium.toLowerCase()}.`,
      },
      Advanced: {
        feedback: `Color supports form and mood with clear intent; temperature shifts feel considered.`,
        action: `Introduce one sophisticated chord (related tertiary accents) while preserving overall harmony—study restrained vibration in ${masterNames}.`,
      },
      Master: {
        feedback: `Color operates as structure and poetry together; harmony and tension feel authored.`,
        action: `Continue risking a single bold relational move (edge-of-gamut accent or subtle temperature flip) while keeping the whole painting in one “world,” as in ${masterNames}.`,
      },
    },
    'Drawing, proportion, and spatial form': {
      Beginner: {
        feedback: `Forms, alignment, or spatial cues feel uncertain unless distortion is clearly intentional.`,
        action: `Check major angles and proportions with simple plumb lines and halving. For ${style}, decide whether accuracy or expressive distortion serves the idea—benchmark clarity in ${masterNames}.`,
      },
      Intermediate: {
        feedback: `Drawing mostly holds, but a few spatial or proportional slips weaken conviction.`,
        action: `Isolate the weakest shape relationship and rebuild it with construction lines before surface detail. Compare spatial clarity in ${masterNames}.`,
      },
      Advanced: {
        feedback: `Underlying structure reads convincingly; perspective or figure logic is largely sound.`,
        action: `Refine micro-proportions and overlaps that sell weight and contact. If distorting, push it consistently so it reads as style, not accident—see ${masterNames}.`,
      },
      Master: {
        feedback: `Drawing intelligence shows: accuracy or distortion reads as a deliberate voice.`,
        action: `Deepen spatial poetry (overlap, silhouette, edge of form) while keeping readability—study how ${masterNames} bend rules without breaking the image.`,
      },
    },
    'Edge and focus control': {
      Beginner: {
        feedback: `Edges are mostly uniform—everything shouts or everything recedes equally.`,
        action: `Choose hard edges only for priorities; soften or lose edges in secondary areas. For ${medium}, exploit natural soft transitions. Study edge hierarchy in ${masterNames}.`,
      },
      Intermediate: {
        feedback: `Some edge variety appears, but transitions do not yet direct attention reliably.`,
        action: `Map a simple edge plan: sharp where you want staccato, soft for atmosphere, lost for depth. Compare transitions in focal vs peripheral areas to ${masterNames}.`,
      },
      Advanced: {
        feedback: `Edges largely support depth and focus; lost-and-found passages begin to sing.`,
        action: `Sharpen one strategic contour and soften a competing one; check background integration. Refine the “second read” edges that ${masterNames} hide in plain sight.`,
      },
      Master: {
        feedback: `Edge behavior feels sophisticated: selective sharpness and poetic softness coexist.`,
        action: `Maintain hierarchy while exploring one risky lost edge that increases mystery—Master painters like ${masterNames} use restraint as a spotlight.`,
      },
    },
    'Surface and medium handling': {
      Beginner: {
        feedback: `Marks feel hesitant, overworked, or generic relative to the subject.`,
        action: `Practice larger, committed strokes for big shapes; save detail passes for last. Match mark size to form scale—look at economical handling in ${masterNames}.`,
      },
      Intermediate: {
        feedback: `Handling shows effort, but consistency between areas (wet/dry, thick/thin) wavers.`,
        action: `Define a simple mark vocabulary for this piece (3–4 stroke types) and repeat them. For ${medium}, exploit its native strengths instead of fighting the surface.`,
      },
      Advanced: {
        feedback: `Surface treatment supports the subject; marks feel increasingly purposeful.`,
        action: `Vary impasto or pressure on focal passages only; let supporting areas breathe. Study how ${masterNames} reserve the “loudest” handling for key moments.`,
      },
      Master: {
        feedback: `The surface feels alive and intentional—marks carry meaning, not just texture.`,
        action: `Keep this confidence while refining quieter passages so brilliance reads as choice, not noise—${masterNames} model that balance.`,
      },
    },
    'Intent and necessity': {
      Beginner: {
        feedback: `The painting shows effort, but its decisions do not yet feel like they belong to one clear aim. Different passages ask for different kinds of attention, so the work reads as several partial ideas rather than one necessity.`,
        action: `Write one sentence about what this piece is trying to do, then remove or quiet one passage that is not serving that aim. Rebuild the biggest shapes first so the whole picture shares one clear purpose, as in ${masterNames}.`,
      },
      Intermediate: {
        feedback: `The painting has a direction, but some accents, color notes, or handling choices still feel borrowed rather than necessary. The main issue is not effort; it is that the picture has not fully decided what matters most.`,
        action: `Choose the one passage that best states the picture's aim, then simplify competing passages around it. Let repetition, emphasis, and contrast answer to that central idea instead of treating each area as equally important.`,
      },
      Advanced: {
        feedback: `Most of the painting now feels like one argument rather than a collection of effects. Where it still slips is in secondary decisions that slightly weaken the main intent.`,
        action: `Trim one decorative or redundant move, then reinforce the painting's strongest internal logic in shape, value, or rhythm. Compare how ${masterNames} make every major decision feel tied to the same ambition.`,
      },
      Master: {
        feedback: `The painting feels necessary: form, handling, and emphasis belong to the same intent. It reads as a chosen world rather than a pile of good parts.`,
        action: `Protect that necessity while taking one measured risk that deepens the picture rather than decorating it. At this tier, ${masterNames} keep surprise inside coherence.`,
      },
    },
    'Presence, point of view, and human force': {
      Beginner: {
        feedback: `The painting reads as competent observation more than a felt point of view. It may describe the subject, but it does not yet press a mood, a presence, or a way of seeing strongly enough.`,
        action: `Name the mood or human pressure you want, then change one concrete thing to support it: value emphasis, color temperature, edge, or surface handling. Study how ${masterNames} make a picture feel necessary, not just accurate.`,
      },
      Intermediate: {
        feedback: `A point of view is starting to appear, but it competes with safer habits. The result is that the work feels partly alive and partly generic.`,
        action: `Identify the passage where the painting feels most alive, then let that passage set the tone for the next revision. Remove or quiet one expected move that flattens the work back into competence.`,
      },
      Advanced: {
        feedback: `The painting carries a recognizable mood and point of view. What remains is to make that presence more inevitable by strengthening the passages that hold attention after the first read.`,
        action: `Amplify one signature choice in surface, atmosphere, or emphasis while simplifying any passage that reads merely descriptive. Look at how ${masterNames} keep presence without tipping into theater.`,
      },
      Master: {
        feedback: `The painting has real presence: it feels seen, inhabited, and authored. Technical control and point of view are supporting one another rather than competing.`,
        action: `Protect that human force while taking one deeper risk in pacing, atmosphere, or silence. At this level, ${masterNames} make the work memorable by what they refuse to over-explain.`,
      },
    },
  };

  const t = templates[criterion][level];
  const specificStep = buildPaintingSpecificAction(criterion, level, medium, metrics, evidenceSignals);
  return {
    criterion,
    level,
    feedback: buildLocalCategoryFeedback(criterion, t.feedback, evidenceSignals, benchmarks, style),
    actionPlan: combineLocalActionPlan(t.action, specificStep),
    confidence: deriveLocalCategoryConfidence(criterion, metrics),
    evidenceSignals,
    preserve: deriveLocalPreserveText(criterion, level, metrics),
    practiceExercise: deriveLocalPracticeExercise(criterion, style, medium),
    subskills,
  };
}

function compareMetrics(
  prev: ImageMetrics,
  next: ImageMetrics,
  prevLevels: Record<Criterion, RatingLevel>,
  nextLevels: Record<Criterion, RatingLevel>
): string {
  const order: RatingLevel[] = ['Beginner', 'Intermediate', 'Advanced', 'Master'];
  const rank = (l: RatingLevel) => order.indexOf(l);

  const improved: string[] = [];
  const regressed: string[] = [];
  for (const c of CRITERIA) {
    const d = rank(nextLevels[c]) - rank(prevLevels[c]);
    if (d > 0) improved.push(c);
    if (d < 0) regressed.push(c);
  }

  const valueDelta = next.valueSpread - prev.valueSpread;
  const edgeDelta = next.edgeDensity - prev.edgeDensity;
  const texDelta = next.textureScore - prev.textureScore;

  const bits: string[] = [];
  if (improved.length) {
    bits.push(
      `Compared to your saved version, ratings moved up in: ${improved.join(', ')}.`
    );
  }
  if (regressed.length) {
    bits.push(`Some categories dipped: ${regressed.join(', ')}—re-check those areas on the same lighting setup.`);
  }
  if (Math.abs(valueDelta) > 0.04) {
    bits.push(
      valueDelta > 0
        ? 'Overall value separation looks stronger in this photo—good for readability.'
        : 'Value separation reads a bit flatter than before; check lighting glare and exposure when you reshoot.'
    );
  }
  if (Math.abs(edgeDelta) > 0.04) {
    bits.push(
      edgeDelta > 0
        ? 'Edge activity increased—ensure hard edges still serve focal priority.'
        : 'Edges look softer overall—if intentional, lean into atmosphere; if not, verify focus and lighting.'
    );
  }
  if (Math.abs(texDelta) > 0.05) {
    bits.push(
      texDelta > 0
        ? 'Surface variation increased—marks read more actively in this capture.'
        : 'Surface reads smoother—could be lighting or blending; compare at the same distance from the canvas.'
    );
  }
  if (!bits.length) {
    return `This pass is close to your previous capture on measurable structure. For fair comparison, use similar lighting, distance, and crop when reshooting.`;
  }
  return bits.join(' ');
}

function mainIssueFromScores(scores: Record<Criterion, LocalCategoryScore>): Criterion {
  return CRITERIA.reduce((lowest, criterion) =>
    scores[criterion].score < scores[lowest].score ? criterion : lowest
  );
}

function strongestCategory(scores: Record<Criterion, LocalCategoryScore>): Criterion {
  return CRITERIA.reduce((best, criterion) =>
    scores[criterion].score > scores[best].score ? criterion : best
  );
}

function intentRead(style: Style, medium: Medium, strongest: Criterion): string {
  const styleRead: Record<Style, string> = {
    Realism: 'build a believable world through clear structure and observed form',
    Impressionism: 'capture light, atmosphere, and shifting sensation without losing coherence',
    Expressionism: 'push mood and pictorial pressure through deliberate distortion and handling',
    'Abstract Art': 'organize shape, rhythm, and color into a self-sustaining pictorial system',
  };
  const strongestRead: Record<Criterion, string> = {
    'Composition and shape structure': 'Right now its clearest strength is the way it tries to organize attention.',
    'Value and light structure': 'Right now its clearest strength is the way light and dark masses begin to lock together.',
    'Color relationships': 'Right now its clearest strength is the way palette and temperature start to carry the mood.',
    'Drawing, proportion, and spatial form': 'Right now its clearest strength is the attempt to make form and placement feel convincing.',
    'Edge and focus control': 'Right now its clearest strength is the way edge shifts begin to direct the eye.',
    'Surface and medium handling': 'Right now its clearest strength is the way the surface starts to speak through the marks.',
    'Intent and necessity': 'Right now its clearest strength is the attempt to hold the whole together without going dead.',
    'Presence, point of view, and human force': 'Right now its clearest strength is the mood or point of view starting to come through.',
  };
  return `This ${medium.toLowerCase()} ${style.toLowerCase()} study seems to be trying to ${styleRead[style]}. ${strongestRead[strongest]}`;
}

function workingBullets(
  strongest: Criterion,
  strongestLevel: RatingLevel,
  photoQuality: PhotoQualityAssessment
): string[] {
  const byCriterion: Record<Criterion, string> = {
    'Composition and shape structure': 'The large shape layout already gives the eye a place to land instead of wandering everywhere.',
    'Value and light structure': 'The big light-dark read is starting to hold when you step back from the painting.',
    'Color relationships': 'The palette already lives in one believable family instead of drifting into unrelated color notes.',
    'Drawing, proportion, and spatial form': 'The main shape placement is stable enough that you can correct weaker passages off it.',
    'Edge and focus control': 'A few passages already separate focus from support through edge changes.',
    'Surface and medium handling': 'Some marks already feel committed and useful instead of overworked.',
    'Intent and necessity': 'The picture already has a repeating idea that helps the whole hang together.',
    'Presence, point of view, and human force': 'There is already a mood or point of view worth protecting.',
  };
  const levelText =
    strongestLevel === 'Master'
      ? 'That strength already reads as a real asset in the painting, not just a partial success.'
      : strongestLevel === 'Advanced'
        ? 'That area is carrying more of the picture than the others right now.'
        : 'That gives you a reliable place to build from while you correct weaker structure elsewhere.';
  const photoText =
    photoQuality.level === 'good'
      ? 'The photo is clear enough that these reads are reasonably trustworthy.'
      : 'Even with capture limits, that strength still comes through.';
  return [byCriterion[strongest], levelText, photoText];
}

function mainIssueText(criterion: Criterion): string {
  const map: Record<Criterion, string> = {
    'Composition and shape structure':
      'The main thing holding the painting back is composition: the eye path and hierarchy are not clear enough yet, so the painting does not fully tell you where to look or why.',
    'Value and light structure':
      'The main thing holding the painting back is value structure: the big light and dark masses are not separating clearly enough, so the painting loses force when you step back.',
    'Color relationships':
      'The main thing holding the painting back is color relationships: the palette is not yet organized enough to carry the mood, the space, and the main idea together.',
    'Drawing, proportion, and spatial form':
      'The main thing holding the painting back is drawing and proportion: shape relationships are not stable enough yet, so the painting cannot fully convince as a built form or image.',
    'Edge and focus control':
      'The main thing holding the painting back is edge control: too many passages have the same edge weight, so focus and atmosphere are fighting each other.',
    'Surface and medium handling':
      'The main thing holding the painting back is handling: the marks do not yet feel selective enough, so the surface works harder than it needs to.',
    'Intent and necessity':
      'The main thing holding the painting back is unity and variety: the painting is not yet balancing repetition and contrast cleanly, so parts of it separate instead of belonging to one world.',
    'Presence, point of view, and human force':
      'The main thing holding the painting back is expressive force: the painting does not yet press its point of view strongly enough, so it reads as competent before it reads as necessary.',
  };
  return map[criterion];
}

function firstNumberedStepFromActionPlan(actionPlan: string): string {
  const lines = actionPlan.split('\n').map((l) => l.trim()).filter(Boolean);
  const first = lines[0] ?? actionPlan.trim();
  return first.replace(/^\d+\.\s*/, '').trim();
}

function buildLocalStudioRead(
  style: Style,
  medium: Medium,
  titlePrefix: string,
  strongest: Criterion,
  strongestLevel: RatingLevel,
  mainIssue: Criterion,
  mainIssueCategory: CritiqueCategory,
  metrics: ImageMetrics,
  photoQuality: PhotoQualityAssessment,
  completionRead: CompletionRead,
  categories: CritiqueCategory[],
  scores: Record<Criterion, LocalCategoryScore>
): CritiqueSimpleFeedback {
  const pWhatWorksA = `${titlePrefix}${intentRead(style, medium, strongest)}`;
  const pWhatWorksB = workingBullets(strongest, strongestLevel, photoQuality).join(' ');
  const whatWorks = `${pWhatWorksA}\n\n${pWhatWorksB}`;

  const completionLead =
    completionRead.state === 'unfinished'
      ? 'From the finish read on this photo, the work still looks in progress—bias your next moves toward resolving big structure before polish.'
      : completionRead.state === 'likely_finished'
        ? 'From the finish read on this photo, the piece looks relatively resolved—bias toward selective refinements rather than rebuilding everything.'
        : 'The finish read on this photo is mixed—treat both structural and refinement moves as fair game, but test each change against the squint read.';

  const mainSig0 = mainIssueCategory.evidenceSignals?.[0]?.trim();
  const mainSig1 = mainIssueCategory.evidenceSignals?.[1]?.trim();
  const mainEvidenceBit =
    mainSig0 && mainSig1
      ? ` Observable cues here include ${mainSig0.endsWith('.') ? mainSig0.slice(0, -1) : mainSig0}; ${mainSig1.charAt(0).toLowerCase()}${mainSig1.slice(1)}`
      : mainSig0
        ? ` A visible tension in the capture is ${mainSig0.charAt(0).toLowerCase()}${mainSig0.slice(1)}`
        : '';
  const whatCouldImprove = `${completionLead} ${mainIssueText(mainIssue)}${mainEvidenceBit}`;

  const LEVEL_RANK: Record<RatingLevel, number> = {
    Beginner: 0,
    Intermediate: 1,
    Advanced: 2,
    Master: 3,
  };
  const sortedByWeakness = [...categories].sort((a, b) => {
    const lr = LEVEL_RANK[a.level] - LEVEL_RANK[b.level];
    if (lr !== 0) return lr;
    const sr = scores[a.criterion].score - scores[b.criterion].score;
    if (sr !== 0) return sr;
    return a.criterion.localeCompare(b.criterion);
  });

  const studioChanges: CritiqueSimpleFeedback['studioChanges'] = [];
  const used = new Set<string>();

  for (const cat of sortedByWeakness) {
    if (studioChanges.length >= 4) break;
    const sigs = cat.evidenceSignals ?? [];
    const step = buildPaintingSpecificAction(cat.criterion, cat.level, medium, metrics, sigs);
    const key = `${cat.criterion}:${step}`;
    if (used.has(key)) continue;
    used.add(key);
    studioChanges.push({ text: step, previewCriterion: cat.criterion });
  }

  while (studioChanges.length < 2) {
    const cat = sortedByWeakness[studioChanges.length] ?? sortedByWeakness[0]!;
    const step = firstNumberedStepFromActionPlan(cat.actionPlan);
    studioChanges.push({ text: step, previewCriterion: cat.criterion });
  }

  if (photoQuality.level !== 'good') {
    studioChanges.push({
      text: `Re-shoot under even, glare-free light so the next pass can judge ${photoQuality.level === 'poor' ? 'values and edges' : 'subtle shifts'} the way the API critique would.`,
      previewCriterion: 'Surface and medium handling',
    });
  }

  return {
    studioAnalysis: { whatWorks, whatCouldImprove },
    studioChanges: studioChanges.slice(0, 5),
  };
}

export async function analyzePainting(
  imageDataUrl: string,
  style: Style,
  medium: Medium,
  previous?: { imageDataUrl: string; critique: CritiqueResult },
  paintingTitle?: string
): Promise<CritiqueResult> {
  const benchmarks = ARTISTS_BY_STYLE[style];
  const bias = styleMediumBias(style, medium);

  const m = await computeImageMetrics(imageDataUrl);
  const scores = Object.fromEntries(
    CRITERIA.map((criterion) => [criterion, categoryBreakdown(criterion, m, bias)])
  ) as Record<Criterion, LocalCategoryScore>;
  const photoQuality = assessPhotoQuality(m);

  const categories: CritiqueCategory[] = CRITERIA.map((c) =>
    buildCategory(c, scores[c].level, style, medium, benchmarks, m, scores[c].subskills)
  );
  const mainIssue = mainIssueFromScores(scores);
  const strongest = strongestCategory(scores);
  const strongestCategoryCard = categories.find((c) => c.criterion === strongest) ?? categories[0]!;
  const mainIssueCategory = categories.find((c) => c.criterion === mainIssue) ?? categories[0]!;
  const avg =
    Object.values(scores).reduce((a, b) => a + b.score, 0) / CRITERIA.length;
  const completionRead = deriveLocalCompletionRead(m, avg, photoQuality);
  const completionSummaryPrefix =
    completionRead.state === 'unfinished'
      ? 'This capture reads like work still in progress—prioritize big structure and major passages before worrying about final polish. '
      : completionRead.state === 'likely_finished'
        ? 'This capture reads relatively resolved—bias feedback toward selective refinements and protecting what already reads strong. '
        : '';
  const titlePrefix =
    paintingTitle && paintingTitle.trim().length > 0 ? `For “${paintingTitle.trim()}”: ` : '';
  const summary =
    completionSummaryPrefix +
    (avg < 0.35
      ? `${titlePrefix}Strong foundation pass—prioritize big-shape composition and value readability next. Benchmark “Master” here means the technical and expressive bar set by ${benchmarks.slice(0, 2).join(' and ')}.`
      : avg < 0.55
        ? `${titlePrefix}You are in a solid intermediate zone: intention shows; tighten hierarchy and edge/color decisions. Use ${benchmarks[0]} and ${benchmarks[1]} as touchstones for the next push.`
        : avg < 0.75
          ? `${titlePrefix}Advanced territory—refine selective emphasis and poetic edges; protect the clear read you already have. Compare finishing choices to ${benchmarks[2]} and ${benchmarks[3]}.`
          : `${titlePrefix}Master-adjacent read on this capture—keep editing with the same clarity of intent. The named masters (${benchmarks.join(', ')}) remain your north stars for depth and voice.`);

  let comparisonNote: string | undefined;
  if (previous) {
    const pm = await computeImageMetrics(previous.imageDataUrl);
    const pScores = Object.fromEntries(
      CRITERIA.map((criterion) => [criterion, categoryBreakdown(criterion, pm, bias)])
    ) as Record<Criterion, LocalCategoryScore>;
    const prevLevels = Object.fromEntries(
      CRITERIA.map((c) => [c, pScores[c].level])
    ) as Record<Criterion, RatingLevel>;
    const nextLevels = Object.fromEntries(
      CRITERIA.map((c) => [c, scores[c].level])
    ) as Record<Criterion, RatingLevel>;
    comparisonNote = compareMetrics(pm, m, prevLevels, nextLevels);
  }

  const trimmed = paintingTitle?.trim();
  return finalizeCritiqueResult({
    categories,
    summary,
    comparisonNote,
    simple: buildLocalStudioRead(
      style,
      medium,
      titlePrefix,
      strongest,
      strongestCategoryCard.level,
      mainIssue,
      mainIssueCategory,
      m,
      photoQuality,
      completionRead,
      categories,
      scores
    ),
    analysisSource: 'local',
    photoQuality,
    completionRead,
    ...(trimmed ? { paintingTitle: trimmed } : {}),
  });
}
