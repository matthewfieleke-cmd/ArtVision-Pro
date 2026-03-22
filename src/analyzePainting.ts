import type {
  CritiqueCategory,
  CritiqueResult,
  Criterion,
  Medium,
  RatingLevel,
  Style,
} from './types';
import { ARTISTS_BY_STYLE, CRITERIA } from './types';

type Metrics = {
  contrast: number; // 0-1 normalized
  edgeBalance: number; // how much soft vs hard (0 all soft, 1 all hard) - we'll use edge density
  edgeDensity: number;
  colorHarmony: number; // lower variance in hue might mean muddy OR controlled - we'll use saturation spread
  saturationMean: number;
  saturationStd: number;
  focalOffset: number; // 0-1 how far visual "mass" is from center
  valueSpread: number; // luminance std
  textureScore: number; // local luminance variance (brushwork proxy)
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return { h, s, l };
}

async function computeMetrics(dataUrl: string, sampleSize = 256): Promise<Metrics> {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('Image load failed'));
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No 2d context');
  ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
  const { data, width, height } = ctx.getImageData(0, 0, sampleSize, sampleSize);

  const lumas: number[] = [];
  const sats: number[] = [];
  let sumL = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const L = luminance(r, g, b);
    lumas.push(L);
    sumL += L;
    const { s } = rgbToHsl(r, g, b);
    sats.push(s);
  }
  const n = lumas.length;
  const meanL = sumL / n;
  let varL = 0;
  for (const L of lumas) varL += (L - meanL) ** 2;
  const stdL = Math.sqrt(varL / n);
  const valueSpread = clamp01(stdL / 80);

  let edgeSum = 0;
  let edgeStrong = 0;
  let localVarSum = 0;
  const idx = (x: number, y: number) => (y * width + x) * 4;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y);
      const Lc = luminance(data[i], data[i + 1], data[i + 2]);
      const Lr = luminance(
        data[i + 4],
        data[i + 5],
        data[i + 6]
      );
      const Ld = luminance(
        data[idx(x, y + 1)],
        data[idx(x, y + 1) + 1],
        data[idx(x, y + 1) + 2]
      );
      const gx = Math.abs(Lc - Lr);
      const gy = Math.abs(Lc - Ld);
      const mag = gx + gy;
      edgeSum += mag;
      if (mag > 28) edgeStrong += 1;
      const patch: number[] = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const j = idx(x + dx, y + dy);
          patch.push(luminance(data[j], data[j + 1], data[j + 2]));
        }
      }
      const pm = patch.reduce((a, b) => a + b, 0) / patch.length;
      localVarSum += patch.reduce((a, p) => a + (p - pm) ** 2, 0) / patch.length;
    }
  }
  const cells = (width - 2) * (height - 2);
  const edgeDensity = clamp01((edgeSum / cells) / 45);
  const edgeBalance = cells ? edgeStrong / cells : 0;

  const meanS = sats.reduce((a, b) => a + b, 0) / sats.length;
  let varS = 0;
  for (const s of sats) varS += (s - meanS) ** 2;
  const stdS = Math.sqrt(varS / sats.length);
  const colorHarmony = clamp01(1 - Math.min(1, stdS * 1.8));
  const saturationMean = meanS;
  const saturationStd = stdS;

  // Focal: weight high edge magnitude toward pixel position
  let wx = 0;
  let wy = 0;
  let wsum = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = idx(x, y);
      const Lc = luminance(data[i], data[i + 1], data[i + 2]);
      const Lr = luminance(data[i + 4], data[i + 5], data[i + 6]);
      const Ld = luminance(
        data[idx(x, y + 1)],
        data[idx(x, y + 1) + 1],
        data[idx(x, y + 1) + 2]
      );
      const w = Math.abs(Lc - Lr) + Math.abs(Lc - Ld);
      wx += x * w;
      wy += y * w;
      wsum += w;
    }
  }
  const cx = wsum ? wx / wsum : width / 2;
  const cy = wsum ? wy / wsum : height / 2;
  const dx = (cx - width / 2) / width;
  const dy = (cy - height / 2) / height;
  const focalOffset = clamp01(Math.sqrt(dx * dx + dy * dy) * 2);

  const textureScore = clamp01((localVarSum / cells) / 400);
  const contrast = clamp01(stdL / 70);

  return {
    contrast,
    edgeBalance,
    edgeDensity,
    colorHarmony,
    saturationMean,
    saturationStd,
    focalOffset,
    valueSpread,
    textureScore,
  };
}

