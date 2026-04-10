import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Zap, BookOpen, Shuffle, AlertCircle, Star, Eye,
  PlayCircle, Bookmark, Clock, Hash,
} from 'lucide-react';
import { useAppStore, confirmSessionReplacement } from '../store/useAppStore';
import {
  getMissedQuestions, getFavoriteQuestions,
  getUnseenQuestions, getReviewQuestions, getGroupNumbers,
} from '../utils/dataHelpers';
import { Button, Card, Toggle, LevelBadge } from '../components/ui';
import type { SessionMode, CDCLevel } from '../types';

interface GroupSelection { level: CDCLevel; groupNumber: number; }

const VALID_MODES = new Set<SessionMode>(['study', 'quiz', 'random', 'missed', 'favorites', 'unseen', 'review']);

function parseMode(raw: string | null): SessionMode {
  if (raw && VALID_MODES.has(raw as SessionMode)) return raw as SessionMode;
  return 'study';
}

// Modes that allow group filtering
const GROUP_MODES = new Set<SessionMode>(['study', 'quiz', 'random']);

// Timer presets in seconds
const TIMER_PRESETS = [15, 30, 60] as const;

// Session length presets (null = all)
const SESSION_LIMITS = [
  { label: '10',  value: 10 },
  { label: '20',  value: 20 },
  { label: '50',  value: 50 },
  { label: 'All', value: null },
] as const;

