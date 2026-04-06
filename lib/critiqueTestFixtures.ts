import { CRITERIA_ORDER, type CriterionLabel, type RatingLevelLabel } from '../shared/criteria.js';
import type { CritiqueCategory, StudioChange } from '../shared/critiqueContract.js';
import type { CritiqueResultDTO } from './critiqueTypes.js';
import type { CritiqueEvidenceDTO } from './critiqueValidation.js';
import type { VoiceAStageResult, VoiceBStageResult } from './critiqueZodSchemas.js';

type CriterionFixture = {
  criterion: CriterionLabel;
  level: RatingLevelLabel;
  observationPassageId: string;
  anchor: string;
  evidencePointer: string;
  region: { x: number; y: number; width: number; height: number };
  visibleEvidence: string[];
  strengthRead: string;
  tensionRead: string;
  preserve: string;
  confidence: 'low' | 'medium' | 'high';
  visualInventory: string;
  criticsAnalysis: string;
  evidenceSignals: string[];
  nextTarget: string;
  subskills: Array<{ label: string; score: number; level: RatingLevelLabel }>;
  teacherNextSteps: string;
  currentRead: string;
  move: string;
  expectedRead: string;
  preserveArea: string;
  issue: string;
  intendedChange: string;
  expectedOutcome: string;
  mainProblem: string;
  mainStrength: string;
  avoidDoing: string;
};