function scoreToLevel(score: number): RatingLevel {
  if (score < 0.28) return 'Beginner';
  if (score < 0.52) return 'Intermediate';
  if (score < 0.78) return 'Advanced';
  return 'Master';
}

function styleMediumBias(style: Style, medium: Medium): Record<Criterion, number> {
  const base: Record<Criterion, number> = {
    Composition: 0,
    'Value structure': 0,
    'Color relationships': 0,
    'Drawing and proportion': 0,
    'Edge control': 0,
    'Brushwork / handling': 0,
    'Unity and variety': 0,
    'Originality / expressive force': 0,
  };

  if (style === 'Impressionism') {
    base['Color relationships'] += 0.06;
    base['Edge control'] += 0.05;
    base['Brushwork / handling'] += 0.05;
    base['Value structure'] -= 0.03;
  }
  if (style === 'Expressionism') {
    base['Originality / expressive force'] += 0.08;
    base['Drawing and proportion'] -= 0.04;
    base['Brushwork / handling'] += 0.04;
  }
  if (style === 'Abstract Art') {
    base.Composition += 0.05;
    base['Unity and variety'] += 0.05;
    base['Drawing and proportion'] -= 0.06;
  }
  if (medium === 'Pastel') {
    base['Edge control'] += 0.06;
    base['Brushwork / handling'] -= 0.02;
  }
  if (medium === 'Drawing') {
    base['Edge control'] -= 0.05;
    base['Drawing and proportion'] += 0.06;
  }
  if (medium === 'Watercolor') {
    base['Value structure'] += 0.04;
    base['Edge control'] += 0.04;
  }
  if (medium === 'Oil on Canvas') {
    base['Brushwork / handling'] += 0.04;
  }

  return base;
}

