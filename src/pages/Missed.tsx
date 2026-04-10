import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Zap, BookOpen, RefreshCw, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore, confirmSessionReplacement } from '../store/useAppStore';
import { getMissedQuestions } from '../utils/dataHelpers';
import { Button, Card, Badge, EmptyState, LevelBadge } from '../components/ui';
import type { CDCLevel } from '../types';

type FilterType = 'all' | 'by-group' | 'favorites' | 'high-miss';

export const Missed: React.FC = () => {
  const { questions, activeQuestions, userData, startSession, resetQuestionProgress } = useAppStore();
  const navigate = useNavigate();
  const [filter, setFilter]               = useState<FilterType>('all');
  const [selectedGroup, setSelectedGroup] = useState<{ level: CDCLevel; num: number } | null>(null);

  const allMissed = getMissedQuestions(activeQuestions, userData);

  const missedGroups = useMemo(() => {
    const seen = new Set<string>();
    const result: { level: CDCLevel; num: number; label: string }[] = [];
    for (const q of allMissed) {
      const key = `${q.level}-${q.groupNumber}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ level: q.level, num: q.groupNumber, label: `${q.groupLabel} ${q.groupNumber}` });
      }
    }
    return result.sort((a, b) => a.level < b.level ? -1 : a.level > b.level ? 1 : a.num - b.num);
  }, [allMissed]);

  const filteredMissed = useMemo(() => {
    switch (filter) {
      case 'by-group':
        return selectedGroup
          ? allMissed.filter(q => q.level === selectedGroup.level && q.groupNumber === selectedGroup.num)
          : allMissed;
      case 'favorites':
        return allMissed.filter(q => userData.questions[q.id]?.isFavorite);
      case 'high-miss':
        return allMissed
          .filter(q => (userData.questions[q.id]?.incorrectCount ?? 0) >= 2)
          .sort((a, b) => (userData.questions[b.id]?.incorrectCount ?? 0) - (userData.questions[a.id]?.incorrectCount ?? 0));
      default:
        return allMissed;
    }
  }, [filter, allMissed, selectedGroup, userData]);

  const startMissedSession = (mode: 'study' | 'quiz') => {
    if (!confirmSessionReplacement()) return;
    const ids = filteredMissed.map(q => q.id);
    if (startSession(mode, ids)) navigate('/session');
  };

  if (allMissed.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="font-display font-bold text-2xl text-app mb-6">Missed Questions</h1>
        <EmptyState
          icon="✅"
          title="No missed questions!"
          description="You haven't missed any questions yet, or you've mastered everything in your current dataset."
          action={<Button onClick={() => navigate('/quiz')}>Start a Session</Button>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-app">Missed Questions</h1>
          <p className="text-muted text-sm mt-1">{allMissed.length} questions need attention</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <AlertCircle size={20} className="text-red-500" />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 mb-4">
        {([
          { key: 'all',      label: `All (${allMissed.length})` },
          { key: 'by-group', label: 'By Group' },
          { key: 'high-miss',label: 'Most Troublesome' },
          { key: 'favorites',label: '⭐ Favorites' },
        ] as { key: FilterType; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-display font-semibold transition-colors',
              filter === key ? 'bg-indigo-500 text-white' : 'bg-surface border border-app text-muted hover:text-app'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Group picker */}
      {filter === 'by-group' && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setSelectedGroup(null)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-display font-semibold border transition-colors',
              !selectedGroup ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-surface border-app text-muted hover:text-app'
            )}
          >All</button>
          {missedGroups.map(g => (
            <button
              key={`${g.level}-${g.num}`}
              onClick={() => setSelectedGroup({ level: g.level, num: g.num })}
              className={clsx(
                'flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-display font-semibold border transition-colors',
                selectedGroup?.level === g.level && selectedGroup?.num === g.num
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-surface border-app text-muted hover:text-app'
              )}
            >
              <LevelBadge level={g.level} />
              {g.label}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Button onClick={() => startMissedSession('study')} variant="secondary" fullWidth className="gap-1.5">
          <BookOpen size={16} /> Study Mode
        </Button>
        <Button onClick={() => startMissedSession('quiz')} fullWidth className="gap-1.5">
          <Zap size={16} /> Test Mode
        </Button>
      </div>

      {/* Question list */}
      <div className="flex flex-col gap-2">
        {filteredMissed.map(q => {
          const p         = userData.questions[q.id];
          const missCount = p?.incorrectCount ?? 0;
          return (
            <Card key={q.id} padded hoverable className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <LevelBadge level={q.level} />
                  <Badge variant="neutral">{q.groupLabel} {q.groupNumber} · Q{q.questionNumber}</Badge>
                  {missCount >= 3 && <Badge variant="error">Tricky ({missCount}×)</Badge>}
                  {p?.isFavorite && <Star size={12} className="text-amber-500" />}
                </div>
                <p className="text-sm text-app line-clamp-2">{q.text}</p>
                {p?.lastAnswer && (
                  <p className="text-xs text-muted mt-1">
                    Your answer: <span className="uppercase font-semibold text-red-500">{p.lastAnswer}</span>
                    {q.correctAnswer && <> · Correct: <span className="uppercase font-semibold text-emerald-600">{q.correctAnswer}</span></>}
                  </p>
                )}
              </div>
              <button
                onClick={() => resetQuestionProgress(q.id)}
                aria-label="Reset progress for this question"
                title="Reset mastery"
                className="flex-shrink-0 p-1.5 rounded-lg text-subtle hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <RefreshCw size={14} />
              </button>
            </Card>
          );
        })}
        {filteredMissed.length === 0 && (
          <p className="text-center text-muted py-8 text-sm">No questions match this filter.</p>
        )}
      </div>
    </div>
  );
};
