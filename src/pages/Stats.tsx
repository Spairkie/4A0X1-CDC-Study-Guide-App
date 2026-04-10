import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Trophy, Target, Flame, TrendingUp, Clock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { calcGroupProgress, getGroupNumbers, pct, getMasteredQuestions } from '../utils/dataHelpers';
import { Card, StatCard, ProgressBar, Badge, LevelBadge } from '../components/ui';
import type { CDCLevel } from '../types';

function fmtTime(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export const Stats: React.FC = () => {
  const { questions, activeQuestions, userData } = useAppStore();
  const { activeLevel } = userData;

  const groupData = useMemo(() => {
    const levels: CDCLevel[] = activeLevel === 'both' ? ['5-level', '7-level'] : [activeLevel];
    const result: {
      name: string; level: CDCLevel; groupNumber: number;
      completion: number; mastery: number; missed: number; total: number;
    }[] = [];

    for (const lvl of levels) {
      for (const num of getGroupNumbers(questions, lvl)) {
        const mp     = calcGroupProgress(lvl, num, questions, userData);
        const prefix = lvl === '5-level' ? 'M' : 'L';
        result.push({
          name:        `${prefix}${num}`,
          level:       lvl,
          groupNumber: num,
          completion:  pct(mp.seenCount,    mp.totalQuestions),
          mastery:     pct(mp.masteredCount, mp.totalQuestions),
          missed:      mp.incorrectCount,
          total:       mp.totalQuestions,
        });
      }
    }
    return result;
  }, [questions, userData, activeLevel]);

  const mastered  = getMasteredQuestions(activeQuestions, userData);
  const totalSeen = activeQuestions.filter(q => {
    const p = userData.questions[q.id];
    return p && p.status !== 'unseen';
  }).length;

  const { stats } = userData;

  const scopedAttempts = activeQuestions.reduce((sum, q) => {
    const p = userData.questions[q.id];
    return p ? sum + p.correctCount + p.incorrectCount : sum;
  }, 0);
  const scopedCorrect = activeQuestions.reduce(
    (sum, q) => sum + (userData.questions[q.id]?.correctCount ?? 0), 0
  );
  const accuracy = pct(scopedCorrect, scopedAttempts);

  const globalLabel = activeLevel !== 'both' ? ' (all levels)' : '';

  const strongest = [...groupData].sort((a, b) => b.mastery - a.mastery)[0];
  const weakest   = [...groupData].filter(g => g.missed > 0).sort((a, b) => b.missed - a.missed)[0];

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-app">Progress</h1>
          <p className="text-muted text-sm mt-1">Your study stats across all modules</p>
        </div>
        <LevelBadge level={activeLevel} />
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard label="Accuracy"              value={`${accuracy}%`}            icon={<Target size={18} />} color="text-emerald-500" sub={`${scopedAttempts} attempts`} />
        <StatCard label={`Streak${globalLabel}`} value={`${stats.studyStreakDays}d`} icon={<Flame  size={18} />} color="text-amber-500"  sub={stats.lastStudyDate ?? 'Start today!'} />
        <StatCard label="Mastered"              value={mastered.length}            icon={<Trophy size={18} />} color="text-indigo-500" sub={`of ${activeQuestions.length} questions`} />
        <StatCard label={`Time${globalLabel}`}  value={fmtTime(stats.totalTimeMs)} icon={<Clock  size={18} />} color="text-sky-500"   sub={`${stats.sessionsCompleted} sessions`} />
      </div>

      {/* Overall coverage */}
      <Card className="mb-5">
        <div className="flex justify-between text-sm font-display font-semibold text-app mb-2">
          <span>Overall Coverage</span>
          <span className="text-muted">{totalSeen}/{activeQuestions.length}</span>
        </div>
        <ProgressBar value={pct(totalSeen, activeQuestions.length)} size="md" animated label="Overall coverage" />
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <div className="font-display font-bold text-base text-emerald-600 dark:text-emerald-400">{mastered.length}</div>
            <div className="text-muted">Mastered</div>
          </div>
          <div>
            <div className="font-display font-bold text-base text-indigo-500">{totalSeen - mastered.length}</div>
            <div className="text-muted">In Progress</div>
          </div>
          <div>
            <div className="font-display font-bold text-base text-muted">{activeQuestions.length - totalSeen}</div>
            <div className="text-muted">Unseen</div>
          </div>
        </div>
      </Card>

      {/* Highlights */}
      {(strongest || weakest) && (
        <div className="grid grid-cols-2 gap-3 mb-5">
          {strongest && (
            <Card>
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp size={14} className="text-emerald-500" />
                <span className="text-xs font-display font-semibold text-muted uppercase tracking-wide">Strongest</span>
              </div>
              <div className="font-display font-bold text-app">{strongest.name}</div>
              <LevelBadge level={strongest.level} className="mt-1" />
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">{strongest.mastery}% mastered</div>
            </Card>
          )}
          {weakest && (
            <Card>
              <div className="flex items-center gap-1.5 mb-1">
                <Target size={14} className="text-red-500" />
                <span className="text-xs font-display font-semibold text-muted uppercase tracking-wide">Needs Work</span>
              </div>
              <div className="font-display font-bold text-app">{weakest.name}</div>
              <LevelBadge level={weakest.level} className="mt-1" />
              <div className="text-xs text-red-500 mt-1">{weakest.missed} missed questions</div>
            </Card>
          )}
        </div>
      )}

      {/* Chart */}
      <Card className="mb-5">
        <h2 className="font-display font-semibold text-sm text-app mb-4">Completion by Group</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groupData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'currentColor' }} className="text-muted" />
              <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-muted" domain={[0, 100]} />
              <Tooltip
                formatter={(val: number) => [`${val}%`, '']}
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 12, color: '#f8fafc' }}
              />
              <Bar dataKey="completion" radius={[4, 4, 0, 0]}>
                {groupData.map(entry => (
                  <Cell
                    key={entry.name}
                    fill={
                      entry.completion >= 80 ? '#10b981' :
                      entry.completion >= 40 ? '#6366f1' : '#94a3b8'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Per-group table */}
      <Card padded={false}>
        <div className="px-4 pt-4 pb-1">
          <h2 className="font-display font-semibold text-sm text-app">Group Breakdown</h2>
        </div>
        <div className="divide-y divide-border">
          {groupData.map(g => (
            <div key={`${g.level}-${g.groupNumber}`} className="px-4 py-3 flex items-center gap-3">
              <div className="w-12 flex items-center gap-1 flex-shrink-0">
                <span className="font-display font-bold text-sm text-app">{g.name}</span>
              </div>
              <div className="flex-1 min-w-0">
                <ProgressBar value={g.completion} size="sm" label={`${g.name} completion`} />
              </div>
              <div className="flex items-center gap-2 text-xs flex-shrink-0">
                <span className="text-muted">{g.completion}%</span>
                {g.missed > 0 && <Badge variant="error">{g.missed}</Badge>}
                {activeLevel === 'both' && <LevelBadge level={g.level} />}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
