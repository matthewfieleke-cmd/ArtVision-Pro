import { useEffect, useState } from 'react';

const DESKTOP_BREAKPOINT = 768;

function query(): MediaQueryList {
  return window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
}

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => query().matches);

  useEffect(() => {
    const mql = query();
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}
