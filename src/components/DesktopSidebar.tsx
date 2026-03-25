import { Home, ImageIcon, BookOpen, User, Sparkles } from 'lucide-react';
import type { TabId } from '../types';

const tabs: { id: TabId; label: string; icon: typeof Home; iconOnly?: boolean }[] = [
  { id: 'home', label: 'Home', icon: Home, iconOnly: true },
  { id: 'studio', label: 'Studio', icon: ImageIcon },
  { id: 'benchmarks', label: 'Masters', icon: BookOpen },
  { id: 'profile', label: 'Profile', icon: User },
];

type Props = {
  active: TabId;
  onChange: (t: TabId) => void;
};

export function DesktopSidebar({ active, onChange }: Props) {
  return (
    <aside className="relative z-50 flex h-full w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white">
      <div className="flex items-center gap-2 px-5 py-5">
        <Sparkles className="h-6 w-6 text-violet-500" aria-hidden />
        <div>
          <p className="font-display text-lg font-normal tracking-tight text-slate-900">
            ArtVision <span className="text-violet-600">Pro</span>
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            Painting mentor
          </p>
        </div>
      </div>

      <nav className="flex-1 px-3 pt-2" aria-label="Main">
        <ul className="space-y-1">
          {tabs.map(({ id, label, icon: Icon, iconOnly }) => {
            const on = active === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onChange(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    on
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                  title={iconOnly ? label : undefined}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${on ? 'text-violet-600' : 'text-slate-400'}`}
                    strokeWidth={on ? 2.25 : 2}
                  />
                  {iconOnly ? <span className="sr-only">{label}</span> : label}
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
