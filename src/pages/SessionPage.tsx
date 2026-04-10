import React, { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckSquare, X, Clock, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import confetti from 'canvas-confetti';
import { useAppStore, QUESTION_MAP } from '../store/useAppStore';
import { QuestionCard } from '../components/quiz/QuestionCard';
import { Button, ProgressBar, LevelBadge } from '../components/ui';
import type { AnswerKey } from '../types';

const MODE_LABELS: Record<string, string> = {
  study: 'Study', quiz: 'Test', random: 'Random',
  missed: 'Missed', favorites: 'Favorites', unseen: 'New', review: 'Review',
};

// ─── Web Audio API sound effects ──────────────────────────────────────────

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === 'closed') {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      _audioCtx = new Ctor();
    }
    if (_audioCtx.state === 'suspended') _audioCtx.resume();
    return _audioCtx;
  } catch {
    return null;
  }
}

function playTone(correct: boolean | null) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (correct === true) {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } else if (correct === false) {
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch { /* Web Audio not supported */ }
}

function hapticFeedback(pattern: number | number[]) {
  try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
}

// ─── Component ────────────────────────────────────────────────────────────

export const SessionPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    session, userData,
    answerSessionQuestion, timeoutSessionQuestion,
    goToSessionQuestion, completeSession, abandonSession,
    toggleFavorite, toggleFlag, toggleReview,
    storageError, clearStorageError,
  } = useAppStore();

  const [timeLeft, setTimeLeft]       = useState<number | null>(null);
  const [showAbandon, setShowAbandon] = useState(false);
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const handleNextRef   = useRef<() => void>(() => {});
  const celebratedRef   = useRef<Set<string>>(new Set());
  // Track which questionIds have already triggered sound/haptics this session.
  // Using a ref (not state) means it survives re-renders without causing them.
  const soundPlayedRef  = useRef<Set<string>>(new Set());
  const questionStartRef = useRef<number>(Date.now());
  const timerFiredRef   = useRef(false);

  const { settings } = userData;

  const currentSQ = session?.questions[session.currentIndex ?? 0];
  const currentQ  = currentSQ ? QUESTION_MAP.get(currentSQ.questionId) ?? null : null;
  const progress  = currentQ ? userData.questions[currentQ.id] ?? null : null;

  // showFeedback is baked into the session at creation time:
  //   quiz  → false (never reveal until results)
  //   study → true (always immediate)
  //   other → respects user's instantFeedback setting
  const showFeedbackImmediately = session?.showFeedback ?? true;
  const hasAnswered    = !!(currentSQ?.selectedAnswer || currentSQ?.timedOut);
  const isRevealed     = showFeedbackImmediately && hasAnswered;
  const isLastQuestion = session ? session.currentIndex === session.questions.length - 1 : false;
  const allAnswered    = session?.questions.every(q => q.selectedAnswer !== null || q.timedOut) ?? false;
  const showFinish     = allAnswered && isLastQuestion;

  // Progress bar reflects truly answered questions, not cursor position
  const answeredCount = session?.questions.filter(q => q.selectedAnswer !== null || q.timedOut).length ?? 0;

  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [session?.currentIndex]);

  const handleNext = useCallback(() => {
    if (!session) return;
    if (isLastQuestion) { completeSession(); navigate('/results'); }
    else goToSessionQuestion(session.currentIndex + 1);
  }, [session, isLastQuestion, completeSession, navigate, goToSessionQuestion]);

  handleNextRef.current = handleNext;

  // ── Timer countdown ───────────────────────────────────────────────────────
  // Starts a new countdown when the current question is unanswered.
  // Clears itself when the question becomes answered (selectedAnswer or timedOut).
  // FIX: Added currentSQ?.selectedAnswer and currentSQ?.timedOut to deps so the
  // effect re-runs and clears the interval the moment an answer is recorded.
  useEffect(() => {
    if (!session?.timedMode) { setTimeLeft(null); return; }

    const sq = session.questions[session.currentIndex];
    if (sq?.selectedAnswer !== null || sq?.timedOut) {
      // Already resolved — kill any running timer and hide the display
      setTimeLeft(null);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }

    const secs = settings.timerSeconds;
    setTimeLeft(secs);
    timerFiredRef.current = false;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.currentIndex, session?.timedMode, settings.timerSeconds,
      currentSQ?.selectedAnswer, currentSQ?.timedOut]);

  // ── Timeout handler ───────────────────────────────────────────────────────
  // BUG FIX #1: Guard against race condition where the user answers at the
  // exact last second. timeoutSessionQuestion() already no-ops when the
  // question is answered, but the delayed handleNext() could still fire and
  // force an unwanted advance. We now re-read the session state inside the
  // timeout callback and only advance if the question was genuinely timed out.
  useEffect(() => {
    if (timeLeft !== 0 || !session?.timedMode) return;
    if (timerFiredRef.current) return;
    timerFiredRef.current = true;

    timeoutSessionQuestion();
    // Brief pause so the user sees the timed-out state before auto-advancing
    const t = setTimeout(() => {
      // Re-read current session state to avoid race with last-second answers
      const currentSession = useAppStore.getState().session;
      if (!currentSession) return;
      const sq = currentSession.questions[currentSession.currentIndex];
      // Only auto-advance if this question was actually timed out
      // (not if the user squeezed in an answer at the last moment)
      if (sq?.timedOut) {
        handleNextRef.current();
      }
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  const handleAnswer = useCallback((key: AnswerKey) => {
    if (!currentSQ || currentSQ.selectedAnswer || currentSQ.timedOut) return;
    const timeSpentMs = Date.now() - questionStartRef.current;
    answerSessionQuestion(key, timeSpentMs);
  }, [currentSQ, answerSessionQuestion]);

  // ── Mastery confetti — only in feedback-on modes, only if animations enabled ──
  useEffect(() => {
    if (!currentQ || !settings.animationsEnabled || !showFeedbackImmediately) return;
    const p = userData.questions[currentQ.id];
    if (
      p?.status === 'mastered' &&
      p.masteredAt !== null &&
      Date.now() - p.masteredAt < 3000 &&
      !celebratedRef.current.has(currentQ.id)
    ) {
      celebratedRef.current.add(currentQ.id);
      confetti({
        particleCount: 80, spread: 70, origin: { y: 0.7 },
        colors: ['#6366f1', '#f59e0b', '#10b981'],
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ?.id, userData.questions, settings.animationsEnabled, showFeedbackImmediately]);

  // ── Sound + haptics ───────────────────────────────────────────────────────
  // Guards:
  //   1. Never in test mode (leaks correctness)
  //   2. Never for a question that already played sound (prevents replay on nav-back)
  //   3. Fires only once per question per session via soundPlayedRef
  useEffect(() => {
    if (!currentSQ?.selectedAnswer || !currentQ) return;
    if (!showFeedbackImmediately) return;
    // Already played for this question — don't replay when navigating back
    if (soundPlayedRef.current.has(currentQ.id)) return;
    soundPlayedRef.current.add(currentQ.id);

    const correct = currentSQ.isCorrect;
    if (settings.soundEnabled)   playTone(correct);
    if (settings.hapticsEnabled) hapticFeedback(correct === true ? 50 : correct === false ? [50, 30, 50] : 20);
  // Depend on currentQ.id so we re-check when switching questions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSQ?.selectedAnswer, currentQ?.id, showFeedbackImmediately]);

  const handleBack = useCallback(() => {
    if (!session || session.currentIndex === 0) return;
    goToSessionQuestion(session.currentIndex - 1);
  }, [session, goToSessionQuestion]);

  const handleFinish = useCallback(() => {
    completeSession(); navigate('/results');
  }, [completeSession, navigate]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (showAbandon) { if (e.key === 'Escape') setShowAbandon(false); return; }
      const key = e.key.toLowerCase();
      if (['a','b','c','d'].includes(key) && !hasAnswered) {
        handleAnswer(key as AnswerKey);
      } else if ((key === 'arrowright' || key === 'enter') && hasAnswered) {
        // Require an answer before advancing in all modes (study and test alike)
        handleNext();
      } else if (key === 'arrowleft') {
        handleBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleAnswer, handleNext, handleBack, hasAnswered, showAbandon]);

  // ── Guard clauses ─────────────────────────────────────────────────────────

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <p className="text-muted text-center">No active session.</p>
        <Button onClick={() => navigate('/quiz')}>Start a Quiz</Button>
      </div>
    );
  }
  if (!currentSQ || !currentQ) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <p className="text-muted text-center">Session question not found.</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => { abandonSession(); navigate('/'); }}>Home</Button>
          <Button onClick={() => navigate('/quiz')}>New Quiz</Button>
        </div>
      </div>
    );
  }

  const progressPct = Math.round((answeredCount / session.questions.length) * 100);

  // Progress dot colors
  const getDotColor = (idx: number, sq: typeof currentSQ) => {
    if (idx === session.currentIndex) return 'bg-indigo-500 scale-125';
    if (sq.selectedAnswer !== null || sq.timedOut) {
      if (showFeedbackImmediately) {
        if (sq.isCorrect === true)  return 'bg-emerald-400';
        if (sq.isCorrect === false) return 'bg-red-400';
        return 'bg-slate-400'; // unscored
      }
      // Test mode — hide correctness, show only that it's been answered
      return 'bg-indigo-300 dark:bg-indigo-600';
    }
    return 'bg-slate-200 dark:bg-slate-700';
  };

  return (
    <div className="min-h-screen bg-subtle flex flex-col">

      {/* Abandon confirmation overlay */}
      {showAbandon && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl p-6 max-w-sm w-full shadow-xl animate-bounce-in">
            <h3 className="font-display font-bold text-lg text-app mb-2">Abandon Session?</h3>
            <p className="text-muted text-sm mb-5">
              This will permanently discard your current session. Per-question progress is already saved.
            </p>
            <div className="flex gap-3">
              <Button variant="danger" fullWidth onClick={() => { abandonSession(); navigate('/quiz'); }}>
                <Trash2 size={15} /> Abandon
              </Button>
              <Button variant="secondary" fullWidth onClick={() => setShowAbandon(false)}>
                Keep Going
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-surface/90 backdrop-blur-sm border-b border-border sticky top-0 z-30 safe-top">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-1.5 rounded-xl hover:bg-raised text-muted hover:text-app transition-colors flex-shrink-0"
              aria-label="Pause session — returns to home, session stays saved"
              title="Pause — resume later from home"
            >
              <X size={18} />
            </button>

            <div className="flex-1 min-w-0">
              <ProgressBar value={progressPct} size="md" />
            </div>

            <span className="text-xs font-display font-semibold text-muted flex-shrink-0">
              {session.currentIndex + 1}/{session.questions.length}
            </span>

            {session.timedMode && timeLeft !== null && (
              <div className={clsx(
                'flex items-center gap-1 text-sm font-display font-bold px-2 py-1 rounded-lg flex-shrink-0',
                timeLeft <= 5 ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-muted'
              )}>
                <Clock size={14} />
                {timeLeft}s
              </div>
            )}

            <button
              onClick={() => setShowAbandon(true)}
              className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-subtle hover:text-red-500 transition-colors flex-shrink-0"
              aria-label="Abandon session"
              title="Abandon session"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs font-display font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
              {MODE_LABELS[session.mode] ?? session.mode} Mode
            </span>
            <LevelBadge level={session.level} />
            {!showFeedbackImmediately && (
              <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full font-medium">
                Results revealed at the end
              </span>
            )}
            <span className="text-xs text-subtle ml-auto hidden sm:block">
              Tap X to pause and save
            </span>
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 overflow-y-auto">
        <QuestionCard
          question={currentQ}
          sessionQ={currentSQ}
          progress={progress}
          groupLabel={`${currentQ.groupLabel} ${currentQ.groupNumber}`}
          questionLabel={`Q${currentQ.questionNumber}`}
          revealed={isRevealed}
          onAnswer={handleAnswer}
          onToggleFavorite={() => toggleFavorite(currentQ.id)}
          onToggleFlag={() => toggleFlag(currentQ.id)}
          onToggleReview={() => toggleReview(currentQ.id)}
        />
        <div className="mt-4 text-center text-xs text-subtle hidden md:block select-none">
          <kbd className="px-1.5 py-0.5 bg-raised rounded text-xs">A</kbd>–
          <kbd className="px-1.5 py-0.5 bg-raised rounded text-xs">D</kbd> to answer ·{' '}
          <kbd className="px-1.5 py-0.5 bg-raised rounded text-xs">→</kbd> to continue
        </div>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 bg-surface/90 backdrop-blur-sm border-t border-border safe-bottom">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleBack}
            disabled={session.currentIndex === 0}
            className="p-2.5 rounded-xl border border-border hover:bg-raised text-muted disabled:opacity-30 transition-colors flex-shrink-0"
            aria-label="Previous question"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Progress dots */}
          <div className="flex-1 flex items-center justify-center gap-1 overflow-hidden min-w-0">
            {session.questions
              .slice(
                Math.max(0, session.currentIndex - 5),
                Math.min(session.questions.length, session.currentIndex + 6)
              )
              .map((sq, i) => {
                const idx = Math.max(0, session.currentIndex - 5) + i;
                return (
                  <button
                    key={idx}
                    onClick={() => goToSessionQuestion(idx)}
                    className={clsx(
                      'w-2.5 h-2.5 rounded-full transition-all flex-shrink-0',
                      getDotColor(idx, sq)
                    )}
                    aria-label={`Go to question ${idx + 1}`}
                  />
                );
              })}
          </div>

          {showFinish ? (
            <Button onClick={handleFinish} className="gap-2 flex-shrink-0">
              <CheckSquare size={16} /> Finish
            </Button>
          ) : (
            <button
              onClick={handleNext}
              // Must answer before advancing in both study and test mode.
              // Study mode: feedback is shown first, then advance.
              // Test mode: answer is locked in before moving forward.
              disabled={!hasAnswered}
              className={clsx(
                'flex items-center gap-1.5 px-5 h-10 rounded-xl font-display font-semibold text-sm transition-all flex-shrink-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                hasAnswered
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600 active:scale-95'
                  : 'bg-raised text-subtle cursor-not-allowed'
              )}
              aria-label="Next question"
              aria-disabled={!hasAnswered}
            >
              Next <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Storage error toast */}
      {storageError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] max-w-sm w-full px-4">
          <div className="bg-red-600 text-white text-sm rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3">
            <span className="flex-1">{storageError}</span>
            <button onClick={clearStorageError} className="font-bold text-white/80 hover:text-white flex-shrink-0">✕</button>
          </div>
        </div>
      )}
    </div>
  );
};