const seatedInteriorCriteria: CriterionFixture[] = [
  {
    criterion: 'Intent and necessity',
    level: 'Advanced',
    observationPassageId: 'p1',
    anchor: "the chair bars cutting across the sitter's torso",
    evidencePointer: "the obstruction feels intentional, but the darkest inner bar still lands too bluntly across the sitter's torso",
    region: { x: 0.2, y: 0.26, width: 0.36, height: 0.34 },
    visibleEvidence: [
      "The chair bars cutting across the sitter's torso set up an intentional obstruction between viewer and figure.",
      "The darkest inner chair bar crossing the sitter's torso lands harder than the quieter bars above and below it.",
      "The sitter's downturned head and the blocking chair together create a private, withheld interior mood.",
      "The chair back and sitter stay in one compressed room world rather than reading as separate episodes.",
    ],
    strengthRead:
      "The chair bars cutting across the sitter's torso give the scene a necessary withheld quality instead of a straightforward portrait read.",
    tensionRead:
      "The darkest inner chair bar crossing the sitter's torso is slightly too blunt, so the necessary obstruction risks reading as a single loud interruption.",
    preserve:
      "Preserve the withheld pressure created by the chair bars cutting across the sitter's torso.",
    confidence: 'high',
    visualInventory:
      "The chair bars cutting across the sitter's torso form the main interruption in the center of the room. The sitter's head dips behind that obstruction, and the chair, shirt, and wall stay in one compressed interior world. The interruption is pictorial, not incidental.",
    criticsAnalysis:
      "The chair bars cutting across the sitter's torso make the painting's quiet refusal legible. That obstruction already feels chosen rather than accidental. The only issue is that the darkest inner bar hits so hard that necessity tips toward bluntness in that one passage.",
    evidenceSignals: [
      "The chair bars cutting across the sitter's torso create the painting's withheld read.",
      "One inner chair bar lands darker and harder than the quieter obstruction around it.",
    ],
    nextTarget: 'Push intent and necessity toward Master.',
    subskills: [
      { label: 'Coherence of aim', score: 0.78, level: 'Advanced' },
      { label: 'Support from formal choices', score: 0.74, level: 'Advanced' },
    ],
    teacherNextSteps:
      "1. In the chair bars cutting across the sitter's torso, quiet the darkest inner bar where it crosses the shirt so the obstruction still feels necessary but no longer reads as one blunt stripe.",
    currentRead:
      "the darkest inner chair bar crossing the sitter's torso lands harder than the quieter obstruction around it",
    move:
      "quiet the darkest inner chair bar where it crosses the shirt while keeping the surrounding obstruction intact",
    expectedRead:
      "the obstruction still feels necessary, but the sitter reads as a chosen withheld presence instead of a blocked shape",
    preserveArea: "the quieter chair bars and the sitter's downturned head",
    issue:
      "the darkest inner chair bar crossing the sitter's torso lands too bluntly against the quieter obstruction around it",
    intendedChange:
      "quiet the darkest inner chair bar where it crosses the shirt while keeping the surrounding obstruction intact",
    expectedOutcome:
      "the obstruction still feels necessary, but the sitter reads as a chosen withheld presence instead of a blocked shape",
    mainProblem: "The hardest inner chair bar is slightly too blunt relative to the rest of the obstruction.",
    mainStrength: "The obstruction already gives the painting a necessary withheld pressure.",
    avoidDoing: 'Do not remove the chair-as-obstruction logic.',
  },
  {
    criterion: 'Composition and shape structure',
    level: 'Advanced',
    observationPassageId: 'p2',
    anchor: 'the foreground chair back around the sitter',
    evidencePointer: 'the middle slat interrupts the route from the chair silhouette to the sitter more abruptly than the surrounding shape scaffold',
    region: { x: 0.16, y: 0.18, width: 0.32, height: 0.46 },
    visibleEvidence: [
      'The foreground chair back around the sitter creates the main vertical scaffold in the center-left of the picture.',
      'The middle slat in the foreground chair back around the sitter is the one shape that cuts the route most abruptly.',
      'The outer chair silhouette still helps step the eye toward the head and shirt behind it.',
      'The window strip at left, the chair back, and the sitter form three readable vertical shape bands.',
    ],
    strengthRead:
      'The foreground chair back around the sitter already gives the rectangle a strong vertical scaffold and a clear central interruption.',
    tensionRead:
      'The middle slat in the foreground chair back around the sitter interrupts the route too abruptly, so one shape pulls harder than the larger scaffold needs.',
    preserve:
      'Preserve the three-band scaffold between window strip, chair back, and sitter.',
    confidence: 'high',
    visualInventory:
      'The foreground chair back around the sitter forms the main vertical scaffold. The window strip at left, the chair back, and the sitter create three readable bands. One middle slat cuts more abruptly than the surrounding structure.',
    criticsAnalysis:
      'The foreground chair back around the sitter is doing real compositional work. The larger scaffold is already controlled, and the interruption belongs to the design. The issue is local: the middle slat cuts the route more abruptly than the rest of the shape structure requires.',
    evidenceSignals: [
      'The foreground chair back around the sitter establishes the main vertical scaffold.',
      'The middle slat cuts the route more abruptly than the surrounding chair structure.',
    ],
    nextTarget: 'Push composition and shape structure toward Master.',
    subskills: [
      { label: 'Big-shape organization', score: 0.76, level: 'Advanced' },
      { label: 'Eye path control', score: 0.72, level: 'Advanced' },
    ],
    teacherNextSteps:
      '1. In the foreground chair back around the sitter, soften the middle slat and widen the small gap above the shoulder so the eye can step from chair to head without losing the scaffold.',
    currentRead:
      'the middle slat in the foreground chair back around the sitter interrupts the route more abruptly than the surrounding scaffold',
    move:
      'soften the middle slat and widen the small gap above the shoulder while keeping the outer chair silhouette firm',
    expectedRead:
      'the eye steps from chair to head more naturally while the main three-band scaffold stays intact',
    preserveArea: 'the outer chair silhouette and the left window strip',
    issue:
      'the middle slat in the foreground chair back around the sitter interrupts the route more abruptly than the surrounding scaffold',
    intendedChange:
      'soften the middle slat and widen the small gap above the shoulder while keeping the outer chair silhouette firm',
    expectedOutcome:
      'the eye steps from chair to head more naturally while the main three-band scaffold stays intact',
    mainProblem: 'One middle slat cuts too abruptly through the larger scaffold.',
    mainStrength: 'The larger chair-window-sitter scaffold is already strong.',
    avoidDoing: 'Do not collapse the chair silhouette into the wall tone.',
  },
  {
    criterion: 'Value and light structure',
    level: 'Intermediate',
    observationPassageId: 'p3',
    anchor: "the wall behind the sitter's head",
    evidencePointer: "the wall behind the sitter's head sits too close in value to the crown and upper hair mass",
    region: { x: 0.48, y: 0.08, width: 0.2, height: 0.24 },
    visibleEvidence: [
      "The wall behind the sitter's head is only slightly darker than the crown and upper hair mass.",
      "The shirt below the head separates more clearly from the room than the wall behind the sitter's head does.",
      "The left window strip is still the cleanest light mass, but the head does not separate from the wall as quickly.",
      "The darker chair bars in front of the torso read more decisively than the wall behind the sitter's head.",
    ],
    strengthRead:
      "The left window strip and shirt still establish the main light scaffold, so the painting's value structure is readable.",
    tensionRead:
      "The wall behind the sitter's head sits too close in value to the crown and upper hair mass, delaying head separation.",
    preserve:
      'Preserve the broader light scaffold from window strip to shirt.',
    confidence: 'high',
    visualInventory:
      "The wall behind the sitter's head is close in value to the crown, while the shirt below separates more clearly. The left window strip remains the clearest light mass. Head separation is weaker than the larger room scaffold.",
    criticsAnalysis:
      "The larger value scaffold is working, but the wall behind the sitter's head is still too close to the crown. That local compression delays the read of the head more than the rest of the painting does. This is a clear, fixable middle-band issue.",
    evidenceSignals: [
      "The wall behind the sitter's head sits too close in value to the crown.",
      'The left window strip and shirt still establish the broader light scaffold.',
    ],
    nextTarget: 'Push value and light structure toward Advanced.',
    subskills: [
      { label: 'Light-dark grouping', score: 0.55, level: 'Intermediate' },
      { label: 'Range control', score: 0.5, level: 'Intermediate' },
    ],
    teacherNextSteps:
      "1. In the wall behind the sitter's head, darken the wall a half-step just behind the crown so the head separates sooner while the broader window-to-shirt scaffold stays unchanged.",
    currentRead:
      "the wall behind the sitter's head sits too close in value to the crown and upper hair mass",
    move:
      "darken the wall a half-step just behind the crown while keeping the window strip and shirt values unchanged",
    expectedRead:
      "the head separates sooner from the room without breaking the larger light scaffold",
    preserveArea: 'the left window strip and the shirt light shape',
    issue:
      "the wall behind the sitter's head sits too close in value to the crown and upper hair mass",
    intendedChange:
      "darken the wall a half-step just behind the crown while keeping the window strip and shirt values unchanged",
    expectedOutcome:
      'the head separates sooner from the room without breaking the larger light scaffold',
    mainProblem: 'Head separation is delayed by the near-match between wall and crown.',
    mainStrength: 'The broader window-to-shirt light scaffold is already readable.',
    avoidDoing: 'Do not over-darken the whole wall and flatten the room.',
  },
  {
    criterion: 'Color relationships',
    level: 'Advanced',
    observationPassageId: 'p4',
    anchor: 'the lower-left floor-to-wall turn',
    evidencePointer: 'the warmest floor patch at the lower-left floor-to-wall turn jumps slightly hotter than the rest of the muted room palette',
    region: { x: 0.0, y: 0.56, width: 0.34, height: 0.28 },
    visibleEvidence: [
      'The lower-left floor-to-wall turn carries a mild warm note against the cooler wall beside it.',
      'The warmest floor patch at the lower-left floor-to-wall turn jumps slightly hotter than the muted room palette around it.',
      'The shirt remains neutral between the cooler window light and the warmer floor note.',
      'The room otherwise stays inside a restrained muted palette without high-chroma accents.',
    ],
    strengthRead:
      'The lower-left floor-to-wall turn already keeps the room planes distinct with a restrained temperature shift.',
    tensionRead:
      'The warmest floor patch at the lower-left floor-to-wall turn jumps slightly hotter than the rest of the muted palette, so the color accent is a touch more insistent than it needs to be.',
    preserve:
      'Preserve the restrained cool-to-warm room palette.',
    confidence: 'medium',
    visualInventory:
      'The lower-left floor-to-wall turn carries the room’s main warm note against a cooler wall. The rest of the room remains muted. One floor patch is slightly hotter than the rest of that restrained palette family.',
    criticsAnalysis:
      'The restrained palette is working on the painting’s own terms, and the lower-left floor-to-wall turn is enough to separate the room planes. The only issue is that the warmest floor patch jumps slightly hotter than the rest of the room world. That is a small, local refinement problem rather than a system failure.',
    evidenceSignals: [
      'The lower-left floor-to-wall turn separates the planes with a restrained warm note.',
      'One floor patch jumps slightly hotter than the rest of the muted room palette.',
    ],
    nextTarget: 'Push color relationships toward Master.',
    subskills: [
      { label: 'Palette harmony', score: 0.74, level: 'Advanced' },
      { label: 'Temperature control', score: 0.7, level: 'Advanced' },
    ],
    teacherNextSteps:
      '1. In the lower-left floor-to-wall turn, cool the warmest floor patch beside the wall so that corner stays inside the muted palette while still separating the two planes.',
    currentRead:
      'the warmest floor patch at the lower-left floor-to-wall turn jumps slightly hotter than the rest of the muted room palette',
    move:
      'cool the warmest floor patch beside the wall while keeping the small warm-to-cool separation intact',
    expectedRead:
      'the corner stays inside one muted palette family and still separates floor from wall',
    preserveArea: 'the broader warm-to-cool room palette',
    issue:
      'the warmest floor patch at the lower-left floor-to-wall turn jumps slightly hotter than the rest of the muted room palette',
    intendedChange:
      'cool the warmest floor patch beside the wall while keeping the small warm-to-cool separation intact',
    expectedOutcome:
      'the corner stays inside one muted palette family and still separates floor from wall',
    mainProblem: 'One warm floor patch is slightly too hot for the room palette.',
    mainStrength: 'The room already holds together inside a restrained temperature world.',
    avoidDoing: 'Do not flatten the entire corner into one dead neutral.',
  },
  {
    criterion: 'Drawing, proportion, and spatial form',
    level: 'Intermediate',
    observationPassageId: 'p5',
    anchor: 'the near table leg against the floor shadow',
    evidencePointer: 'the near table leg against the floor shadow kicks outward slightly before it meets the floor plane',
    region: { x: 0.56, y: 0.56, width: 0.14, height: 0.2 },
    visibleEvidence: [
      'The near table leg against the floor shadow kicks outward slightly before it meets the floor plane.',
      'The far table leg holds a straighter drop than the near table leg against the floor shadow.',
      'The tabletop and the sitter still share one believable room setup overall.',
      'The chair bars overlap the torso without collapsing the larger figure placement.',
    ],
    strengthRead:
      'The tabletop, sitter, and room still share one believable setup, so the larger spatial drawing holds.',
    tensionRead:
      'The near table leg against the floor shadow kicks outward slightly before it meets the floor plane, which weakens the leg’s weight-bearing read.',
    preserve:
      'Preserve the broader tabletop-to-sitter room structure.',
    confidence: 'medium',
    visualInventory:
      'The near table leg against the floor shadow is the least settled structural passage in the furniture. The far leg drops more cleanly. The broader room setup between sitter, chair, and table still holds together.',
    criticsAnalysis:
      'The larger spatial setup is believable, but the near table leg against the floor shadow kicks outward before it lands. That weakens the leg’s weight-bearing authority in one local passage. The criterion is competent overall but not yet fully settled.',
    evidenceSignals: [
      'The near table leg against the floor shadow kicks outward before it meets the floor.',
      'The larger tabletop-to-sitter room structure still holds together.',
    ],
    nextTarget: 'Push drawing, proportion, and spatial form toward Advanced.',
    subskills: [
      { label: 'Shape placement', score: 0.54, level: 'Intermediate' },
      { label: 'Spatial construction', score: 0.5, level: 'Intermediate' },
    ],
    teacherNextSteps:
      '1. In the near table leg against the floor shadow, straighten the outer edge and narrow the foot slightly so the leg sits more squarely on the floor plane.',
    currentRead:
      'the near table leg against the floor shadow kicks outward slightly before it meets the floor plane',
    move:
      'straighten the outer edge of the near table leg and narrow the foot slightly at the floor',
    expectedRead:
      'the leg carries weight more squarely and the table sits more convincingly on the floor',
    preserveArea: 'the broader tabletop-to-sitter room setup',
    issue:
      'the near table leg against the floor shadow kicks outward slightly before it meets the floor plane',
    intendedChange:
      'straighten the outer edge of the near table leg and narrow the foot slightly at the floor',
    expectedOutcome:
      'the leg carries weight more squarely and the table sits more convincingly on the floor',
    mainProblem: 'One table leg loses weight-bearing authority at the floor.',
    mainStrength: 'The broader room setup around the table and sitter already holds.',
    avoidDoing: 'Do not redraw the whole table or disturb the tabletop angle.',
  },
  {
    criterion: 'Edge and focus control',
    level: 'Intermediate',
    observationPassageId: 'p6',
    anchor: 'the jaw edge against the dark collar',
    evidencePointer: 'the jaw edge against the dark collar is no crisper than the softer cheek edge into the wall',
    region: { x: 0.5, y: 0.18, width: 0.16, height: 0.16 },
    visibleEvidence: [
      'The jaw edge against the dark collar is no crisper than the softer cheek edge into the wall.',
      'The cheek edge into the wall is broad and useful, but the jaw edge against the dark collar needs to win first.',
      'The head and shirt passage is meant to carry more attention than the chair bars crossing the torso.',
      'The outer chair silhouette still reads more decisively than some of the interior slats.',
    ],
    strengthRead:
      'The cheek edge into the wall already gives the head useful softness and avoids a cutout read.',
    tensionRead:
      'The jaw edge against the dark collar is no crisper than the softer cheek edge into the wall, so the focus hierarchy is flatter than it should be in the face passage.',
    preserve:
      'Preserve the broad cheek softness into the wall.',
    confidence: 'high',
    visualInventory:
      'The jaw edge against the dark collar and the cheek edge into the wall are currently too close in sharpness. The cheek softness is useful. The jaw-collar edge is the passage that needs clearer priority.',
    criticsAnalysis:
      'The head passage already has the right soft-vs-hard logic available to it, but the jaw edge against the dark collar is not yet winning over the softer cheek edge into the wall. That makes the face hierarchy flatter than the rest of the picture wants. The problem is precise and local.',
    evidenceSignals: [
      'The jaw edge against the dark collar is no crisper than the softer cheek edge into the wall.',
      'The cheek softness into the wall is useful and should not be lost.',
    ],
    nextTarget: 'Push edge and focus control toward Advanced.',
    subskills: [
      { label: 'Edge hierarchy', score: 0.56, level: 'Intermediate' },
      { label: 'Focus placement', score: 0.52, level: 'Intermediate' },
    ],
    teacherNextSteps:
      '1. In the jaw edge against the dark collar, sharpen the jaw-to-collar break while losing the cheek edge into the wall a little more so the face claims first attention.',
    currentRead:
      'the jaw edge against the dark collar is no crisper than the softer cheek edge into the wall',
    move:
      'sharpen the jaw-to-collar break while losing the cheek edge into the wall a little more',
    expectedRead:
      'the face claims first attention while the useful cheek softness still stays atmospheric',
    preserveArea: 'the soft cheek edge into the wall',
    issue:
      'the jaw edge against the dark collar is no crisper than the softer cheek edge into the wall',
    intendedChange:
      'sharpen the jaw-to-collar break while losing the cheek edge into the wall a little more',
    expectedOutcome:
      'the face claims first attention while the useful cheek softness still stays atmospheric',
    mainProblem: 'The hard-vs-soft hierarchy in the face is too even.',
    mainStrength: 'The cheek softness into the wall is already useful.',
    avoidDoing: 'Do not sharpen every edge around the head.',
  },
  {
    criterion: 'Surface and medium handling',
    level: 'Advanced',
    observationPassageId: 'p7',
    anchor: 'the wall hatching beside the smoother shirt',
    evidencePointer: 'the wall hatching beside the smoother shirt repeats one short stroke shape too uniformly',
    region: { x: 0.38, y: 0.18, width: 0.26, height: 0.28 },
    visibleEvidence: [
      'The wall hatching beside the smoother shirt uses one short diagonal stroke family more repeatedly than the rest of the room.',
      'The smoother shirt passage already contrasts well with the wall hatching beside the smoother shirt.',
      'The floor marks below vary direction more than the wall hatching beside the smoother shirt does.',
      'The chair bars stay tighter and firmer than the room hatching around them.',
    ],
    strengthRead:
      'The smoother shirt against the wall hatching already gives the room a controlled handling contrast.',
    tensionRead:
      'The wall hatching beside the smoother shirt repeats one short stroke shape too uniformly, so the wall passage reads a touch more patterned than planar.',
    preserve:
      'Preserve the smoother shirt against the rougher room handling.',
    confidence: 'medium',
    visualInventory:
      'The wall hatching beside the smoother shirt repeats a short diagonal stroke more uniformly than the rest of the room. The shirt remains a smoother counter-passage. Floor marks already vary direction more than this wall section does.',
    criticsAnalysis:
      'The handling contrast between wall and shirt is already disciplined. The only issue is that the wall hatching beside the smoother shirt repeats one short stroke shape too uniformly, making that passage slightly more patterned than planar. This is a small but real surface refinement issue.',
    evidenceSignals: [
      'The wall hatching beside the smoother shirt repeats one short stroke shape too uniformly.',
      'The smoother shirt already contrasts well with the wall handling.',
    ],
    nextTarget: 'Push surface and medium handling toward Master.',
    subskills: [
      { label: 'Mark economy', score: 0.75, level: 'Advanced' },
      { label: 'Surface character', score: 0.71, level: 'Advanced' },
    ],
    teacherNextSteps:
      '1. In the wall hatching beside the smoother shirt, vary two or three repeated short diagonals with broader passes so that wall reads as one plane instead of a patterned patch.',
    currentRead:
      'the wall hatching beside the smoother shirt repeats one short stroke shape too uniformly',
    move:
      'vary two or three repeated short diagonals with broader passes while keeping the shirt smoother',
    expectedRead:
      'the wall reads more like one plane while the shirt still stays the quieter handling contrast',
    preserveArea: 'the smoother shirt passage against the wall',
    issue:
      'the wall hatching beside the smoother shirt repeats one short stroke shape too uniformly',
    intendedChange:
      'vary two or three repeated short diagonals with broader passes while keeping the shirt smoother',
    expectedOutcome:
      'the wall reads more like one plane while the shirt still stays the quieter handling contrast',
    mainProblem: 'One wall passage is slightly too patterned.',
    mainStrength: 'The shirt-to-wall handling contrast is already controlled.',
    avoidDoing: 'Do not smooth the whole wall into one dead tone.',
  },
  {
    criterion: 'Presence, point of view, and human force',
    level: 'Advanced',
    observationPassageId: 'p8',
    anchor: "the sitter's downturned head against the dark wall",
    evidencePointer: "the brightest shirt note just below the chin steals a little pressure from the sitter's downturned head against the dark wall",
    region: { x: 0.46, y: 0.12, width: 0.24, height: 0.28 },
    visibleEvidence: [
      "The sitter's downturned head against the dark wall carries the scene's inward pressure.",
      "The brightest shirt note just below the chin steals a little pressure from the sitter's downturned head against the dark wall.",
      'The viewpoint from behind the chair keeps the sitter partially withheld rather than frontal.',
      'The head, chair obstruction, and table stay inside one compressed interior mood.',
    ],
    strengthRead:
      "The sitter's downturned head against the dark wall already gives the painting a convincing inward human pressure.",
    tensionRead:
      "The brightest shirt note just below the chin steals a little pressure from the sitter's downturned head against the dark wall, so the human force disperses slightly downward.",
    preserve:
      'Preserve the inward pressure of the downturned head and withheld viewpoint.',
    confidence: 'high',
    visualInventory:
      "The sitter's downturned head against the dark wall is the main human-pressure passage. A bright shirt note sits directly below it. The behind-the-chair viewpoint already makes the figure feel withheld and inward.",
    criticsAnalysis:
      "The figure already has real inward pressure because the sitter's downturned head against the dark wall is held in a withheld viewpoint. The only issue is that the brightest shirt note directly below the chin pulls some of that pressure downward. This is a modest but worthwhile refinement.",
    evidenceSignals: [
      "The sitter's downturned head against the dark wall carries the scene's inward pressure.",
      'A bright shirt note below the chin pulls some of that pressure downward.',
    ],
    nextTarget: 'Push presence, point of view, and human force toward Master.',
    subskills: [
      { label: 'Atmospheric force', score: 0.79, level: 'Advanced' },
      { label: 'Point of view', score: 0.75, level: 'Advanced' },
    ],
    teacherNextSteps:
      "1. In the sitter's downturned head against the dark wall, quiet the brightest shirt note below the chin so the inward pressure stays centered in the head rather than dropping into the shirt.",
    currentRead:
      "the brightest shirt note just below the chin steals a little pressure from the sitter's downturned head against the dark wall",
    move:
      "quiet the brightest shirt note below the chin while keeping the head-to-wall pressure intact",
    expectedRead:
      'the inward force stays centered in the head and the withheld viewpoint feels stronger',
    preserveArea: 'the head-to-wall pressure and the withheld viewpoint behind the chair',
    issue:
      "the brightest shirt note just below the chin steals a little pressure from the sitter's downturned head against the dark wall",
    intendedChange:
      "quiet the brightest shirt note below the chin while keeping the head-to-wall pressure intact",
    expectedOutcome:
      'the inward force stays centered in the head and the withheld viewpoint feels stronger',
    mainProblem: 'One shirt accent pulls pressure down from the head.',
    mainStrength: 'The downturned head already carries a strong inward presence.',
    avoidDoing: 'Do not brighten the shirt elsewhere to compensate.',
  },
];

