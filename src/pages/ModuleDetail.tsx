import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Zap, BookOpen, AlertCircle, Award } from 'lucide-react';
import { useAppStore, confirmSessionReplacement } from '../store/useAppStore';
import { calcGroupProgress, getMissedQuestions, pct } from '../utils/dataHelpers';
import { Button, Card, ProgressBar, StatCard, LevelBadge } from '../components/ui';
import type { CDCLevel } from '../types';

// routeId format: "5-{groupNumber}" or "7-{groupNumber}"
// e.g. "5-3" = 5-level Module 3, "7-10" = 7-level Lesson 10
export const ModuleDetail: React.FC = () => {
  const { routeId } = useParams<{ routeId: string }>();
  const { questions, userData, startSession } = useAppStore();
  const navigate = useNavigate();

  const parsed = useMemo((): { level: CDCLevel; groupNumber: number } | null => {
    if (!routeId) return null;
    const dashIdx     = routeId.indexOf('-');
    if (dashIdx === -1) return null;
    const levelPrefix = routeId.slice(0, dashIdx);
    const numStr      = routeId.slice(dashIdx + 1);
    const groupNumber = parseInt(numStr, 10);
    if (isNaN(groupNumber) || groupNumber <= 0) return null;
    // Only '5' and '7' are valid level prefixes — anything else is a bad URL
    if (levelPrefix !== '5' && levelPrefix !== '7') return null;
    const level: CDCLevel = levelPrefix === '7' ? '7-level' : '5-level';
    return { level, groupNumber };
  }, [routeId]);

  // All questions in this exact group (level + number)
  const groupQuestions = useMemo(() =>
    parsed
      ? questions.filter(q => q.level === parsed.level && q.groupNumber === parsed.groupNumber)
      : [],
  [questions, parsed]);

  const progress = useMemo(() =>
    parsed ? calcGroupProgress(parsed.level, parsed.groupNumber, questions, userData) : null,
  [parsed, questions, userData]);

  // Fix: always pass exact question IDs to avoid cross-level group number collision
  // (e.g. Module 3 and Lesson 3 both have groupNumber=3 — passing IDs prevents mixing)
  const startQuiz = (mode: 'quiz' | 'study' | 'missed') => {
    if (!parsed || groupQuestions.length === 0) return;
    if (!confirmSessionReplacement()) return;
    let ok: boolean;
    if (mode === 'missed') {
      const missedIds = getMissedQuestions(groupQuestions, userData).map(q => q.id);
      if (missedIds.length === 0) return;
      ok = startSession('missed', missedIds);
    } else {
      ok = startSession(mode, groupQuestions.map(q => q.id));
    }
    if (ok) navigate('/session');
  };

  if (!parsed || !progress || groupQuestions.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-8">
        <button
          onClick={() => navigate('/modules')}
          className="flex items-center gap-2 text-muted mb-4 hover:text-app transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <p className="text-muted">Group not found.</p>
      </div>
    );
  }

  const sample       = groupQuestions[0];
  const missedCount  = getMissedQuestions(groupQuestions, userData).length;
  const accuracyPct  = pct(progress.correctCount, progress.seenCount);
  const completionPct = pct(progress.seenCount, progress.totalQuestions);
  const masteryPct   = pct(progress.masteredCount, progress.totalQuestions);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
      <button
        onClick={() => navigate('/modules')}
        className="flex items-center gap-1.5 text-muted text-sm mb-5 hover:text-app transition-colors"
      >
        <ArrowLeft size={15} /> Back to Modules
      </button>

      <div className="mb-6">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <h1 className="font-display font-bold text-2xl text-app">
            {sample.groupLabel} {parsed.groupNumber}
          </h1>
          <LevelBadge level={parsed.level} />
        </div>
        <p className="text-muted text-sm">{progress.totalQuestions} questions</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <StatCard
          label="Seen"
          value={`${progress.seenCount}/${progress.totalQuestions}`}
          icon={<BookOpen size={16} />}
          color="text-indigo-500"
        />
        <StatCard
          label="Mastered"
          value={progress.masteredCount}
          icon={<Award size={16} />}
          color="text-amber-500"
        />
        <StatCard
          label="Missed"
          value={missedCount}
          icon={<AlertCircle size={16} />}
          color="text-red-500"
        />
        <StatCard
          label="Accuracy"
          value={`${accuracyPct}%`}
          icon={<Zap size={16} />}
          color="text-emerald-500"
          sub={progress.seenCount === 0 ? 'No attempts yet' : undefined}
        />
      </div>

      <Card className="mb-5">
        <div className="flex justify-between text-xs text-muted mb-1.5">
          <span>Completion</span>
          <span>{completionPct}%</span>
        </div>
        <ProgressBar value={completionPct} size="md" />
        <div className="flex justify-between text-xs text-muted mb-1.5 mt-3">
          <span>Mastery</span>
          <span>{masteryPct}%</span>
        </div>
        <ProgressBar value={masteryPct} variant="success" size="md" />
      </Card>

      <div className="flex flex-col gap-3">
        <Button size="lg" fullWidth onClick={() => startQuiz('study')} className="gap-2.5">
          <BookOpen size={18} /> Study Mode
        </Button>
        <Button size="lg" fullWidth variant="secondary" onClick={() => startQuiz('quiz')} className="gap-2.5">
          <Zap size={18} /> Test Mode
        </Button>
        {missedCount > 0 && (
          <Button
            size="lg"
            fullWidth
            variant="secondary"
            onClick={() => startQuiz('missed')}
            className="gap-2.5"
          >
            <AlertCircle size={18} /> Review Missed ({missedCount})
          </Button>
        )}
      </div>
    </div>
  );
};
