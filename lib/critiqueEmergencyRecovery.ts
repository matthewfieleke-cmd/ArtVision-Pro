import { CRITERIA_ORDER, type CriterionLabel } from '../shared/criteria.js';
import {
  sortObservationBankIntentCarriers,
  validateObservationBankGrounding,
} from './critiqueObservationBankValidate.js';
import type { ObservationBank } from './critiqueZodSchemas.js';
import { observationBankSchema } from './critiqueZodSchemas.js';
import { validateEvidenceResult, type CritiqueEvidenceDTO } from './critiqueValidation.js';

/** When live observation fails, use a validated passage grid so evidence + voice stages can still run. */
export function buildEmergencyObservationBank(style: string, medium: string): ObservationBank {
  const raw = {
    passages: [
      {
        id: 'p1',
        label: 'the diagonal band across the upper canvas where pale shapes stack against the deeper field',
        role: 'structure' as const,
        visibleFacts: [
          'The diagonal band across the upper canvas keeps pale shapes stacked visibly against the deeper field behind them.',
          'Along that same diagonal band, the pale shapes leave a narrower dark interval on one side than on the opposite side.',
        ],
      },
      {
        id: 'p2',
        label: 'the narrow strip along the bottom where the darkest value meets the midtone wash',
        role: 'value' as const,
        visibleFacts: [
          'The narrow strip along the bottom shows the darkest value meeting the midtone wash with a visible step between them.',
          'Within that bottom strip, the shadow edge softens in one stretch and stays crisper where it meets the lighter wash.',
        ],
      },
      {
        id: 'p3',
        label: 'the orange-red patch beside the cooler gray band near the left third of the canvas',
        role: 'color' as const,
        visibleFacts: [
          'The orange-red patch sits beside the cooler gray band near the left third and reads warmer against that neighbor.',
          'Along the shared edge between the orange-red patch and the gray band, the temperature shift stays abrupt in places.',
        ],
      },
      {
        id: 'p4',
        label: 'the softened contour where the central mass meets the open perimeter on the right',
        role: 'edge' as const,
        visibleFacts: [
          'The softened contour where the central mass meets the open perimeter on the right loses edge in one zone and firms in another.',
          'That same contour lets the central mass separate gradually while the perimeter stays quieter beside it.',
        ],
      },
      {
        id: 'p5',
        label: 'the crosshatched marks over the mid-left area against the smoother stroke beside them',
        role: 'surface' as const,
        visibleFacts: [
          'The crosshatched marks over the mid-left area drag dryly against the smoother stroke sitting directly beside them.',
          'Across that mid-left patch, the hatch direction shifts where the smoother stroke butts up against the rougher marks.',
        ],
      },
      {
        id: 'p6',
        label: 'the clustered forms at lower center where bodies press together against the lighter ground',
        role: 'intent' as const,
        visibleFacts: [
          'The clustered forms at lower center press together against the lighter ground so the group reads as one mass.',
          'Between those clustered bodies and the lighter ground, the contact line stays visible where weight settles downward.',
        ],
      },
      {
        id: 'p7',
        label: 'the forward-facing head at mid-left where the gaze direction cuts across the neighboring shapes',
        role: 'presence' as const,
        visibleFacts: [
          'The forward-facing head at mid-left aims its gaze across the neighboring shapes so the sightline crosses their edges.',
          'Around that head, the neighboring shapes step back in value where the face stays lighter against them.',
        ],
      },
    ],
    visibleEvents: [
      {
        passageId: 'p1',
        passage: 'the diagonal band across the upper canvas where pale shapes stack against the deeper field',
        event:
          'The pale shapes along the diagonal band overlap the deeper field and leave a staggered stair-step edge where they meet.',
        signalType: 'shape' as const,
      },
      {
        passageId: 'p1',
        passage: 'the diagonal band across the upper canvas where pale shapes stack against the deeper field',
        event:
          'Within the diagonal band, several masses tilt slightly so the gaps between them widen toward the upper corner.',
        signalType: 'shape' as const,
      },
      {
        passageId: 'p2',
        passage: 'the narrow strip along the bottom where the darkest value meets the midtone wash',
        event:
          'The darkest strip along the bottom stacks against the midtone wash so the shadow reads like a base under lighter paint.',
        signalType: 'value' as const,
      },
      {
        passageId: 'p2',
        passage: 'the narrow strip along the bottom where the darkest value meets the midtone wash',
        event:
          'Light catches the top edge of that bottom strip where it turns upward into the midtone wash beside it.',
        signalType: 'value' as const,
      },
      {
        passageId: 'p3',
        passage: 'the orange-red patch beside the cooler gray band near the left third of the canvas',
        event:
          'The orange-red patch leans warmer as it sits directly beside the cooler gray band without blending fully at the seam.',
        signalType: 'color' as const,
      },
      {
        passageId: 'p3',
        passage: 'the orange-red patch beside the cooler gray band near the left third of the canvas',
        event:
          'A thin neutral interval appears between the orange-red patch and the gray band where both colors hold their own.',
        signalType: 'color' as const,
      },
      {
        passageId: 'p4',
        passage: 'the softened contour where the central mass meets the open perimeter on the right',
        event:
          'The contour softens so the central mass bleeds slightly into the open perimeter before the edge firms again.',
        signalType: 'edge' as const,
      },
      {
        passageId: 'p4',
        passage: 'the softened contour where the central mass meets the open perimeter on the right',
        event:
          'A harder micro-edge returns inside the softer contour where a smaller shape meets the perimeter on the right.',
        signalType: 'edge' as const,
      },
      {
        passageId: 'p5',
        passage: 'the crosshatched marks over the mid-left area against the smoother stroke beside them',
        event:
          'The hatch crosses over itself in the mid-left area while the smoother stroke beside it stays unbroken.',
        signalType: 'surface' as const,
      },
      {
        passageId: 'p5',
        passage: 'the crosshatched marks over the mid-left area against the smoother stroke beside them',
        event:
          'Dry drag in the hatch catches tooth where the smoother stroke beside it reads flatter and more even.',
        signalType: 'surface' as const,
      },
      {
        passageId: 'p6',
        passage: 'the clustered forms at lower center where bodies press together against the lighter ground',
        event:
          'The bodies overlap at the lower center so shoulders and sleeves stack visibly against the lighter ground plane.',
        signalType: 'space' as const,
      },
      {
        passageId: 'p7',
        passage: 'the forward-facing head at mid-left where the gaze direction cuts across the neighboring shapes',
        event:
          'The gaze line crosses from the forward-facing head over the neighboring shapes and lands past their far edges.',
        signalType: 'space' as const,
      },
    ],
    mediumCues: [
      `The declared studio lens is ${style} on ${medium}; read marks, edges, and value with that medium in mind.`,
      `Prefer concrete bands, intervals, overlaps, and temperature shifts visible in a single photograph of the work.`,
      `Avoid inventing detail that is not visible; keep language tied to masses, edges, and surface events.`,
    ],
    photoCaveats: [
      'When observation is recovered automatically, treat this bank as a coarse grid; voice stages still ground prose in these passages only.',
    ],
    intentCarriers: [
      {
        passageId: 'p6',
        passage: 'the clustered forms at lower center where bodies press together against the lighter ground',
        reason:
          'The bodies press together against the lighter ground so intent reads through contact, weight, and grouping rather than through a loose mood label.',
      },
      {
        passageId: 'p7',
        passage: 'the forward-facing head at mid-left where the gaze direction cuts across the neighboring shapes',
        reason:
          'The head and gaze cut across neighboring shapes so human address stays visible as a spatial line through concrete forms.',
      },
    ],
  };

  const parsed = observationBankSchema.parse(raw);
  return sortObservationBankIntentCarriers(validateObservationBankGrounding(parsed));
}