function criterionFixtures(): CriterionFixture[] {
  return CRITERIA_ORDER.map((criterion) => {
    const match = seatedInteriorCriteria.find((entry) => entry.criterion === criterion);
    if (!match) {
      throw new Error(`Missing seated interior fixture for ${criterion}`);
    }
    return match;
  });
}

export function makeCritiqueEvidenceFixture(): CritiqueEvidenceDTO {
  return {
    intentHypothesis:
      'A quiet interior study that uses obstruction and compression to make the sitter feel withheld rather than directly presented.',
    strongestVisibleQualities: [
      'The blocked view of the sitter feels intentional rather than accidental.',
      'The room stays inside one compressed value-and-temperature world.',
      'The downturned head carries real inward pressure.',
    ],
    mainTensions: [
      'The wall behind the head is too close in value to the crown.',
      'One inner chair slat interrupts the shape route too bluntly.',
      'The warmest floor patch jumps slightly hotter than the rest of the room palette.',
    ],
    completionRead: {
      state: 'likely_finished',
      confidence: 'high',
      cues: [
        'Edges and passages are consistently resolved across the room.',
        'The handling reads intentional rather than blocked-in.',
      ],
      rationale:
        'The painting reads presentation-ready overall, with selective refinements left rather than broad unfinished passages.',
    },
    photoQualityRead: {
      level: 'good',
      summary: 'The photo is sharp enough to judge value, edge, and handling relationships.',
      issues: [],
    },
    comparisonObservations: [],
    criterionEvidence: criterionFixtures().map((fixture) => ({
      criterion: fixture.criterion,
      observationPassageId: fixture.observationPassageId,
      anchor: fixture.anchor,
      visibleEvidence: fixture.visibleEvidence,
      strengthRead: fixture.strengthRead,
      tensionRead: fixture.tensionRead,
      preserve: fixture.preserve,
      confidence: fixture.confidence,
    })),
  };
}

