import { useEffect, useState } from 'react';

/**
 * Viewport width at which the app switches to the desktop workspace (sidebar, main chrome, no bottom nav).
 * Matches Tailwind `lg` — typical laptops and external monitors; tablets and phones use the mobile shell.
 */
export const DESKTOP_LAYOUT_MIN_WIDTH_PX = 1024;

function desktopLayoutQuery(): MediaQueryList {
  return window.matchMedia(`(min-width: ${DESKTOP_LAYOUT_MIN_WIDTH_PX}px)`);
}

/**
 * True when the viewport is wide enough for the desktop app layout (mouse-first, multi-column shell).
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => desktopLayoutQuery().matches);

  useEffect(() => {
    const mql = desktopLayoutQuery();
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
