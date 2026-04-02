import type { CritiqueCategory } from './critiqueContract.js';

export function phase1Text(category: Pick<CritiqueCategory, 'phase1'>): string {
  return category.phase1.visualInventory;
}

export function phase2Text(category: Pick<CritiqueCategory, 'phase2'>): string {
  return category.phase2.criticsAnalysis;
}

export function phase3Text(category: Pick<CritiqueCategory, 'phase3'>): string {
  return category.phase3.teacherNextSteps;
}
