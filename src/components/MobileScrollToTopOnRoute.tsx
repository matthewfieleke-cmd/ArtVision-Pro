import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useIsDesktop } from '../hooks/useIsDesktop';

/** On mobile, scroll the document to top whenever the hash route changes. */
export function MobileScrollToTopOnRoute() {
  const isDesktop = useIsDesktop();
  const location = useLocation();

  useLayoutEffect(() => {
    if (isDesktop) return;
    window.scrollTo(0, 0);
  }, [isDesktop, location.pathname, location.key]);

  return null;
}
