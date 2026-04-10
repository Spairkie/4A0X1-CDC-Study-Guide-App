import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, BookOpen, Zap, X, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore, QUESTION_MAP, confirmSessionReplacement } from '../store/useAppStore';
import { getReviewQuestions } from '../utils/dataHelpers';
import { Button, Card, Badge, EmptyState, LevelBadge } from '../components/ui';
import type { CDCLevel } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────

function reviewDueLabel(nextReviewAt: number | null): { label: string; urgent: boolean } {
  if (nextReviewAt === null) return { label: 'Due now', urgent: true };
  const diffMs   = nextReviewAt - Date.now();
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays <= 0)  return { label: 'Due today', urgent: true };
  if (diffDays === 1) return { label: 'Due tomorrow', urgent: false };
  return { label: `Due in ${diffDays}d`, urgent: false };
}

type SortKey = 'due' | 'level' | 'status';

// ─── Page ─────────────────────────────────────────────────────────────────

export const ReviewPage: React.FC = () => {
  const { activeQuestions, userData, startSession, updateQuestionProgress } = useAppStore();
  const navigate  = useNavigate();
  const [sort, setSort] = useState<SortKey>('due');
  const [levelFilter, setLevelFilter] = useState<CDCLevel | 'both'>('both');

  const allReview = useMemo(
    () => getReviewQuestions(activeQuestions, userData),
    [activeQuestions, userData]
  );

  const filtered = useMemo(() => {
    let list = levelFilter === 'both'
      ? allReview
      : allReview.filter(q => q.level === levelFilter);

    return [...list].sort((a, b) => {
      const pa = userData.questions[a.id];
      const pb = userData.questions[b.id];
      if (sort === 'due') {
        const da = pa?.nextReviewAt ?? 0;
        const db = pb?.nextReviewAt ?? 0;
        return da - db; // soonest first
      }
      if (sort === 'level') {
        if (a.level !== b.level) return a.level < b.level ? -1 : 1;
        return a.groupNumber - b.groupNumber;
      }
      // sort === 'status': incorrect first, then correct, then unseen
      const ORDER: Record<string, number> = { incorrect: 0, seen: 1, correct: 2, mastered: 3, unseen: 4 };
      return (ORDER[pa?.status ?? 'unseen'] ?? 4) - (ORDER[pb?.status ?? 'unseen'] ?? 4);
    });
  }, [allReview, levelFilter, sort, userData.questions]);

  const dueCount = useMemo(
    () => filtered.filter(q => (userData.questions[q.id]?.nextReviewAt ?? 0) <= Date.now()).length,
    [filtered, userData.questions]
  );

  const startStudy = (mode: 'study' | 'quiz') => {
    if (!confirmSessionReplacement()) return;
    const ids = filtered.map(q => q.id);
    if (startSession(mode, ids)) navigate('/session');
  };

  const startDueOnly = () => {
    if (!confirmSessionReplacement()) return;
    const ids = filtered
      .filter(q => (userData.questions[q.id]?.nextReviewAt ?? 0) <= Date.now())
      .map(q => q.id);
    if (!ids.length) return;
    if (startSession('review', ids)) navigate('/session');
  };

  const removeBookmark = (id: string) => {
    updateQuestionProgress(id, { isMarkedForReview: false });
  };

  if (allReview.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <h1 className="font-display font-bold text-2xl text-app mb-6">Review</h1>
        <EmptyState
          icon={<Bookmark size={32} className="text-indigo-400" />}
          title="No bookmarked questions"
          description="Tap the bookmark icon on any question during a session to add it here for focused review."
          action={<Button onClick={() => navigate('/quiz')}>Start a Session</Button>}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-app">Review</h1>
          <p className="text-muted text-sm mt-1">
            {allReview.length} bookmarked · {dueCount > 0 ? `${dueCount} due now` : 'none due yet'}
          </p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <Bookmark size={20} className="text-indigo-500" />
        </div>
      </div>

      {/* Level filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['both', '5-level', '7-level'] as const).map(lvl => (
          <button
            key={lvl}
            onClick={() => setLevelFilter(lvl)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold border-2 transition-all',
              levelFilter === lvl
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                : 'border-border bg-surface text-muted hover:border-slate-300 dark:hover:border-slate-600'
            )}
          >
            <LevelBadge level={lvl} />
            {lvl === 'both' ? 'All' : lvl === '5-level' ? '5-Level' : '7-Level'}
          </button>
        ))}

        <select
          value={sort}
          onChange={e => setSort(e.target.value as SortKey)}
          className="ml-auto h-8 px-2 bg-surface border border-app rounded-xl text-xs text-app focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label="Sort bookmarks"
        >
          <option value="due">Sort: Due date</option>
          <option value="level">Sort: Level/Group</option>
          <option value="status">Sort: Status</option>
        </select>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Button onClick={() => startStudy('study')} variant="secondary" fullWidth className="gap-1.5">
          <BookOpen size={16} /> Study All
        </Button>
        <Button onClick={() => startStudy('quiz')} fullWidth className="gap-1.5">
          <Zap size={16} /> Test All
        </Button>
      </div>

      {dueCount > 0 && (
        <button
          onClick={startDueOnly}
          className="w-full mb-5 flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3 hover:shadow-sm transition-all text-left"
        >
          <Clock size={18} className="text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-display font-semibold text-amber-800 dark:text-amber-300">
              Study {dueCount} due question{dueCount !== 1 ? 's' : ''} now
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Spaced repetition — these are ready for review
            </p>
          </div>
        </button>
      )}

      {/* Question list */}
      <div className="flex flex-col gap-2">
        {filtered.map(q => {
          const p    = userData.questions[q.id];
          const due  = reviewDueLabel(p?.nextReviewAt ?? null);
          return (
            <Card key={q.id} padded hoverable className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <LevelBadge level={q.level} />
                  <Badge variant="neutral">{q.groupLabel} {q.groupNumber} · Q{q.questionNumber}</Badge>
                  <span className={clsx(
                    'text-[10px] font-display font-semibold px-2 py-0.5 rounded-full',
                    due.urgent
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'bg-slate-100 dark:bg-slate-800 text-muted'
                  )}>
                    <Clock size={9} className="inline mr-0.5 -mt-0.5" />
                    {due.label}
                  </span>
                  {p?.status === 'mastered' && (
                    <span className="text-[10px] font-display font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle size={9} className="inline mr-0.5 -mt-0.5" /> Mastered
                    </span>
                  )}
                  {p?.status === 'incorrect' && (
                    <span className="text-[10px] font-display font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                      <AlertCircle size={9} className="inline mr-0.5 -mt-0.5" /> Needs work
                    </span>
                  )}
                </div>
                <p className="text-sm text-app line-clamp-2">{q.text}</p>
                {p?.correctCount !== undefined && p.correctCount + p.incorrectCount > 0 && (
                  <p className="text-xs text-muted mt-1">
                    {p.correctCount} correct · {p.incorrectCount} incorrect
                  </p>
                )}
              </div>
              <button
                onClick={() => removeBookmark(q.id)}
                aria-label="Remove bookmark"
                title="Remove from review list"
                className="flex-shrink-0 p-1.5 rounded-lg text-indigo-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <X size={14} />
              </button>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-muted py-8 text-sm">No bookmarks match this filter.</p>
        )}
      </div>
    </div>
  );
};
