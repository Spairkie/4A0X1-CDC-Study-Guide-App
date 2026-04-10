import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, AlertCircle, RotateCcw, Home,
  ChevronDown, ChevronUp, HelpCircle, Clock,
} from 'lucide-react';
import { clsx } from 'clsx';
import confetti from 'canvas-confetti';
import { useAppStore, QUESTION_MAP, confirmSessionReplacement } from '../store/useAppStore';
import { calcSessionScore } from '../utils/dataHelpers';
import { Button, Card, ProgressBar, LevelBadge } from '../components/ui';
import type { Session, SessionQuestion } from '../types';

export const ResultsPage: React.FC = () => {
  const navigate = useNavigate();
  const { session, lastCompletedSession, startSession, clearSession, userData } = useAppStore();

  const [showReview, setShowReview]     = useState(false);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'correct' | 'incorrect' | 'unscored'>('all');
  const celebrated = useRef(false);

  // Prefer in-memory completed session; fall back to last persisted one so the
  // results page survives a browser refresh.
  const displaySession: Session | null =
    (session?.completedAt != null ? session : null) ?? lastCompletedSession ?? null;

  const score    = displaySession ? calcSessionScore(displaySession, QUESTION_MAP) : null;
  const scorePct = score ? Math.round((score.correct / Math.max(score.scored, 1)) * 100) : 0;
  const hasUnscored = (score?.unscorableCount ?? 0) > 0;

  // Retry set = questions the user got wrong or timed out on
  const retryIds = displaySession?.questions
    .filter(sq => sq.timedOut || sq.isCorrect === false)
    .map(sq => sq.questionId) ?? [];

  useEffect(() => {
    if (!score || celebrated.current) return;
    celebrated.current = true;
    // Respect the user's animations setting — no confetti if disabled
    if (scorePct >= 80 && userData.settings.animationsEnabled) {
      confetti({
        particleCount: 120, spread: 90, origin: { y: 0.6 },
        colors: ['#6366f1', '#f59e0b', '#10b981'],
      });
    }
  }, [score, scorePct, userData.settings.animationsEnabled]);

  if (!displaySession || !score) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted mb-4">No session results found.</p>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const grade = scorePct >= 90 ? 'Excellent!' : scorePct >= 75 ? 'Good Work!' : scorePct >= 60 ? 'Keep Studying' : 'Needs Review';
  const gradeColor = scorePct >= 90 ? 'text-emerald-500' : scorePct >= 75 ? 'text-indigo-500' : scorePct >= 60 ? 'text-amber-500' : 'text-red-500';

  const reviewQuestions = displaySession.questions.filter(sq => {
    if (reviewFilter === 'correct')   return sq.isCorrect === true;
    if (reviewFilter === 'incorrect') return sq.isCorrect === false || sq.timedOut;
    if (reviewFilter === 'unscored')  return sq.isCorrect === null && !sq.timedOut;
    return true;
  });

  const retryMissed = () => {
    if (!retryIds.length) return;
    if (!confirmSessionReplacement()) return;
    if (startSession('missed', retryIds)) navigate('/session');
  };

  const retryAll = () => {
    if (!confirmSessionReplacement()) return;
    // BUG FIX #4: Build a map of original choice orders so "Retry Exact Set"
    // preserves the same answer arrangement the user originally saw.
    const choiceOrders = new Map(
      displaySession.questions.map(sq => [sq.questionId, sq.choiceOrder])
    );
    if (startSession(displaySession.mode, displaySession.originalQuestionIds, true, choiceOrders)) navigate('/session');
  };

  const sessionTimeMs = displaySession.questions.reduce((s, q) => s + (q.timeSpentMs ?? 0), 0);
  const mins = Math.floor(sessionTimeMs / 60000);
  const secs = Math.floor((sessionTimeMs % 60000) / 1000);
  const timeLabel = sessionTimeMs >= 1000
    ? (mins > 0 ? `${mins}m ${secs}s` : `${secs}s`)
    : null;

  return (
    <div className="min-h-screen bg-subtle">
      <div className="max-w-2xl mx-auto px-4 py-8 animate-slide-up">

        {/* Score hero */}
        <Card className="text-center mb-5 py-8">
          <div className={clsx('font-display font-bold text-5xl mb-1', gradeColor)}>{scorePct}%</div>
          <div className="font-display font-semibold text-xl text-app mb-1">{grade}</div>
          <div className="flex justify-center mb-4">
            <LevelBadge level={displaySession.level} />
          </div>

          <div className="flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle size={16} />
              <span className="font-semibold">{score.correct}</span>
              <span className="text-muted">correct</span>
            </div>
            <div className="flex items-center gap-1.5 text-red-500">
              <XCircle size={16} />
              <span className="font-semibold">{score.incorrect}</span>
              <span className="text-muted">incorrect</span>
            </div>
            {score.unanswered > 0 && (
              <div className="flex items-center gap-1.5 text-muted">
                <AlertCircle size={16} />
                <span className="font-semibold">{score.unanswered}</span>
                <span>skipped</span>
              </div>
            )}
          </div>

          {score.unscorableCount > 0 && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <HelpCircle size={13} />
              {score.unscorableCount} unscored (no official answer key)
            </div>
          )}

          <div className="mt-4 px-8">
            <ProgressBar
              value={scorePct}
              variant={scorePct >= 80 ? 'success' : scorePct >= 60 ? 'brand' : 'error'}
              size="md"
              animated
            />
          </div>

          {timeLabel && (
            <p className="text-subtle text-xs mt-3 flex items-center justify-center gap-1">
              <Clock size={11} /> Time spent: {timeLabel}
            </p>
          )}
        </Card>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: 'Total',    value: displaySession.questions.length },
            { label: 'Scorable', value: score.scored },
            { label: 'Accuracy', value: `${scorePct}%` },
          ].map(({ label, value }) => (
            <Card key={label} className="text-center py-3">
              <div className="font-display font-bold text-xl text-app">{value}</div>
              <div className="text-muted text-xs mt-0.5">{label}</div>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mb-6">
          {retryIds.length > 0 && (
            <Button size="lg" fullWidth onClick={retryMissed} className="gap-2">
              <RotateCcw size={16} /> Retry {retryIds.length} Missed Question{retryIds.length !== 1 ? 's' : ''}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button size="md" variant="secondary" fullWidth onClick={retryAll}>
              Retry Exact Set
            </Button>
            <Button size="md" variant="secondary" fullWidth onClick={() => { clearSession(); navigate('/'); }}>
              <Home size={16} /> Home
            </Button>
          </div>
        </div>

        {/* Review toggle */}
        <button
          onClick={() => setShowReview(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface border border-app rounded-2xl text-sm font-display font-semibold text-app"
          aria-expanded={showReview}
        >
          <span>Review Answers</span>
          {showReview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showReview && (
          <div className="mt-3 animate-slide-up">
            <div className="flex gap-2 mb-3 flex-wrap">
              {(['all', 'correct', 'incorrect', ...(hasUnscored ? ['unscored'] : [])] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setReviewFilter(f as typeof reviewFilter)}
                  className={clsx(
                    'px-3 py-1.5 rounded-xl text-xs font-display font-semibold transition-colors',
                    reviewFilter === f
                      ? 'bg-indigo-500 text-white'
                      : 'bg-surface border border-app text-muted hover:text-app'
                  )}
                >
                  {f === 'unscored' ? 'Unscored' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {reviewQuestions.map(sq => (
                <ReviewItem key={sq.questionId} sq={sq} />
              ))}
              {reviewQuestions.length === 0 && (
                <p className="text-center text-muted py-6 text-sm">No questions match this filter.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Review item ───────────────────────────────────────────────────────────

const ReviewItem: React.FC<{ sq: SessionQuestion }> = ({ sq }) => {
  const [open, setOpen] = useState(false);
  const q = QUESTION_MAP.get(sq.questionId);
  if (!q) return null;

  const isWrong   = sq.isCorrect === false || sq.timedOut;
  const borderColor =
    sq.isCorrect === true ? 'border-emerald-200 dark:border-emerald-800' :
    isWrong               ? 'border-red-200 dark:border-red-800' :
    'border-app';

  return (
    <div className={clsx('bg-surface border-2 rounded-2xl overflow-hidden', borderColor)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 p-3.5 text-left"
        aria-expanded={open}
      >
        <div className={clsx(
          'w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0',
          sq.isCorrect === true ? 'bg-emerald-100 dark:bg-emerald-900/40' :
          isWrong               ? 'bg-red-100 dark:bg-red-900/40' : 'bg-raised'
        )}>
          {sq.isCorrect === true ? <CheckCircle size={14} className="text-emerald-600 dark:text-emerald-400" /> :
           isWrong               ? <XCircle     size={14} className="text-red-500" /> :
           <HelpCircle size={14} className="text-muted" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted mb-0.5">
            {q.groupLabel} {q.groupNumber} · Q{q.questionNumber}
            {sq.timedOut && <span className="ml-1 text-red-500">(timed out)</span>}
          </p>
          <p className="text-sm text-app truncate">{q.text}</p>
        </div>
        {open ? <ChevronUp size={14} className="text-subtle flex-shrink-0" /> : <ChevronDown size={14} className="text-subtle flex-shrink-0" />}
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 border-t border-app pt-3">
          <p className="text-app text-sm mb-3">{q.text}</p>
          <div className="space-y-1">
            {/* Use sq.choiceOrder so choices appear in the same order the user saw them */}
            {sq.choiceOrder
              .filter(key => q.choices[key] !== undefined)
              .map(key => (
                <div key={key} className={clsx(
                  'flex items-start gap-2 px-3 py-2 rounded-xl text-sm',
                  key === q.correctAnswer
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'
                    : key === sq.selectedAnswer && key !== q.correctAnswer
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'text-muted'
                )}>
                  <span className="font-semibold uppercase w-4 flex-shrink-0">{key}</span>
                  <span>{q.choices[key]}</span>
                </div>
              ))}
          </div>
          {sq.timedOut && (
            <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
              <Clock size={11} /> Time expired — no answer selected
            </p>
          )}
        </div>
      )}
    </div>
  );
};