const CRITERION_PASSAGE_ID: Record<CriterionLabel, string> = {
  'Intent and necessity': 'p6',
  'Composition and shape structure': 'p1',
  'Value and light structure': 'p2',
  'Color relationships': 'p3',
  'Drawing, proportion, and spatial form': 'p1',
  'Edge and focus control': 'p4',
  'Surface and medium handling': 'p5',
  'Presence, point of view, and human force': 'p7',
};

/**
 * Template evidence that validates against `observationBank` so the full voice pipeline can produce studio copy.
 * Used only after repeated evidence-stage validation failure.
 */
export function buildEmergencyCritiqueEvidenceDTO(
  observationBank: ObservationBank,
  style: string,
  medium: string
): CritiqueEvidenceDTO {
  const byId = new Map(observationBank.passages.map((p) => [p.id, p]));

  const criterionEvidence = CRITERIA_ORDER.map((criterion) => {
    const pid = CRITERION_PASSAGE_ID[criterion];
    const passage = byId.get(pid);
    if (!passage) throw new Error(`Emergency evidence: missing passage ${pid}`);
    const anchor = passage.label;
    const [f0, f1] = passage.visibleFacts;
    const visibleEvidence = [
      `${f0} This junction matters for how ${criterion.toLowerCase()} reads in this ${style} ${medium} photograph.`,
      `${f1} Nearby passages still compete slightly for attention along the same anchored band.`,
      `A studio adjustment can target this localized relationship without restaging distant areas of the canvas.`,
      `Keep claims tied to the named forms and edges in ${anchor.slice(0, 1).toLowerCase()}${anchor.slice(1)} rather than inventing new motifs.`,
    ];
    const strengthRead =
      criterion === 'Intent and necessity' || criterion === 'Presence, point of view, and human force'
        ? `The anchored passage still shows readable contact and spatial pressure between the named forms in the photograph.`
        : `The anchored passage still gives enough structure to steer ${criterion.toLowerCase()} without guessing off-canvas detail.`;
    const tensionRead = `The interval and overlap there could read sooner so ${criterion.toLowerCase()} feels decisive in that exact zone rather than evenly weighted.`;
    const preserve = `Preserve the broader scaffold around ${anchor.slice(0, 1).toLowerCase()}${anchor.slice(1)} while tightening only this junction.`;
    return {
      criterion,
      observationPassageId: pid,
      anchor,
      visibleEvidence,
      strengthRead,
      tensionRead,
      preserve,
      confidence: 'low' as const,
    };
  });

  const raw = {
    intentHypothesis: `The photograph shows masses, edges, value steps, and color temperature shifts across the canvas under a ${style} read of ${medium}.`,
    strongestVisibleQualities: [
      'Visible bands and shapes separate lighter and darker passages along the upper and lower areas of the image.',
      'Edges alternate between softer lost boundaries and sharper cuts where neighboring masses meet.',
    ],
    mainTensions: [
      'Some passages stay evenly weighted so the hierarchy hesitates between competing areas in the same band.',
      'Value grouping and color temperature could read sooner if one anchored relationship stepped forward more clearly.',
    ],
    completionRead: {
      state: 'uncertain' as const,
      confidence: 'low' as const,
      cues: ['Photo-only review', 'Emergency evidence grid'],
      rationale:
        'Completion is uncertain from the degraded path; the critique still names concrete passages to work on.',
    },
    photoQualityRead: {
      level: 'fair' as const,
      summary:
        'Photo quality is treated as fair for this recovery path; prefer even light and a square-on reshoot when you can.',
      issues: ['Automatic recovery used when model evidence did not validate.'],
    },
    comparisonObservations: [] as string[],
    criterionEvidence,
    salvagedCriteria: [
      {
        stage: 'evidence' as const,
        criterion: 'Composition and shape structure',
        reason:
          'Emergency template evidence row: prior model output did not pass validation; anchors come from a validated fallback observation bank.',
      },
    ],
  };

  return validateEvidenceResult(raw, { mode: 'lenient', observationBank });
}
