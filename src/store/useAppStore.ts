import { create } from 'zustand';
import type {
  Question, UserData, Session, SessionQuestion,
  QuestionProgress, AnswerKey, SessionMode, CDCLevel,
} from '../types';
import rawData from '../data/quiz-data.json';
import {
  normalizeQuizData,
  filterByLevel,
  defaultProgress,
  calcNextReview,
  buildSessionQuestion,
  shuffle,
} from '../utils/dataHelpers';
import {
  loadUserData, saveUserData, updateStreak,
  saveSession, loadSession, clearPersistedSession,
  saveCompletedSession, loadLastCompletedSession,
} from '../utils/storage';

const ALL_QUESTIONS = normalizeQuizData(rawData as never);

/** O(1) ID → Question lookup — exported so pages can avoid linear find() calls */
export const QUESTION_MAP = new Map<string, Question>(
  ALL_QUESTIONS.map(q => [q.id, q])
);

const _initialUserData         = loadUserData();
const _initialSession          = loadSession();
const _initialCompletedSession = loadLastCompletedSession();

// ─── Public API ────────────────────────────────────────────────────────────

interface AppState {
  questions:            Question[];
  userData:             UserData;
  session:              Session | null;
  /** The most recently completed session — survives browser refresh. */
  lastCompletedSession: Session | null;
  activeQuestions:      Question[];
  /** BUG FIX #8: User-visible storage error message (null = no error). */
  storageError:         string | null;
  clearStorageError:    () => void;

  updateQuestionProgress: (id: string, updates: Partial<QuestionProgress>) => void;
  answerQuestion:         (questionId: string, answer: AnswerKey) => boolean;
  toggleFavorite:         (id: string) => void;
  toggleFlag:             (id: string) => void;
  toggleReview:           (id: string) => void;
  resetQuestionProgress:  (id: string) => void;
  resetAllProgress:       (level?: CDCLevel) => void;
  updateSettings:         (settings: Partial<UserData['settings']>) => void;
  setTheme:               (theme: UserData['theme']) => void;
  setActiveLevel:         (level: CDCLevel | 'both') => void;
  setUserData:            (data: UserData) => void;

