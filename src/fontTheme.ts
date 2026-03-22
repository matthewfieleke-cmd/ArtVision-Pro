const STORAGE_KEY = 'artvision-font-preset';
export const DEFAULT_FONT_PRESET_ID = 'source-pair';

export type FontPreset = {
  id: string;
  label: string;
  /** Short note for the picker */
  vibe: string;
  /** CSS font-family stacks (quoted family names) */
  sans: string;
  display: string;
};

export const FONT_PRESETS: FontPreset[] = [
  {
    id: 'inter-instrument',
    label: 'Inter & Instrument Serif',
    vibe: 'Clean UI, editorial headlines',
    sans: '"Inter", system-ui, sans-serif',
    display: '"Instrument Serif", Georgia, serif',
  },
  {
    id: 'dm-fraunces',
    label: 'DM Sans & Fraunces',
    vibe: 'Friendly sans + quirky serif titles',
    sans: '"DM Sans", system-ui, sans-serif',
    display: '"Fraunces", Georgia, serif',
  },
  {
    id: 'source-pair',
    label: 'Source Sans 3 & Source Serif 4',
    vibe: 'Default — classic readable pairing, Adobe-like',
    sans: '"Source Sans 3", system-ui, sans-serif',
    display: '"Source Serif 4", Georgia, serif',
  },
  {
    id: 'nunito-lora',
    label: 'Nunito Sans & Lora',
    vibe: 'Soft rounded UI + bookish headings',
    sans: '"Nunito Sans", system-ui, sans-serif',
    display: '"Lora", Georgia, serif',
  },
  {
    id: 'plex',
    label: 'IBM Plex Sans & Plex Serif',
    vibe: 'Technical, precise, museum-catalog feel',
    sans: '"IBM Plex Sans", system-ui, sans-serif',
    display: '"IBM Plex Serif", Georgia, serif',
  },
  {
    id: 'jakarta-baskerville',
    label: 'Plus Jakarta Sans & Libre Baskerville',
    vibe: 'Modern startup UI + traditional display',
    sans: '"Plus Jakarta Sans", system-ui, sans-serif',
    display: '"Libre Baskerville", Georgia, serif',
  },
];

export function getStoredFontPresetId(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && FONT_PRESETS.some((p) => p.id === v)) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_FONT_PRESET_ID;
}

export function applyFontPreset(id: string): void {
  const preset = FONT_PRESETS.find((p) => p.id === id) ?? FONT_PRESETS[0];
  document.documentElement.style.setProperty('--font-sans', preset.sans);
  document.documentElement.style.setProperty('--font-display', preset.display);
  try {
    localStorage.setItem(STORAGE_KEY, preset.id);
  } catch {
    /* ignore */
  }
}
