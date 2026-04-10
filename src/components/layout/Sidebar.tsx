import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Home, BookOpen, Zap, AlertCircle, BarChart2, Settings, Shield, ExternalLink, Bookmark } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import { getMissedQuestions, getReviewQuestions } from '../../utils/dataHelpers';
import { LevelBadge } from '../ui';

const LINKS = [
  { to: '/',        label: 'Home',    Icon: Home },
  { to: '/modules', label: 'Modules', Icon: BookOpen },
  { to: '/quiz',    label: 'Quiz',    Icon: Zap },
  { to: '/missed',  label: 'Missed',  Icon: AlertCircle },
  { to: '/review',  label: 'Review',  Icon: Bookmark },
  { to: '/stats',   label: 'Stats',   Icon: BarChart2 },
];

export const Sidebar: React.FC = () => {
  const activeQuestions = useAppStore(s => s.activeQuestions);
  const userData        = useAppStore(s => s.userData);
  const missedCount     = getMissedQuestions(activeQuestions, userData).length;
  const reviewCount     = getReviewQuestions(activeQuestions, userData).length;

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 min-h-screen bg-surface border-r border-app py-6 px-3">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2.5 px-3 mb-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-sm">
          <Shield size={16} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="font-display font-bold text-xs text-app leading-tight">4A0X1 CDCs</div>
          <div className="font-display font-bold text-xs text-app leading-tight">Study Guide</div>
        </div>
      </Link>

      <div className="px-3 mb-6">
        <LevelBadge level={userData.activeLevel} />
      </div>

      <nav className="flex flex-col gap-1 flex-1" aria-label="Main navigation">
        {LINKS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-display font-medium transition-all duration-150',
              isActive
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                : 'text-muted hover:bg-raised hover:text-app'
            )}
          >
            {({ isActive }) => (
              <>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{label}</span>
                {label === 'Missed' && missedCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
                    {missedCount > 99 ? '99+' : missedCount}
                  </span>
                )}
                {label === 'Review' && reviewCount > 0 && (
                  <span className="ml-auto bg-indigo-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
                    {reviewCount > 99 ? '99+' : reviewCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}

        <a
          href="https://lms-jets.cce.af.mil/moodle/course/section.php?id=99658"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-display font-medium text-muted hover:bg-raised hover:text-app transition-all duration-150"
        >
          <ExternalLink size={18} strokeWidth={1.8} />
          <span>Official CDCs</span>
        </a>
      </nav>

      <NavLink
        to="/settings"
        className={({ isActive }) => clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-display font-medium transition-all duration-150',
          isActive ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-muted hover:bg-raised hover:text-app'
        )}
      >
        <Settings size={18} strokeWidth={1.8} />
        <span>Settings</span>
      </NavLink>
    </aside>
  );
};
