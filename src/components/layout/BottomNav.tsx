import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, BookOpen, Zap, AlertCircle, BarChart2, Settings, Bookmark } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import { getMissedQuestions, getReviewQuestions } from '../../utils/dataHelpers';

// All 7 nav items — matches the desktop sidebar for full parity.
// Icons are slightly smaller (18px) to fit comfortably across the bar.
const LINKS = [
  { to: '/',         label: 'Home',     Icon: Home },
  { to: '/modules',  label: 'Modules',  Icon: BookOpen },
  { to: '/quiz',     label: 'Quiz',     Icon: Zap },
  { to: '/missed',   label: 'Missed',   Icon: AlertCircle },
  { to: '/review',   label: 'Review',   Icon: Bookmark },
  { to: '/stats',    label: 'Stats',    Icon: BarChart2 },
  { to: '/settings', label: 'Settings', Icon: Settings },
];

export const BottomNav: React.FC = () => {
  const activeQuestions = useAppStore(s => s.activeQuestions);
  const userData        = useAppStore(s => s.userData);
  const missedCount     = getMissedQuestions(activeQuestions, userData).length;
  const reviewCount     = getReviewQuestions(activeQuestions, userData).length;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-surface/90 backdrop-blur-xl border-t border-app safe-bottom md:hidden"
      aria-label="Main navigation"
    >
      <div className="flex items-stretch">
        {LINKS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-display font-semibold transition-colors duration-150',
              isActive ? 'text-indigo-500' : 'text-muted hover:text-app'
            )}
            aria-label={label}
          >
            {({ isActive }) => (
              <>
                <div className={clsx(
                  'relative p-1 rounded-xl transition-colors',
                  isActive && 'bg-indigo-50 dark:bg-indigo-900/30'
                )}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                  {label === 'Missed' && missedCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                      {missedCount > 99 ? '99+' : missedCount}
                    </span>
                  )}
                  {label === 'Review' && reviewCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 bg-indigo-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center leading-none">
                      {reviewCount > 99 ? '99+' : reviewCount}
                    </span>
                  )}
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