export const QuizLauncher: React.FC = () => {
  const {
    questions, activeQuestions, userData, session,
    startSession, updateSettings, setActiveLevel,
  } = useAppStore();
  const navigate = useNavigate();
  const [params]  = useSearchParams();

  const [selectedMode, setSelectedMode] = useState<SessionMode>(
    parseMode(params.get('mode'))
  );
  const [selectedGroups, setSelectedGroups] = useState<GroupSelection[]>([]);
  const [startError, setStartError]         = useState<string | null>(null);

  const { settings, activeLevel } = userData;

  const missed    = getMissedQuestions(activeQuestions, userData);
  const favorites = getFavoriteQuestions(activeQuestions, userData);
  const unseen    = getUnseenQuestions(activeQuestions, userData);
  const review    = getReviewQuestions(activeQuestions, userData);

  const groupNumbers = useMemo(() => {
    if (activeLevel === 'both') {
      return {
        '5-level': getGroupNumbers(questions, '5-level'),
        '7-level': getGroupNumbers(questions, '7-level'),
      };
    }
    return { [activeLevel]: getGroupNumbers(questions, activeLevel as CDCLevel) };
  }, [questions, activeLevel]);

  const MODES: {
    mode: SessionMode; icon: React.ReactNode; title: string;
    desc: string; color: string; count?: number;
  }[] = [
    { mode: 'study',     icon: <BookOpen    size={20}/>, title: 'Study Mode',    desc: 'Instant feedback after each answer',  color: 'text-indigo-500' },
    { mode: 'quiz',      icon: <Zap         size={20}/>, title: 'Test Mode',     desc: 'Results revealed only at the end',    color: 'text-amber-500' },
    { mode: 'random',    icon: <Shuffle     size={20}/>, title: 'Random Mix',    desc: 'Shuffled from all or selected groups', color: 'text-purple-500' },
    { mode: 'missed',    icon: <AlertCircle size={20}/>, title: 'Missed Only',   desc: `${missed.length} to revisit`,         color: 'text-red-500',     count: missed.length },
    { mode: 'favorites', icon: <Star        size={20}/>, title: 'Favorites',     desc: `${favorites.length} starred`,         color: 'text-amber-500',   count: favorites.length },
    { mode: 'unseen',    icon: <Eye         size={20}/>, title: 'New Questions', desc: `${unseen.length} not yet seen`,       color: 'text-emerald-500', count: unseen.length },
    { mode: 'review',    icon: <Bookmark    size={20}/>, title: 'Bookmarked',    desc: `${review.length} marked for review`,  color: 'text-indigo-500',  count: review.length },
  ];

  const isGroupSelected = (level: CDCLevel, num: number) =>
    selectedGroups.some(g => g.level === level && g.groupNumber === num);

  const toggleGroup = (level: CDCLevel, num: number) => {
    setStartError(null);
    setSelectedGroups(prev =>
      isGroupSelected(level, num)
        ? prev.filter(g => !(g.level === level && g.groupNumber === num))
        : [...prev, { level, groupNumber: num }]
    );
  };

  const showGroupSelect = GROUP_MODES.has(selectedMode);

  const handleModeChange = (mode: SessionMode) => {
    setSelectedMode(mode);
    setStartError(null);
    if (!GROUP_MODES.has(mode)) setSelectedGroups([]);
  };

  const modeCount: number | undefined =
    selectedMode === 'missed'    ? missed.length    :
    selectedMode === 'favorites' ? favorites.length :
    selectedMode === 'unseen'    ? unseen.length    :
    selectedMode === 'review'    ? review.length    :
    undefined;
  const canStart = modeCount === undefined || modeCount > 0;

  const hasActiveSession = session !== null && session.completedAt === null;

  const handleStart = () => {
    setStartError(null);

    if (hasActiveSession) {
      if (!confirmSessionReplacement()) return;
    }

    let questionIds: string[] | undefined;
    if (showGroupSelect && selectedGroups.length > 0) {
      questionIds = selectedGroups.flatMap(({ level, groupNumber }) =>
        questions
          .filter(q => q.level === level && q.groupNumber === groupNumber)
          .map(q => q.id)
      );
    }

    const ok = startSession(selectedMode, questionIds);
    if (!ok) {
      setStartError('No questions available for the current combination. Try different settings.');
      return;
    }
    navigate('/session');
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-4">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-app">Start a Session</h1>
        <p className="text-muted text-sm mt-1">Choose mode, dataset, and settings</p>
      </div>

      {/* Resume banner */}
      {hasActiveSession && (
        <button
          onClick={() => navigate('/session')}
          className="w-full mb-6 flex items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl px-4 py-3 hover:shadow-md transition-all text-left"
        >
          <PlayCircle size={20} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-display font-semibold text-sm text-indigo-800 dark:text-indigo-300">
              Resume in-progress session
            </div>
            <div className="text-indigo-600 dark:text-indigo-400 text-xs mt-0.5">
              {session!.questions.filter(q => q.selectedAnswer !== null || q.timedOut).length}/
              {session!.questions.length} answered — tap to continue
            </div>
          </div>
        </button>
      )}

      {/* Level filter */}
      <div className="mb-6">
        <h2 className="font-display font-semibold text-sm text-muted uppercase tracking-wide mb-3">Dataset</h2>
        <div className="flex gap-2 flex-wrap">
          {(['both', '5-level', '7-level'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => { setActiveLevel(lvl); setSelectedGroups([]); setStartError(null); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-display font-semibold border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                activeLevel === lvl
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                  : 'border-border bg-surface text-muted hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <LevelBadge level={lvl} />
              {lvl === 'both' ? 'All Levels' : lvl === '5-level' ? '4A051 Journeyman' : '4A071 Craftsman'}
            </button>
          ))}
        </div>
      </div>

      {/* Mode selection */}
      <div className="mb-6">
        <h2 className="font-display font-semibold text-sm text-muted uppercase tracking-wide mb-3">Mode</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {MODES.map(({ mode, icon, title, desc, color, count }) => {
            const isEmpty = count !== undefined && count === 0;
            return (
              <button
                key={mode}
                onClick={() => !isEmpty && handleModeChange(mode)}
                disabled={isEmpty}
                aria-pressed={selectedMode === mode}
                className={`text-left p-3.5 rounded-2xl border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed ${
                  selectedMode === mode
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                    : 'border-border bg-surface hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className={`mb-2 ${color}`}>{icon}</div>
                <div className="font-display font-semibold text-sm text-app leading-tight">{title}</div>
                <div className="text-muted text-xs mt-0.5">{desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Group selection — shown for study, quiz, and random modes */}
      {showGroupSelect && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-sm text-muted uppercase tracking-wide">Groups</h2>
            <button
              onClick={() => setSelectedGroups([])}
              className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              All groups
            </button>
          </div>
          {Object.entries(groupNumbers).map(([lvl, nums]) => (
            <div key={lvl} className="mb-3">
              {activeLevel === 'both' && (
                <div className="mb-2"><LevelBadge level={lvl as CDCLevel} /></div>
              )}
              <div className="flex flex-wrap gap-2">
                {(nums as number[]).map(num => {
                  const selected = isGroupSelected(lvl as CDCLevel, num);
                  return (
                    <button
                      key={`${lvl}-${num}`}
                      onClick={() => toggleGroup(lvl as CDCLevel, num)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-display font-semibold border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                        selected
                          ? 'border-indigo-500 bg-indigo-500 text-white'
                          : 'border-border bg-surface text-app hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      {lvl === '5-level' ? `M${num}` : `L${String(num).padStart(3, '0')}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {selectedGroups.length === 0 && (
            <p className="text-muted text-xs mt-1">No selection = all groups included</p>
          )}
        </div>
      )}

      {/* Settings */}
      <Card className="mb-6 divide-y divide-border">
        {/* Instant feedback — only shown for non-forced modes */}
        {selectedMode !== 'study' && selectedMode !== 'quiz' && (
          <Toggle
            label="Instant Feedback"
            description="Show correct/incorrect after each answer"
            checked={settings.instantFeedback}
            onChange={v => updateSettings({ instantFeedback: v })}
          />
        )}
        {selectedMode === 'study' && (
          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-app text-sm font-medium">Instant Feedback</div>
              <div className="text-muted text-xs mt-0.5">Always on in Study Mode</div>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">Always On</span>
          </div>
        )}
        {selectedMode === 'quiz' && (
          <div className="py-3 flex items-center justify-between gap-4">
            <div>
              <div className="text-app text-sm font-medium">Instant Feedback</div>
              <div className="text-muted text-xs mt-0.5">Disabled in Test Mode</div>
            </div>
            <span className="text-xs text-red-500 font-semibold">Disabled</span>
          </div>
        )}

        <Toggle
          label="Shuffle Questions"
          checked={settings.shuffleQuestions}
          onChange={v => updateSettings({ shuffleQuestions: v })}
        />
        <Toggle
          label="Shuffle Answer Choices"
          checked={settings.shuffleAnswers}
          onChange={v => updateSettings({ shuffleAnswers: v })}
        />

        {/* Timed Mode with presets */}
        <div className="py-3">
          <Toggle
            label="Timed Mode"
            description={`${settings.timerSeconds}s per question`}
            checked={settings.timedMode}
            onChange={v => updateSettings({ timedMode: v })}
          />
          {settings.timedMode && (
            <div className="mt-2 flex items-center gap-2">
              <Clock size={13} className="text-muted flex-shrink-0" />
              <span className="text-xs text-muted mr-1">Presets:</span>
              {TIMER_PRESETS.map(sec => (
                <button
                  key={sec}
                  onClick={() => updateSettings({ timerSeconds: sec })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-display font-semibold border transition-colors ${
                    settings.timerSeconds === sec
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-border text-muted hover:border-indigo-300'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Session length */}
        <div className="py-3">
          <div className="flex items-center gap-2 mb-2">
            <Hash size={13} className="text-muted" />
            <span className="text-app text-sm font-medium">Questions per Session</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {SESSION_LIMITS.map(({ label, value }) => (
              <button
                key={label}
                onClick={() => updateSettings({ sessionLimit: value })}
                className={`px-3 py-1.5 rounded-xl text-xs font-display font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  settings.sessionLimit === value
                    ? 'border-indigo-500 bg-indigo-500 text-white'
                    : 'border-border text-muted hover:border-indigo-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {settings.sessionLimit !== null && (
            <p className="text-muted text-xs mt-1.5">
              Session capped at {settings.sessionLimit} questions (from the filtered pool)
            </p>
          )}
        </div>
      </Card>

      {/* Start error message */}
      {startError && (
        <div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          {startError}
        </div>
      )}

      <Button size="lg" fullWidth onClick={handleStart} disabled={!canStart}>
        <Zap size={18} /> Start Session
      </Button>

      {!canStart && (
        <p className="text-muted text-xs text-center mt-3">
          No questions available for this mode.
          {selectedMode === 'missed'    && ' Answer some questions incorrectly first.'}
          {selectedMode === 'favorites' && ' Star some questions to build a favorites list.'}
          {selectedMode === 'unseen'    && ' All questions have been seen!'}
          {selectedMode === 'review'    && ' Bookmark questions during a session to add them here.'}
        </p>
      )}
    </div>
  );
};
