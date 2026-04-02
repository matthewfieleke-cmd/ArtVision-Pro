export function phaseSchemaSummaryLines(): string {
  return [
    '- phase1: { visualInventory } — objective extraction for this criterion only; 2–4 sentences listing literal visual data from the supplied evidence. Name specific quadrants, objects, color/value passages, textures, and anchored relationships. No praise, diagnosis, or verbs like "works", "fails", "effective", or "weak".',
    '- phase2: { criticsAnalysis } — Critic\'s Analysis for this criterion; 2–4 sentences grounded in that criterion’s visibleEvidence and phase1.visualInventory; no redundant sentences; consistent with level.',
    '- phase3: { teacherNextSteps } — Teacher\'s Next Steps for this criterion; numbered rendering of the same teacher guidance as actionPlan, aligned with actionPlanSteps and anchor.',
  ].join('\n');
}

export function phaseVoiceASummaryLines(): string {
  return [
    '- phase1: { visualInventory } — objective extraction; 2–4 sentences listing only literal visual evidence from this criterion’s visibleEvidence. Name the specific area, objects, colors, values, textures, and junctions. No evaluative wording.',
    '- phase2: { criticsAnalysis } — 2–4 sentences; ground every sentence in this criterion’s visibleEvidence and phase1.visualInventory; no redundancy.',
  ].join('\n');
}

export function phaseVoiceBSummaryLines(): string {
  return [
    '- phase3: { teacherNextSteps } — numbered list matching actionPlan exactly.',
  ].join('\n');
}

export function phaseVoiceAWorkflowRules(): string {
  return [
    '- For every criterion, write categories[].phase1.visualInventory first in an objective register: list literal visual data only, anchored to exact zones, quadrants, objects, colors, values, edges, or textures. No judgment words such as "successful", "weak", "effective", "awkward", or "better" in visualInventory.',
    '- categories[].phase2.criticsAnalysis is Phase 2 only: the critic\'s analysis based strictly on that criterion\'s phase1.visualInventory/evidence. It should read like an expert critic evaluating what those specific visual facts do psychologically and formally.',
    '- Non-redundancy: categories[].phase1.visualInventory must stay objective and distinct from categories[].phase2.criticsAnalysis. categories[].phase2.criticsAnalysis must not repeat the same sentence, clause, or junction observation twice. categories[].evidenceSignals must be short distillations of distinct lines from that criterion’s visibleEvidence—do not restate the phase2 text verbatim.',
  ].join('\n');
}

export function phaseVoiceBWorkflowRules(): string {
  return [
    '- Treat Voice A\'s categories[].phase1.visualInventory as the objective Phase 1 record for each criterion and categories[].phase2.criticsAnalysis as the fixed critical diagnosis. Your actionPlanSteps and categories[].phase3.teacherNextSteps are Phase 3 only and must build directly on those observed facts rather than replacing them with generic coaching.',
    '- Make categories[].phase3.teacherNextSteps a readable numbered rendering of categories[].actionPlanSteps. Do not invent extra meaning in phase3.teacherNextSteps that is not already present in those structured steps. One numbered item per step—no duplicate numbered lines saying the same move.',
    '- Voice B phase3.teacherNextSteps (required for all eight categories): For each category, phase3.teacherNextSteps is the readable numbered studio guidance derived from actionPlanSteps for THAT criterion on THIS painting only.',
    '- If categories[].level is **Master** for that criterion: phase3.teacherNextSteps must begin with exactly "Don’t change a thing." Then add 1–2 sentences naming what is already exemplary in that anchored passage. No homework, no revision steps.',
    '- Voice A categories[].phase2.criticsAnalysis, Voice B categories[].phase3.teacherNextSteps, categories[].editPlan, and any related studioChanges must all stay aligned to that same anchored passage.',
  ].join('\n');
}
