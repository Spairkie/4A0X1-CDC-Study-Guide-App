import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, CheckCircle, Clock, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '../store/useAppStore';
import { calcGroupProgress, getGroupNumbers, pct, formatDate } from '../utils/dataHelpers';
import { ProgressBar, Badge, LevelBadge } from '../components/ui';
import type { CDCLevel } from '../types';

export const Modules: React.FC = () => {
  const { questions, userData } = useAppStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sort, setSort]     = useState<'number' | 'progress' | 'missed'>('number');
  const { activeLevel }     = userData;

  const groups = useMemo(() => {
    const levels: CDCLevel[] = activeLevel === 'both' ? ['5-level', '7-level'] : [activeLevel];
    const result: { level: CDCLevel; groupNumber: number; groupLabel: string }[] = [];
    for (const lvl of levels) {
      for (const num of getGroupNumbers(questions, lvl)) {
        // Derive groupLabel from the first question in the group — no find() needed
        // because getGroupNumbers already filtered by level, so we look it up once.
        const groupLabel = questions.find(q => q.level === lvl && q.groupNumber === num)?.groupLabel ?? 'Module';
        result.push({ level: lvl, groupNumber: num, groupLabel });
      }
    }
    return result;
  }, [questions, activeLevel]);

  const groupStats = useMemo(() =>
    groups.map(g => ({
      ...g,
      progress: calcGroupProgress(g.level, g.groupNumber, questions, userData),
    })),
  [groups, questions, userData]);

  const filtered = useMemo(() => {
    let result = groupStats;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        `${g.groupLabel} ${g.groupNumber}`.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      if (sort === 'progress') return pct(b.progress.seenCount, b.progress.totalQuestions) - pct(a.progress.seenCount, a.progress.totalQuestions);
      if (sort === 'missed')   return b.progress.incorrectCount - a.progress.incorrectCount;
      if (a.level !== b.level) return a.level < b.level ? -1 : 1;
      return a.groupNumber - b.groupNumber;
    });
  }, [groupStats, search, sort]);

  const totalGroups = groups.length;
  const totalQs     = questions.filter(q => activeLevel === 'both' || q.level === activeLevel).length;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-app">Modules & Lessons</h1>
        <p className="text-muted text-sm mt-1">
          {totalGroups} groups · {totalQs} questions · <LevelBadge level={activeLevel} className="ml-1" />
        </p>
      </div>

      {/* Search + sort */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            placeholder="Search groups…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 h-10 bg-surface border border-app rounded-xl text-sm text-app placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value as typeof sort)}
          className="h-10 px-3 bg-surface border border-app rounded-xl text-sm text-app focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Sort by"
        >
          <option value="number">By number</option>
          <option value="progress">By progress</option>
          <option value="missed">By missed</option>
        </select>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map(({ level, groupNumber, groupLabel, progress }) => {
          const completionPct = pct(progress.seenCount,    progress.totalQuestions);
          const masteryPct    = pct(progress.masteredCount, progress.totalQuestions);
          const isComplete    = progress.seenCount === progress.totalQuestions && progress.totalQuestions > 0;
          const routeId       = `${level === '5-level' ? '5' : '7'}-${groupNumber}`;

          return (
            <button
              key={`${level}-${groupNumber}`}
              onClick={() => navigate(`/modules/${routeId}`)}
              className="w-full text-left bg-surface border border-app rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <div className="flex items-start gap-3">
                <div className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                  isComplete ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-indigo-50 dark:bg-indigo-900/20'
                )}>
                  {isComplete
                    ? <CheckCircle size={18} className="text-emerald-600 dark:text-emerald-400" />
                    : <BookOpen    size={18} className="text-indigo-500" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-display font-semibold text-app">{groupLabel} {groupNumber}</h3>
                    <LevelBadge level={level} />
                    {isComplete && <Badge variant="success">Complete</Badge>}
                    {progress.incorrectCount > 0 && <Badge variant="error">{progress.incorrectCount} missed</Badge>}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted mb-3">
                    <span>{progress.totalQuestions} questions</span>
                    {progress.masteredCount > 0 && (
                      <span className="text-amber-600 dark:text-amber-400">⭐ {progress.masteredCount} mastered</span>
                    )}
                    {progress.lastStudiedAt && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {formatDate(progress.lastStudiedAt)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <ProgressBar value={completionPct} size="sm" className="flex-1" />
                    <span className="text-xs text-muted w-8 text-right">{completionPct}%</span>
                  </div>
                  {masteryPct > 0 && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <ProgressBar value={masteryPct} size="sm" variant="success" className="flex-1" />
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 w-8 text-right">{masteryPct}%</span>
                    </div>
                  )}
                </div>

                <ChevronRight size={16} className="text-subtle flex-shrink-0 mt-1" />
              </div>
            </button>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-muted py-12 text-sm">No groups match your search.</p>
        )}
      </div>
    </div>
  );
};