export function makeVoiceAStageFixture(): VoiceAStageResult {
  const categories: VoiceAStageResult['categories'] = criterionFixtures().map((fixture) => ({
    criterion: fixture.criterion,
    level: fixture.level,
    phase1: { visualInventory: fixture.visualInventory },
    phase2: { criticsAnalysis: fixture.criticsAnalysis },
    confidence: fixture.confidence,
    evidenceSignals: fixture.evidenceSignals,
    preserve: fixture.preserve,
    nextTarget: fixture.nextTarget,
    subskills: fixture.subskills,
  }));
  return {
    summary:
      "The blocked chair, muted room, and downturned sitter already make this interior feel authored, but the wall behind the sitter's head and one middle chair slat still keep a few passages from landing as cleanly as the best ones do.",
    suggestedPaintingTitles: [
      {
        category: 'formalist',
        title: 'Chair Back Before the Sitter',
        rationale:
          'The composition is built around the foreground chair back and the blocked route into the head, making that structural interruption the dominant formal event.',
      },
      {
        category: 'tactile',
        title: 'Muted Room with Hatched Wall',
        rationale:
          'The critique turns on the restrained room palette and the contrast between the wall hatching and smoother shirt passage.',
      },
      {
        category: 'intent',
        title: 'Withheld Interior',
        rationale:
          'The quiet pressure of the downturned head and obstructed viewpoint gives the painting its strongest psychological read.',
      },
    ],
    overallSummary: {
      analysis:
        "Using the Drawing lens, this reads as a serious, controlled interior in which obstruction and compression are part of the painting's intent rather than accidents. The larger structure, handling, and human pressure are already convincing. The remaining weaknesses are local and concrete: the wall behind the head, one chair slat, and a few over-insistent accents still need cleaner hierarchy.",
    },
    studioAnalysis: {
      whatWorks:
        "The chair bars cutting across the sitter's torso, the left window strip, and the sitter's downturned head against the dark wall all belong to one quiet interior logic. The handling stays disciplined, and the picture already knows what kind of pressure it wants.",
      whatCouldImprove:
        "The main leverage point is not a wholesale rewrite but a few specific relationships: the wall behind the sitter's head is too close to the crown, one middle chair slat interrupts the route too bluntly, and a few accents still compete harder than the larger scaffold needs.",
    },
    comparisonNote: null,
    overallConfidence: 'high',
    photoQuality: {
      level: 'good',
      summary: 'The photo is clear enough to judge key value, edge, and handling relationships.',
      issues: [],
      tips: [],
    },
    categories,
  };
}

