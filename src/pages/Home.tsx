import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, BookOpen, AlertCircle, Shuffle, ChevronRight,
  Flame, Target, TrendingUp, Award, Shield, ExternalLink, PlayCircle,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { calcGroupProgress, getMissedQuestions, getGroupNumbers, pct } from '../utils/dataHelpers';
import { Card, ProgressBar, StatCard, LevelBadge } from '../components/ui';
import type { CDCLevel } from '../types';

export const Home: React.FC = () => {
  const { questions, activeQuestions, userData, session, setActiveLevel } = useAppStore();
  const navigate = useNavigate();
  const { activeLevel } = userData;

  const stats = useMemo(() => {
    const levels: CDCLevel[] = activeLevel === 'both' ? ['5-level', '7-level'] : [activeLevel];
    let totalSeen = 0, totalMastered = 0, modulesCompleted = 0;

    for (const level of levels) {
      for (const g of getGroupNumbers(questions, level)) {
        const mp = calcGroupProgress(level, g, questions, userData);
        totalSeen     += mp.seenCount;
        totalMastered += mp.masteredCount;
        if (mp.seenCount === mp.totalQuestions && mp.totalQuestions > 0) modulesCompleted++;
      }
    }

    const missed = getMissedQuestions(activeQuestions, userData);
    const groupsTotal = levels.reduce(
      (sum, lvl) => sum + getGroupNumbers(questions, lvl).length, 0
    );

    const scopedAttempts = activeQuestions.reduce((sum, q) => {
      const p = userData.questions[q.id];
      return p ? sum + p.correctCount + p.incorrectCount : sum;
    }, 0);
    const scopedCorrect = activeQuestions.reduce(
      (sum, q) => sum + (userData.questions[q.id]?.correctCount ?? 0), 0
    );

    return {
      totalSeen, totalMastered,
      totalMissed:     missed.length,
      modulesCompleted, groupsTotal,
      total:    activeQuestions.length,
      accuracy: pct(scopedCorrect, scopedAttempts),
      attempts: scopedAttempts,
      streak:   userData.stats.studyStreakDays,
    };
  }, [questions, activeQuestions, userData, activeLevel]);

  const recommendation = useMemo(() => {
    const levels: CDCLevel[] = activeLevel === 'both' ? ['5-level', '7-level'] : [activeLevel];
    let worst: { level: CDCLevel; label: string; missed: number } | null = null;
    for (const level of levels) {
      for (const g of getGroupNumbers(questions, level)) {
        const mp = calcGroupProgress(level, g, questions, userData);
        if (mp.incorrectCount > 0 && (!worst || mp.incorrectCount > worst.missed)) {
          worst = { level, label: `${mp.groupLabel} ${g}`, missed: mp.incorrectCount };
        }
      }
    }
    return worst;
  }, [questions, userData, activeLevel]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }, []);

  const hasActiveSession = session !== null && session.completedAt === null;
  // BUG FIX: count timedOut questions as answered in the session progress banner
  const sessionProgress = hasActiveSession
    ? {
        answered: session.questions.filter(q => q.selectedAnswer !== null || q.timedOut).length,
        total:    session.questions.length,
      }
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-md flex-shrink-0">
          <Shield size={20} className="text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-app leading-tight">
            4A0X1 CDCs Study Guide
          </h1>
          <p className="text-muted text-sm mt-0.5">
            {greeting} — {activeQuestions.length} questions loaded
          </p>
        </div>
      </div>

      {/* Resume session banner */}
      {hasActiveSession && sessionProgress && (
        <button
          onClick={() => navigate('/session')}
          className="w-full mb-5 flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl px-4 py-3 hover:shadow-md transition-all text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
            <PlayCircle size={18} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-sm text-indigo-800 dark:text-indigo-300">
              Resume your session
            </div>
            <div className="text-indigo-600 dark:text-indigo-400 text-xs mt-0.5">
              {sessionProgress.answered}/{sessionProgress.total} answered ·{' '}
              {pct(sessionProgress.answered, sessionProgress.total)}% complete
            </div>
          </div>
          <ChevronRight size={16} className="text-indigo-400 flex-shrink-0" />
        </button>
      )}

      {/* Level selector */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(['both', '5-level', '7-level'] as const).map(lvl => (
          <button
            key={lvl}
            onClick={() => setActiveLevel(lvl)}
            className={`px-3 py-1.5 rounded-xl text-xs font-display font-semibold border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              activeLevel === lvl
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                : 'border-border bg-surface text-muted hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {lvl === 'both' ? 'All Levels' : lvl === '5-level' ? '5-Level (4A051)' : '7-Level (4A071)'}
          </button>
        ))}
      </div>

      {/* Streak banner */}
      {stats.streak > 0 && (
        <div className="mb-5 flex items-center gap-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 py-3">
          <Flame size={22} className="text-amber-500 flex-shrink-0" />
          <div>
            <span className="font-display font-bold text-amber-700 dark:text-amber-400">
              {stats.streak} day streak!
            </span>
            <span className="text-amber-600 dark:text-amber-500 text-sm"> Keep it going today.</span>
          </div>
        </div>
      )}

      {/* Smart recommendation */}
      {recommendation && (
        <button
          onClick={() => navigate('/missed')}
          className="w-full mb-5 flex items-center gap-3 bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-900/20 dark:to-violet-900/20 border border-indigo-200 dark:border-indigo-800 rounded-2xl px-4 py-3 hover:shadow-sm transition-all text-left"
          aria-label={`Review missed questions in ${recommendation.label}`}
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={16} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
              Review {recommendation.label} — {recommendation.missed} missed{' '}
              {recommendation.missed === 1 ? 'question' : 'questions'} waiting
            </p>
            <LevelBadge level={recommendation.level} className="mt-1" />
          </div>
          <ChevronRight size={16} className="text-indigo-400 flex-shrink-0" />
        </button>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Questions seen"
          value={`${stats.totalSeen} / ${stats.total}`}
          icon={<BookOpen size={18} />}
          color="text-indigo-500"
          sub={`${pct(stats.totalSeen, stats.total)}% coverage`}
        />
        <StatCard
          label="Mastered"
          value={stats.totalMastered}
          icon={<Award size={18} />}
          color="text-amber-500"
          sub={`${pct(stats.totalMastered, stats.total)}% of total`}
        />
        <StatCard
          label="Missed"
          value={stats.totalMissed}
          icon={<AlertCircle size={18} />}
          color="text-red-500"
          sub="Need more practice"
        />
        <StatCard
          label="Accuracy"
          value={`${stats.accuracy}%`}
          icon={<Target size={18} />}
          color="text-emerald-500"
          sub={`${stats.attempts} total attempts`}
        />
      </div>

      {/* Overall progress */}
      <Card className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-display font-semibold text-app">Overall Progress</span>
          <span className="text-xs text-muted">{pct(stats.totalSeen, stats.total)}%</span>
        </div>
        <ProgressBar value={pct(stats.totalSeen, stats.total)} size="md" animated label="Overall progress" />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-muted">
            {stats.modulesCompleted}/{stats.groupsTotal} groups completed
          </span>
          <span className="text-xs text-muted">{stats.total - stats.totalSeen} remaining</span>
        </div>
      </Card>

      {/* Quick actions */}
      <div className="mb-5">
        <h2 className="font-display font-bold text-base text-app mb-3">Quick Start</h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAction
            icon={<Zap size={20} className="text-indigo-500" />}
            title="Start Studying"
            sub="Pick a mode and begin"
            onClick={() => navigate('/quiz')}
            bg="bg-indigo-50 dark:bg-indigo-900/20"
          />
          <QuickAction
            icon={<AlertCircle size={20} className="text-red-500" />}
            title="Missed Questions"
            sub={`${stats.totalMissed} question${stats.totalMissed !== 1 ? 's' : ''} to revisit`}
            onClick={() => navigate('/missed')}
            bg="bg-red-50 dark:bg-red-900/20"
            badge={stats.totalMissed > 0 ? String(stats.totalMissed) : undefined}
          />
          <QuickAction
            icon={<BookOpen size={20} className="text-emerald-500" />}
            title="Browse Modules"
            sub={`${stats.groupsTotal} groups available`}
            onClick={() => navigate('/modules')}
            bg="bg-emerald-50 dark:bg-emerald-900/20"
          />
          <QuickAction
            icon={<Shuffle size={20} className="text-purple-500" />}
            title="Random Quiz"
            sub="Mix questions from all modules"
            onClick={() => navigate('/quiz?mode=random')}
            bg="bg-purple-50 dark:bg-purple-900/20"
          />
        </div>
      </div>

      {/* Official Modules link */}
      <a
        href="https://lms-jets.cce.af.mil/moodle/course/section.php?id=99658"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-surface border border-border rounded-2xl px-4 py-3 hover:shadow-sm transition-all group"
        aria-label="View official CDC modules on JET-S (opens in new tab)"
      >
        <div className="w-9 h-9 rounded-xl bg-raised flex items-center justify-center flex-shrink-0">
          <ExternalLink size={16} className="text-muted group-hover:text-indigo-500 transition-colors" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold text-sm text-app">View Official CDC Modules</div>
          <div className="text-muted text-xs mt-0.5">JET-S Learning Management System</div>
        </div>
        <ChevronRight size={16} className="text-muted flex-shrink-0" />
      </a>
    </div>
  );
};

const QuickAction: React.FC<{
  icon: React.ReactNode; title: string; sub: string;
  onClick: () => void; bg: string; badge?: string;
}> = ({ icon, title, sub, onClick, bg, badge }) => (
  <button
    onClick={onClick}
    className="relative text-left bg-surface border border-border rounded-2xl p-4 transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
  >
    <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
      {icon}
    </div>
    <div className="font-display font-semibold text-sm text-app leading-tight">{title}</div>
    <div className="text-muted text-xs mt-0.5">{sub}</div>
    {badge && (
      <span className="absolute top-3 right-3 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center leading-none">
        {badge}
      </span>
    )}
  </button>
);
