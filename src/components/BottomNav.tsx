import { ImageIcon, BookOpen, User } from 'lucide-react';
import type { TabId } from '../types';

const LINK_TABS: { id: TabId; label: string; icon: typeof ImageIcon }[] = [
  { id: 'studio', label: 'Studio', icon: ImageIcon },
  { id: 'benchmarks', label: 'Masters', icon: BookOpen },
  { id: 'profile', label: 'Profile', icon: User },
];

const ICON_SLOT = 'flex h-9 w-9 shrink-0 items-center justify-center';

type Props = {
  active: TabId;
  onChange: (t: TabId) => void;
  /** Opens the critique flow at Style & medium (replaces former Home tab slot). */
  onStartCritique: () => void;
};

export function BottomNav({ active, onChange, onStartCritique }: Props) {
  const critiqueOn = active === 'home';

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-20 border-t border-slate-200/90 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_24px_-8px_rgba(15,23,42,0.08)]"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-lg items-end justify-around px-2 pt-1.5">
        <button
          type="button"
          onClick={onStartCritique}
          className={`flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
            critiqueOn ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'
          }`}
          aria-label="New critique — style and medium"
        >
          <span className={ICON_SLOT}>
            <img
              src={`${import.meta.env.BASE_URL}critique.png`}
              alt=""
              className={`h-full w-full object-contain object-center ${critiqueOn ? '' : 'opacity-80'}`}
              width={36}
              height={36}
              decoding="async"
              aria-hidden
            />
          </span>
          Critique
        </button>
        {LINK_TABS.map(({ id, label, icon: Icon }) => {
          const on = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                on ? 'text-violet-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className={ICON_SLOT}>
                <Icon className={`h-6 w-6 ${on ? '' : 'opacity-80'}`} strokeWidth={on ? 2.25 : 2} />
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