export function makeVoiceBStageFixture(): VoiceBStageResult {
  const studioChanges: VoiceBStageResult['studioChanges'] = [
    {
      text: "In the wall behind the sitter's head, darken the wall a half-step just behind the crown so the head separates sooner without breaking the broader window-to-shirt scaffold.",
      previewCriterion: 'Value and light structure',
    },
    {
      text: 'In the foreground chair back around the sitter, soften the middle slat and widen the small gap above the shoulder so the eye can step from chair to head without losing the scaffold.',
      previewCriterion: 'Composition and shape structure',
    },
    {
      text: 'In the jaw edge against the dark collar, sharpen the jaw-to-collar break while losing the cheek edge into the wall a little more so the face claims first attention.',
      previewCriterion: 'Edge and focus control',
    },
  ];
  const categories: VoiceBStageResult['categories'] = criterionFixtures().map((fixture) => ({
    criterion: fixture.criterion,
    phase3: { teacherNextSteps: fixture.teacherNextSteps },
    plan: {
      currentRead: fixture.currentRead,
      move: fixture.move,
      expectedRead: fixture.expectedRead,
      preserve: fixture.preserveArea,
      editability: 'yes',
    },
    actionPlanSteps: [
      {
        area: fixture.anchor,
        currentRead: fixture.currentRead,
        move: fixture.move,
        expectedRead: fixture.expectedRead,
        preserve: fixture.preserveArea,
        priority: 'primary',
      },
    ],
    voiceBPlan: {
      currentRead: fixture.currentRead,
      mainProblem: fixture.mainProblem,
      mainStrength: fixture.mainStrength,
      bestNextMove: fixture.move,
      optionalSecondMove: '',
      avoidDoing: fixture.avoidDoing,
      expectedRead: fixture.expectedRead,
      storyIfRelevant: '',
    },
    anchor: {
      areaSummary: fixture.anchor,
      evidencePointer: fixture.evidencePointer,
      region: fixture.region,
    },
    editPlan: {
      targetArea: fixture.anchor,
      preserveArea: fixture.preserveArea,
      issue: fixture.issue,
      intendedChange: fixture.intendedChange,
      expectedOutcome: fixture.expectedOutcome,
      editability: 'yes',
    },
  }));
  return {
    overallSummary: {
      topPriorities: [
        "Darken the wall behind the sitter's head so the crown separates sooner without disturbing the room's larger light scaffold.",
        'Soften the middle slat in the foreground chair back so the eye can step from chair to head without losing the intentional obstruction.',
      ],
    },
    studioChanges,
    categories,
  };
}