function buildCategory(
  criterion: Criterion,
  level: RatingLevel,
  style: Style,
  medium: Medium,
  benchmarks: string[]
): CritiqueCategory {
  const masterNames = benchmarks.slice(0, 3).join(', ');
  const templates: Record<
    Criterion,
    Record<RatingLevel, { feedback: string; action: string }>
  > = {
    Composition: {
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
    'Value structure': {
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
    'Drawing and proportion': {
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
    'Edge control': {
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
    'Brushwork / handling': {
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
    'Unity and variety': {
      Beginner: {
        feedback: `The piece either fragments (too many small accents) or flattens (not enough contrast).`,
        action: `Unify with repeated shapes/values/colors; add variety through one controlled axis (scale, temperature, or edge). Study how ${masterNames} repeat motifs with variation.`,
      },
      Intermediate: {
        feedback: `Unity is forming, but variety still fights the whole or feels repetitive.`,
        action: `Group smaller shapes into larger families; introduce one contrasting motif (shape or temperature) for spark. Check overall silhouette strength.`,
      },
      Advanced: {
        feedback: `The painting holds together while retaining visual interest in key contrasts.`,
        action: `Tune micro-contrasts so they echo the main theme—reduce orphan details. Compare motif repetition vs invention in ${masterNames}.`,
      },
      Master: {
        feedback: `Unity and variety feel inseparable: contrast serves the whole without noise.`,
        action: `Experiment with one subtle echo (shape/color) across distant areas to deepen coherence—${masterNames} often hide these “threads.”`,
      },
    },
    'Originality / expressive force': {
      Beginner: {
        feedback: `The work reads as careful study or generic execution more than a distinct point of view.`,
        action: `Choose one emotional adjective for the piece and push lighting, color, or mark-making to serve it. Study how ${masterNames} risk a clear stance.`,
      },
      Intermediate: {
        feedback: `Personality is emerging, but the idea competes with habits or reference defaults.`,
        action: `Remove one “expected” choice (default sky, default palette) and replace it with a decision that supports your intent for ${style}.`,
      },
      Advanced: {
        feedback: `A recognizable voice is present; technical control supports expression.`,
        action: `Amplify one signature move (silhouette, temperature story, mark rhythm) while trimming elements that dilute it—see how ${masterNames} edit ruthlessly.`,
      },
      Master: {
        feedback: `The painting carries presence: technical strength meets a memorable point of view.`,
        action: `Protect the core idea while exploring adjacent risks in series work—${masterNames} sustain identity across exploration.`,
      },
    },
  };

  const t = templates[criterion][level];
  return {
    criterion,
    level,
    feedback: t.feedback,
    actionPlan: t.action,
  };
}

function numericScores(m: Metrics, bias: Record<Criterion, number>): Record<Criterion, number> {
  const composition =
    0.35 * (1 - Math.abs(m.focalOffset - 0.35)) +
    0.35 * m.edgeDensity +
    0.3 * clamp01(1 - m.edgeBalance) +
    bias.Composition;
  const valueStructure = 0.55 * m.valueSpread + 0.25 * m.contrast + 0.2 * clamp01(1 - m.saturationStd) + bias['Value structure'];
  const colorRelationships =
    0.4 * m.colorHarmony + 0.35 * clamp01(m.saturationMean * 1.2) + 0.25 * clamp01(1 - m.saturationStd * 0.8) + bias['Color relationships'];
  const drawing =
    0.45 * clamp01(1 - m.textureScore * 0.35) +
    0.35 * m.edgeDensity +
    0.2 * m.contrast +
    bias['Drawing and proportion'];
  const edgeControl =
    0.5 * clamp01(1 - Math.abs(m.edgeBalance - 0.22)) +
    0.3 * clamp01(1 - Math.abs(m.edgeDensity - 0.38)) +
    0.2 * m.valueSpread +
    bias['Edge control'];
  const brushwork = 0.65 * m.textureScore + 0.2 * m.edgeDensity + 0.15 * m.contrast + bias['Brushwork / handling'];
  const unity =
    0.45 * m.colorHarmony + 0.3 * clamp01(1 - m.saturationStd) + 0.25 * m.contrast + bias['Unity and variety'];
  const originality =
    0.4 * m.textureScore + 0.35 * clamp01(m.saturationStd * 1.5) + 0.25 * m.focalOffset + bias['Originality / expressive force'];

  return {
    Composition: clamp01(composition),
    'Value structure': clamp01(valueStructure),
    'Color relationships': clamp01(colorRelationships),
    'Drawing and proportion': clamp01(drawing),
    'Edge control': clamp01(edgeControl),
    'Brushwork / handling': clamp01(brushwork),
    'Unity and variety': clamp01(unity),
    'Originality / expressive force': clamp01(originality),
  };
}

function compareMetrics(
  prev: Metrics,
  next: Metrics,
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

export async function analyzePainting(
  imageDataUrl: string,
  style: Style,
  medium: Medium,
  previous?: { imageDataUrl: string; critique: CritiqueResult }
): Promise<CritiqueResult> {
  const benchmarks = ARTISTS_BY_STYLE[style];
  const bias = styleMediumBias(style, medium);

  const m = await computeMetrics(imageDataUrl);
  const scores = numericScores(m, bias);

  const categories: CritiqueCategory[] = CRITERIA.map((c) =>
    buildCategory(c, scoreToLevel(scores[c]), style, medium, benchmarks)
  );

  const avg =
    Object.values(scores).reduce((a, b) => a + b, 0) / CRITERIA.length;
  const summary =
    avg < 0.35
      ? `Strong foundation pass—prioritize big-shape composition and value readability next. Benchmark “Master” here means the technical and expressive bar set by ${benchmarks.slice(0, 2).join(' and ')}.`
      : avg < 0.55
        ? `You are in a solid intermediate zone: intention shows; tighten hierarchy and edge/color decisions. Use ${benchmarks[0]} and ${benchmarks[1]} as touchstones for the next push.`
        : avg < 0.75
          ? `Advanced territory—refine selective emphasis and poetic edges; protect the clear read you already have. Compare finishing choices to ${benchmarks[2]} and ${benchmarks[3]}.`
          : `Master-adjacent read on this capture—keep editing with the same clarity of intent. The named masters (${benchmarks.slice(0, 3).join(', ')}) remain your north stars for depth and voice.`;

  let comparisonNote: string | undefined;
  if (previous) {
    const pm = await computeMetrics(previous.imageDataUrl);
    const pScores = numericScores(pm, bias);
    const prevLevels = Object.fromEntries(
      CRITERIA.map((c) => [c, scoreToLevel(pScores[c])])
    ) as Record<Criterion, RatingLevel>;
    const nextLevels = Object.fromEntries(
      CRITERIA.map((c) => [c, scoreToLevel(scores[c])])
    ) as Record<Criterion, RatingLevel>;
    comparisonNote = compareMetrics(pm, m, prevLevels, nextLevels);
  }

  return { categories, summary, comparisonNote };
}
