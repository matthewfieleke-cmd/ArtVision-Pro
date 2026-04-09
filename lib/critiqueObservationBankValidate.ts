import {
  hasVisibleEventLanguage,
  isConcreteAnchor,
  sharesConcreteLanguage,
} from './critiqueGrounding.js';
import { normalizeWhitespace } from './critiqueTextRules.js';
import { hasSpecificConceptualCarrierAnchor } from './critiqueWeakWorkContracts.js';
import type { ObservationBank } from './critiqueZodSchemas.js';
import { observationBankSchema } from './critiqueZodSchemas.js';

const OBSERVATION_SIGNAL_PATTERNS: Record<
  ObservationBank['visibleEvents'][number]['signalType'],
  RegExp
> = {
  shape:
    /\b(shape|shapes|silhouette|silhouettes|contour|contours|band|bands|mass|masses|block|blocks|vertical|horizontal|diagonal|curve|curves|angle|angles|gap|gaps|interval|intervals|overlap|overlaps|tilt|tilts?|lean|leans?|cut|cuts?|cross|crosses?|stack|stacks?|frame|frames?)\b/i,
  value:
    /\b(light|lights|dark|darks|bright|dim|pale|shadow|shadows|highlight|highlights|midtone|midtones|contrast|contrasts?|lighter|darker)\b/i,
  color:
    /\b(color|colour|colors|colours|hue|hues|chroma|saturation|temperature|warm|warmer|cool|cooler|red|orange|yellow|green|blue|violet|purple|gray|grey|brown)\b/i,
  edge:
    /\b(edge|edges|boundary|boundaries|contour|contours|soft|softer|hard|harder|sharp|sharper|crisp|blur|blurred|feathered|lost|found)\b/i,
  space:
    /\b(space|spatial|depth|plane|planes|foreground|background|behind|below|above|in front of|near|far|distance|recede|recedes?|advance|advances?|overlap|overlaps?|stack|stacks?)\b/i,
  surface:
    /\b(surface|texture|textures|textured|smooth|rough|grain|drag|scumble|hatch|hatching|wash|washes|stroke|strokes|brushwork|opaque|transparent|dry|wet|thick|thin)\b/i,
};
const OBSERVATION_GENERIC_EVENT_PATTERN =
  /\b(importance|important|mood|story|narrative|atmosphere|energy|presence|force|emotion|feeling|vibe|overall effect)\b/i;
const OBSERVATION_RELATION_CUE_PATTERN =
  /\b(against|between|where|meets?|under|over|above|below|behind|beside|across|through|toward|around|near|inside|outside|within)\b/i;

function normalizeObservationText(text: string): string {
  return normalizeWhitespace(text).toLowerCase();
}

function observationEventHasSignalLanguage(
  event: ObservationBank['visibleEvents'][number]
): boolean {
  const text = event.event;
  if (hasVisibleEventLanguage(text)) return true;
  if (OBSERVATION_SIGNAL_PATTERNS[event.signalType].test(text)) return true;
  if (OBSERVATION_RELATION_CUE_PATTERN.test(text) && !OBSERVATION_GENERIC_EVENT_PATTERN.test(text))
    return true;
  return false;
}

export function validateObservationBankGrounding(observationBank: ObservationBank): ObservationBank {
  const passagesById = new Map<string, ObservationBank['passages'][number]>();

  for (const passage of observationBank.passages) {
    if (passagesById.has(passage.id)) {
      throw new Error(`Observation stage validation failed: duplicate passage id ${passage.id}`);
    }
    if (!isConcreteAnchor(passage.label)) {
      throw new Error(`Observation stage validation failed: passage label is too soft (${passage.id})`);
    }
    if (
      !passage.visibleFacts.some((fact) => sharesConcreteLanguage(fact, passage.label, 2)) &&
      !passage.visibleFacts.some((fact) => sharesConcreteLanguage(fact, passage.label, 1))
    ) {
      throw new Error(`Observation stage validation failed: passage facts drifted from ${passage.id}`);
    }
    if (
      (passage.role === 'intent' || passage.role === 'presence') &&
      !hasSpecificConceptualCarrierAnchor(passage.label)
    ) {
      throw new Error(`Observation stage validation failed: conceptual passage is too soft (${passage.id})`);
    }
    passagesById.set(passage.id, passage);
  }

  for (const event of observationBank.visibleEvents) {
    const passage = passagesById.get(event.passageId);
    if (!passage) {
      throw new Error(
        `Observation stage validation failed: unknown passage id ${event.passageId} in visibleEvents`
      );
    }
    if (normalizeObservationText(event.passage) !== normalizeObservationText(passage.label)) {
      throw new Error(
        `Observation stage validation failed: visibleEvents passage label drifted for ${event.passageId}`
      );
    }
    if (!observationEventHasSignalLanguage(event)) {
      throw new Error(
        `Observation stage validation failed: visibleEvents entry lacks visual signal language for ${event.passageId}`
      );
    }
    if (!sharesConcreteLanguage(event.event, passage.label, 1)) {
      throw new Error(
        `Observation stage validation failed: visibleEvents entry drifted from ${event.passageId}`
      );
    }
  }

  for (const carrier of observationBank.intentCarriers) {
    const passage = passagesById.get(carrier.passageId);
    if (!passage) {
      throw new Error(
        `Observation stage validation failed: unknown passage id ${carrier.passageId} in intentCarriers`
      );
    }
    if (normalizeObservationText(carrier.passage) !== normalizeObservationText(passage.label)) {
      throw new Error(
        `Observation stage validation failed: intentCarriers passage label drifted for ${carrier.passageId}`
      );
    }
    if (!hasSpecificConceptualCarrierAnchor(carrier.passage)) {
      throw new Error(`Observation stage validation failed: intent carrier is too soft for ${carrier.passageId}`);
    }
  }

  return observationBank;
}

export function sortObservationBankIntentCarriers(observationBank: ObservationBank): ObservationBank {
  if (observationBank.intentCarriers.length < 2) return observationBank;
  const scoredCarriers = observationBank.intentCarriers
    .map((carrier, index) => {
      const passage = observationBank.passages.find((entry) => entry.id === carrier.passageId);
      if (!passage) return { carrier, index, score: -Infinity };
      let score = 0;
      if (passage.role === 'intent' || passage.role === 'presence') score += 8;
      if (
        passage.role === 'value' ||
        passage.role === 'edge' ||
        passage.role === 'surface' ||
        passage.role === 'color'
      ) {
        score += 4;
      }
      if (passage.role === 'structure') score -= 4;
      if (
        /\b(pressure|presence|force|vulnerability|isolation|withheld|address|tension|commitment)\b/i.test(
          carrier.reason
        )
      ) {
        score += 4;
      }
      if (
        /\b(speed|movement|motion|energy|depth|distance|scale|balance|composition|focal point)\b/i.test(
          carrier.reason
        )
      ) {
        score -= 3;
      }
      return { carrier, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.carrier);
  return {
    ...observationBank,
    intentCarriers: scoredCarriers,
  };
}

/**
 * Last-resort observation parse: JSON schema only, no fictional template bank.
 * Used only when strict grounding validation fails on the model’s output so we still keep image-derived passages.
 */
export function parseObservationBankLenient(raw: unknown): ObservationBank {
  const parsed = observationBankSchema.parse(raw);
  return sortObservationBankIntentCarriers(parsed);
}
