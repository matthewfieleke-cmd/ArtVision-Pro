import { Home, ImageIcon, BookOpen, BookText, User, Sparkles } from 'lucide-react';
import type { TabId } from '../types';

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'studio', label: 'Studio', icon: ImageIcon },
  { id: 'benchmarks', label: 'Masters', icon: BookOpen },
  { id: 'glossary', label: 'Glossary', icon: BookText },
  { id: 'profile', label: 'Profile', icon: User },
];

type Props = {
  active: TabId;
  onChange: (t: TabId) => void;
};

export function DesktopSidebar({ active, onChange }: Props) {
  return (
    <aside className="relative z-50 flex h-full w-60 shrink-0 flex-col border-r border-slate-200/90 bg-slate-50/80">
      <div className="flex items-center gap-3 border-b border-slate-200/60 bg-white px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10">
          <Sparkles className="h-5 w-5 text-violet-600" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-normal leading-tight tracking-tight text-slate-900">
            ArtVision <span className="text-violet-600">Pro</span>
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Painting mentor</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Navigate</p>
        <ul className="space-y-0.5">
          {tabs.map(({ id, label, icon: Icon }) => {
            const on = active === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onChange(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                    on
                      ? 'bg-white text-violet-800 shadow-sm ring-1 ring-violet-200/80'
                      : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${on ? 'text-violet-600' : 'text-slate-400'}`}
                    strokeWidth={on ? 2.25 : 2}
                  />
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-100 px-4 py-4">
        <p className="text-[10px] text-slate-400">
          &copy; {new Date().getFullYear()} ArtVision Pro
        </p>
      </div>
    </aside>
  );
}