  startSession:          (mode: SessionMode, questionIds?: string[], preserveOrder?: boolean, originalChoiceOrders?: Map<string, AnswerKey[]>) => boolean;
  answerSessionQuestion: (answer: AnswerKey, timeSpentMs: number) => void;
  /**
   * Mark the current question as timed-out.
   * - Scorable questions: isCorrect=false, incorrectCount incremented, stats updated.
   * - Unscored questions: marked as seen (no scoring impact), stats streak updated.
   */
  timeoutSessionQuestion: () => void;
  goToSessionQuestion:   (index: number) => void;
  completeSession:       () => void;
  /**
   * Clears the session from in-memory state only.
   * - If the session was still in-progress, it remains in localStorage and can be resumed.
   * - If the session was already completed, localStorage was cleared by completeSession().
   */
  clearSession:          () => void;
  /** Clears the in-progress session from both memory AND localStorage. Cannot be undone. */
  abandonSession:        () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getProgress(ud: UserData, id: string): QuestionProgress {
  return ud.questions[id] ?? defaultProgress(id);
}

function persist(ud: UserData): UserData {
  try {
    saveUserData(ud);
  } catch {
    // BUG FIX #8: Surface storage failures to the UI instead of silently losing data
    _notifyStorageError('Failed to save progress. Your browser storage may be full.');
  }
  return ud;
}

// Lazy-bound reference — set after store creation
let _notifyStorageError: (msg: string) => void = () => {};

function computeActive(level: CDCLevel | 'both'): Question[] {
  return filterByLevel(ALL_QUESTIONS, level);
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>((set, get) => ({
  questions:            ALL_QUESTIONS,
  userData:             _initialUserData,
  session:              _initialSession,
  lastCompletedSession: _initialCompletedSession,
  activeQuestions:      computeActive(_initialUserData.activeLevel),
  storageError:         null,
  clearStorageError()   { set({ storageError: null }); },

  // ── Progress ──────────────────────────────────────────────────────────────

  updateQuestionProgress(id, updates) {
    set(state => ({
      userData: persist({
        ...state.userData,
        questions: {
          ...state.userData.questions,
          [id]: { ...getProgress(state.userData, id), ...updates },
        },
      }),
    }));
  },

  answerQuestion(questionId, answer) {
    const { userData } = get();
    const q = QUESTION_MAP.get(questionId);
    if (!q) return false;

    const progress        = getProgress(userData, questionId);
    const isCorrect       = q.correctAnswer === answer;
    const newCorrectCount = isCorrect ? progress.correctCount + 1 : progress.correctCount;
    const newWrongCount   = isCorrect ? progress.incorrectCount  : progress.incorrectCount + 1;
    const threshold       = userData.settings.masteryThreshold;
    const justMastered    = isCorrect && newCorrectCount >= threshold;

    const updated: QuestionProgress = {
      ...progress,
      lastAnswer:     answer,
      lastAnsweredAt: Date.now(),
      correctCount:   newCorrectCount,
      incorrectCount: newWrongCount,
      status: justMastered ? 'mastered' : isCorrect ? 'correct' : 'incorrect',
      masteredAt:
        justMastered && !progress.masteredAt ? Date.now()
        : !isCorrect && progress.status === 'mastered' ? null
        : progress.masteredAt,
      nextReviewAt: isCorrect
        ? calcNextReview(newCorrectCount)
        : Date.now() + 24 * 60 * 60 * 1000,
    };

    const statsUpdated = updateStreak({
      ...userData.stats,
      totalAttempts:  userData.stats.totalAttempts + 1,
      totalCorrect:   userData.stats.totalCorrect   + (isCorrect ? 1 : 0),
      totalIncorrect: userData.stats.totalIncorrect + (isCorrect ? 0 : 1),
    });

    set({
      userData: persist({
        ...userData,
        questions: { ...userData.questions, [questionId]: updated },
        stats:     statsUpdated,
      }),
    });
    return isCorrect;
  },

  toggleFavorite(id) {
    const p = getProgress(get().userData, id);
    get().updateQuestionProgress(id, { isFavorite: !p.isFavorite });
  },
  toggleFlag(id) {
    const p = getProgress(get().userData, id);
    get().updateQuestionProgress(id, { isFlagged: !p.isFlagged });
  },
  toggleReview(id) {
    const p = getProgress(get().userData, id);
    get().updateQuestionProgress(id, { isMarkedForReview: !p.isMarkedForReview });
  },
  resetQuestionProgress(id) { get().updateQuestionProgress(id, defaultProgress(id)); },

  resetAllProgress(level) {
    set(state => {
      let newQs = { ...state.userData.questions };
      if (level) {
        const ids = new Set(state.questions.filter(q => q.level === level).map(q => q.id));
        for (const id of ids) delete newQs[id];
      } else {
        newQs = {};
      }
      return {
        userData: persist({
          ...state.userData,
          questions: newQs,
          ...(!level ? {
            stats: {
              totalAttempts: 0, totalCorrect: 0, totalIncorrect: 0,
              studyStreakDays: 0, lastStudyDate: null, totalTimeMs: 0, sessionsCompleted: 0,
            },
          } : {}),
        }),
      };
    });
  },

  updateSettings(s) {
    set(state => ({
      userData: persist({ ...state.userData, settings: { ...state.userData.settings, ...s } }),
    }));
  },
  setTheme(theme) {
    set(state => ({ userData: persist({ ...state.userData, theme }) }));
  },
  setActiveLevel(level) {
    set(state => ({
      userData:        persist({ ...state.userData, activeLevel: level }),
      activeQuestions: computeActive(level),
    }));
  },
  setUserData(data) {
    set({ userData: persist(data), activeQuestions: computeActive(data.activeLevel) });
  },

  // ── Session ───────────────────────────────────────────────────────────────

  startSession(mode, questionIds, preserveOrder = false, originalChoiceOrders) {
    const { activeQuestions, userData } = get();
    const { settings, activeLevel } = userData;

    // 1. Build pool
    let pool: Question[];
    if (questionIds && questionIds.length > 0) {
      pool = questionIds
        .map(id => QUESTION_MAP.get(id))
        .filter((q): q is Question => q !== undefined);
    } else {
      pool = [...activeQuestions];
    }

    // 2. Mode-specific subset filtering
    //    BUG FIX #2/#3: When the caller provides explicit questionIds, they have
    //    already curated the set (e.g. ResultsPage passes exactly the wrong/timed-out
    //    IDs). Re-filtering would silently drop questions that don't match the
    //    mode's filter criteria (e.g. timed-out unscored questions whose status is
    //    'seen' not 'incorrect'). So we only apply mode filters when no explicit
    //    IDs were provided.
    const callerProvidedIds = !!(questionIds && questionIds.length > 0);
    if (!preserveOrder && !callerProvidedIds) {
      switch (mode) {
        case 'missed':
          pool = pool.filter(q => {
            const p = userData.questions[q.id];
            if (!p || p.status === 'unseen') return false;
            return (
              p.status === 'incorrect' ||
              (p.incorrectCount > 0 && p.incorrectCount >= p.correctCount && p.status !== 'mastered')
            );
          });
          break;
        case 'favorites':
          pool = pool.filter(q => userData.questions[q.id]?.isFavorite);
          break;
        case 'unseen':
          pool = pool.filter(q =>
            !userData.questions[q.id] || userData.questions[q.id].status === 'unseen'
          );
          break;
        case 'review':
          pool = pool.filter(q => userData.questions[q.id]?.isMarkedForReview);
          break;
      }
    }

    if (pool.length === 0) return false;

    // 3. Shuffle
    if (!preserveOrder && (settings.shuffleQuestions || mode === 'random')) {
      pool = shuffle(pool);
    }

    // 4. Apply session limit
    if (!preserveOrder && settings.sessionLimit !== null && settings.sessionLimit > 0) {
      pool = pool.slice(0, settings.sessionLimit);
    }

    // 5. Build SessionQuestion list
    //    BUG FIX #4: When preserveOrder is true AND originalChoiceOrders are
    //    provided, reuse the exact choice ordering from the previous attempt
    //    so "Retry Exact Set" is truly exact (same questions, same order,
    //    same answer arrangement).
    const CHOICE_KEYS: AnswerKey[] = ['a', 'b', 'c', 'd'];
    const sessionQuestions: SessionQuestion[] = pool.map(q => {
      const validKeys = CHOICE_KEYS.filter(k => q.choices[k] !== undefined);
      if (preserveOrder && originalChoiceOrders?.has(q.id)) {
        const origOrder = originalChoiceOrders.get(q.id)!;
        // Validate that all keys still exist (defensive)
        const stillValid = origOrder.filter(k => q.choices[k] !== undefined);
        if (stillValid.length === validKeys.length) {
          return buildSessionQuestion(q.id, stillValid, false);
        }
      }
      return buildSessionQuestion(q.id, validKeys, settings.shuffleAnswers);
    });

    // 6. Determine feedback visibility (mode-driven — not a raw user toggle)
    //    quiz  → never show feedback until results
    //    study → always show feedback immediately
    //    other → respect user's instantFeedback preference
    const showFeedback =
      mode === 'quiz'  ? false :
      mode === 'study' ? true  :
      settings.instantFeedback;

    const session: Session = {
      id:                  `session-${Date.now()}`,
      mode,
      level:               activeLevel,
      originalQuestionIds: pool.map(q => q.id),
      questions:           sessionQuestions,
      currentIndex:        0,
      startedAt:           Date.now(),
      completedAt:         null,
      showFeedback,
      timedMode:           settings.timedMode,
    };

    saveSession(session);
    set({ session });
    return true;
  },

  answerSessionQuestion(answer, timeSpentMs) {
    const { session } = get();
    if (!session) return;

    const sq = session.questions[session.currentIndex];
    if (!sq || sq.selectedAnswer !== null || sq.timedOut) return;

    const q = QUESTION_MAP.get(sq.questionId);
    if (!q) return;

    const isCorrect: boolean | null =
      q.correctAnswer === null ? null : q.correctAnswer === answer;

    set(state => {
      if (!state.session) return {};
      const updatedSqs = [...state.session.questions];
      updatedSqs[state.session.currentIndex] = {
        ...sq, selectedAnswer: answer, isCorrect, timeSpentMs,
      };
      const updated = { ...state.session, questions: updatedSqs };
      saveSession(updated);
      return { session: updated };
    });

    if (q.isScorableQuestion) {
      get().answerQuestion(sq.questionId, answer);
    } else {
      const p            = getProgress(get().userData, sq.questionId);
      const statsUpdated = updateStreak(get().userData.stats);
      set(state => ({
        userData: persist({
          ...state.userData,
          questions: {
            ...state.userData.questions,
            [sq.questionId]: {
              ...p,
              status:         p.status === 'unseen' ? 'seen' : p.status,
              lastAnsweredAt: Date.now(),
              lastAnswer:     answer,
            },
          },
          stats: statsUpdated,
        }),
      }));
    }
  },

  timeoutSessionQuestion() {
    const { session } = get();
    if (!session) return;

    const sq = session.questions[session.currentIndex];
    if (!sq || sq.selectedAnswer !== null || sq.timedOut) return;

    const q = QUESTION_MAP.get(sq.questionId);
    if (!q) return;

    // Mark the SessionQuestion as timed-out
    set(state => {
      if (!state.session) return {};
      const updatedSqs = [...state.session.questions];
      updatedSqs[state.session.currentIndex] = {
        ...sq,
        selectedAnswer: null,
        // Scorable timeouts are scored as incorrect; unscored remain null
        isCorrect:  q.isScorableQuestion ? false : null,
        timeSpentMs: state.userData.settings.timerSeconds * 1000,
        timedOut:    true,
      };
      const updated = { ...state.session, questions: updatedSqs };
      saveSession(updated);
      return { session: updated };
    });

    const ud = get().userData;
    const progress = getProgress(ud, sq.questionId);

    if (q.isScorableQuestion) {
      // Timeout on a scorable question = incorrect attempt
      const updated: QuestionProgress = {
        ...progress,
        lastAnsweredAt: Date.now(),
        incorrectCount: progress.incorrectCount + 1,
        status:         'incorrect',
        masteredAt:     progress.status === 'mastered' ? null : progress.masteredAt,
        nextReviewAt:   Date.now() + 24 * 60 * 60 * 1000,
      };
      const statsUpdated = updateStreak({
        ...ud.stats,
        totalAttempts:  ud.stats.totalAttempts + 1,
        totalIncorrect: ud.stats.totalIncorrect + 1,
      });
      set(state => ({
        userData: persist({
          ...state.userData,
          questions: { ...state.userData.questions, [sq.questionId]: updated },
          stats:     statsUpdated,
        }),
      }));
    } else {
      // Timeout on an unscored question: mark as seen (consistent with a normal answer),
      // update streak, but don't touch correctCount / incorrectCount.
      const statsUpdated = updateStreak(ud.stats);
      set(state => ({
        userData: persist({
          ...state.userData,
          questions: {
            ...state.userData.questions,
            [sq.questionId]: {
              ...progress,
              status:         progress.status === 'unseen' ? 'seen' : progress.status,
              lastAnsweredAt: Date.now(),
            },
          },
          stats: statsUpdated,
        }),
      }));
    }
  },

  goToSessionQuestion(index) {
    set(state => {
      if (!state.session) return {};
      const clamped = Math.max(0, Math.min(index, state.session.questions.length - 1));
      const updated = { ...state.session, currentIndex: clamped };
      saveSession(updated);
      return { session: updated };
    });
  },

  completeSession() {
    set(state => {
      if (!state.session || state.session.completedAt !== null) return {};

      const sessionTimeMs = state.session.questions.reduce(
        (sum, sq) => sum + (sq.timeSpentMs ?? 0), 0
      );
      const stats = {
        ...state.userData.stats,
        sessionsCompleted: state.userData.stats.sessionsCompleted + 1,
        totalTimeMs:       state.userData.stats.totalTimeMs + sessionTimeMs,
      };

      const completedSession: Session = { ...state.session, completedAt: Date.now() };

      // Persist the completed session so the results page survives a browser refresh.
      saveCompletedSession(completedSession);
      // Remove the in-progress copy from localStorage.
      saveSession(null);

      return {
        session:              completedSession,
        lastCompletedSession: completedSession,
        userData:             persist({ ...state.userData, stats }),
      };
    });
  },

  clearSession() {
    set({ session: null });
  },

  abandonSession() {
    clearPersistedSession();
    set({ session: null });
  },
}));

// Wire up the lazy storage-error notifier now that the store exists
_notifyStorageError = (msg: string) => {
  useAppStore.setState({ storageError: msg });
};

/**
 * Shared guard: returns true if it's safe to start a new session.
 * If there's an in-progress session, prompts the user for confirmation.
 * Call this before startSession() from any page.
 */
export function confirmSessionReplacement(): boolean {
  const { session } = useAppStore.getState();
  if (!session || session.completedAt !== null) return true;
  const answered = session.questions.filter(
    q => q.selectedAnswer !== null || q.timedOut
  ).length;
  return window.confirm(
    `You have a session in progress (${answered}/${session.questions.length} answered). ` +
    `Starting a new session will permanently discard it.\n\n` +
    `Per-question progress is already saved. Continue?`
  );
}
