import type { TabId } from './types';

const TAB_IDS: readonly TabId[] = ['home', 'studio', 'benchmarks', 'glossary', 'profile'];

/** Query keys used by PWA shortcuts and Microsoft Store launch URLs (`?tab=studio`). */
export const LAUNCH_TAB_QUERY = 'tab';

export function tabFromSearch(search: string): TabId | null {
  try {
    const params = new URLSearchParams(
      search.startsWith('?') ? search : search ? `?${search}` : ''
    );
    const raw = params.get(LAUNCH_TAB_QUERY)?.trim().toLowerCase();
    if (!raw) return null;
    const hit = TAB_IDS.find((t) => t === raw);
    return hit ?? null;
  } catch {
    return null;
  }
}

/** PWA manifest shortcuts — relative URLs work with any `base` (e.g. GitHub Pages). */
export const PWA_MANIFEST_SHORTCUTS = [
  {
    name: 'New critique',
    short_name: 'Critique',
    description: 'Start a new painting critique',
    url: `./?${LAUNCH_TAB_QUERY}=home`,
    icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }],
  },
  {
    name: 'Studio',
    short_name: 'Studio',
    description: 'Open saved paintings and versions',
    url: `./?${LAUNCH_TAB_QUERY}=studio`,
    icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }],
  },
  {
    name: 'Glossary',
    short_name: 'Glossary',
    description: 'Critique terms and teaching notes',
    url: `./?${LAUNCH_TAB_QUERY}=glossary`,
    icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }],
  },
];
