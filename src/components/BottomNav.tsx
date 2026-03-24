import { Home, ImageIcon, BookOpen, User } from 'lucide-react';
import type { TabId } from '../types';

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'studio', label: 'Studio', icon: ImageIcon },
  { id: 'benchmarks', label: 'Masters', icon: BookOpen },
  { id: 'profile', label: 'Profile', icon: User },
];

type Props = {
  active: TabId;
  onChange: (t: TabId) => void;
};

export function BottomNav({ active, onChange }: Props) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 border-t border-slate-200/90 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.08)]"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg justify-around px-2 pt-1.5">
        {tabs.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex min-w-[4.5rem] flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                on ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon className={on ? 'h-6 w-6' : 'h-6 w-6 opacity-80'} strokeWidth={on ? 2.25 : 2} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
