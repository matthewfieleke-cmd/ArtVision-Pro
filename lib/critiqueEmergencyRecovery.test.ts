import { describe, expect, it } from 'vitest';
import { buildEmergencyCritiqueEvidenceDTO, buildEmergencyObservationBank } from './critiqueEmergencyRecovery.js';

describe('critiqueEmergencyRecovery', () => {
  it('builds a validated observation bank', () => {
    const bank = buildEmergencyObservationBank('Impressionism', 'Oil on Canvas');
    expect(bank.passages.length).toBeGreaterThanOrEqual(6);
    expect(bank.visibleEvents.length).toBeGreaterThanOrEqual(10);
  });

  it('builds evidence DTO that passes lenient validation', () => {
    const bank = buildEmergencyObservationBank('Realism', 'Acrylic');
    const evidence = buildEmergencyCritiqueEvidenceDTO(bank, 'Realism', 'Acrylic');
    expect(evidence.criterionEvidence).toHaveLength(8);
    expect(evidence.photoQualityRead.level).toBe('fair');
  });
});
