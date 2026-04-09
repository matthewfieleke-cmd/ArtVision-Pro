import type { TabId } from '../types';

const TAB_META: Record<TabId, { title: string; subtitle: string }> = {
  home: {
    title: 'Home',
    subtitle: 'Start a critique, daily masterpiece, and work in progress',
  },
  studio: {
    title: 'Studio',
    subtitle: 'Saved paintings, versions, and resubmits',
  },
  benchmarks: {
    title: 'Masters',
    subtitle: 'Reference paintings and in-depth profiles',
  },
  glossary: {
    title: 'Glossary',
    subtitle: 'Studio terms used in your critiques',
  },
  profile: {
    title: 'Profile',
    subtitle: 'Typography and preferences',
  },
};

type Props = {
  activeTab: TabId;
};

/**
 * Top bar for the desktop workspace: current section title + one-line context.
 */
export function DesktopMainChrome({ activeTab }: Props) {
  const meta = TAB_META[activeTab];
  return (
    <header
      className="flex h-[52px] shrink-0 items-center border-b border-slate-200/90 bg-white/95 px-6 backdrop-blur-sm"
      role="banner"
    >
      <div className="min-w-0">
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-slate-900">{meta.title}</h1>
        <p className="truncate text-xs text-slate-500">{meta.subtitle}</p>
      </div>
    </header>
  );
}