export function makeCritiqueResultFixture(): CritiqueResultDTO {
  const voiceA = makeVoiceAStageFixture();
  const voiceB = makeVoiceBStageFixture();
  const voiceBCategories = new Map<CritiqueCategory['criterion'], VoiceBStageResult['categories'][number]>();
  for (const category of voiceB.categories) {
    voiceBCategories.set(category.criterion as CriterionLabel, category);
  }
  const studioChanges = voiceB.studioChanges.map((change): StudioChange => ({
    text: change.text,
    previewCriterion: change.previewCriterion as CriterionLabel,
  }));
  const categories = voiceA.categories.map((category): CritiqueCategory => {
    const criterion = category.criterion as CriterionLabel;
    const teacher = voiceBCategories.get(criterion);
    if (!teacher) throw new Error(`Missing Voice B category for ${criterion}`);
    return {
      criterion,
      level: category.level as RatingLevelLabel,
      phase1: category.phase1,
      phase2: category.phase2,
      phase3: teacher.phase3,
      confidence: category.confidence,
      evidenceSignals: category.evidenceSignals,
      preserve: category.preserve,
      nextTarget: category.nextTarget,
      anchor: teacher.anchor,
      plan: teacher.plan,
      editPlan: teacher.editPlan,
      voiceBPlan: teacher.voiceBPlan,
      actionPlanSteps: teacher.actionPlanSteps,
      subskills: category.subskills?.map((subskill) => ({
        ...subskill,
        level: subskill.level as RatingLevelLabel,
      })),
    };
  });

  return {
    summary: voiceA.summary,
    overallSummary: {
      analysis: voiceA.overallSummary.analysis,
      topPriorities: voiceB.overallSummary.topPriorities,
    },
    simpleFeedback: {
      studioAnalysis: voiceA.studioAnalysis,
      studioChanges,
    },
    categories,
    overallConfidence: voiceA.overallConfidence,
    photoQuality: voiceA.photoQuality,
    analysisSource: 'api',
    suggestedPaintingTitles: voiceA.suggestedPaintingTitles,
  };
}
