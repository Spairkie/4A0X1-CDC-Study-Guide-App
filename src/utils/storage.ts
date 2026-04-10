import type { UserData, UserSettings, CDCLevel, Session, QuestionProgress } from '../types';

const STORAGE_KEY              = 'cdc-quiz-userdata';
const SESSION_KEY              = 'cdc-quiz-session';
const COMPLETED_SESSION_KEY    = 'cdc-quiz-last-completed';
const SCHEMA_VERSION           = 2;
// In-progress sessions older than 24 h are discarded on restore
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
// Completed sessions older than 7 days are stale and should not resurface
const COMPLETED_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Defaults ─────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: UserSettings = {
  instantFeedback:   true,
  shuffleQuestions:  false,
  shuffleAnswers:    false,
  timedMode:         false,
  timerSeconds:      30,
  sessionLimit:      null,
  soundEnabled:      false,
  animationsEnabled: true,
  hapticsEnabled:    true,
  masteryThreshold:  3,
};

export const DEFAULT_STATS: UserData['stats'] = {
  totalAttempts:     0,
  totalCorrect:      0,
  totalIncorrect:    0,
  studyStreakDays:   0,
  lastStudyDate:     null,
  totalTimeMs:       0,
  sessionsCompleted: 0,
};

export const DEFAULT_USER_DATA: UserData = {
  schemaVersion: SCHEMA_VERSION,
  questions:     {},
  stats:         { ...DEFAULT_STATS },
  activeLevel:   'both',
  theme:         'system',
  settings:      { ...DEFAULT_SETTINGS },
};

// ─── Validation helpers ────────────────────────────────────────────────────

const VALID_STATUSES = new Set(['unseen','seen','correct','incorrect','mastered']);
const VALID_ANSWERS  = new Set(['a','b','c','d']);
const VALID_THEMES   = new Set(['light','dark','system']);
const VALID_LEVELS   = new Set(['5-level','7-level','both']);

/** Returns a fully-sanitized QuestionProgress, or null if the entry is unusable. */
function sanitizeQuestionProgress(raw: unknown): QuestionProgress | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.id !== 'string' || !p.id) return null;
  return {
    id:            p.id,
    status:        VALID_STATUSES.has(p.status as string)
                     ? (p.status as QuestionProgress['status']) : 'unseen',
    correctCount:  typeof p.correctCount  === 'number' && p.correctCount  >= 0
                     ? Math.floor(p.correctCount)  : 0,
    incorrectCount: typeof p.incorrectCount === 'number' && p.incorrectCount >= 0
                     ? Math.floor(p.incorrectCount) : 0,
    isFlagged:     typeof p.isFlagged  === 'boolean' ? p.isFlagged  : false,
    isFavorite:    typeof p.isFavorite === 'boolean' ? p.isFavorite : false,
    isMarkedForReview: typeof p.isMarkedForReview === 'boolean' ? p.isMarkedForReview : false,
    lastAnsweredAt: typeof p.lastAnsweredAt === 'number' && p.lastAnsweredAt > 0
                      ? p.lastAnsweredAt : null,
    lastAnswer:    VALID_ANSWERS.has(p.lastAnswer as string)
                     ? (p.lastAnswer as QuestionProgress['lastAnswer']) : null,
    nextReviewAt:  typeof p.nextReviewAt === 'number' && p.nextReviewAt > 0
                     ? p.nextReviewAt : null,
    masteredAt:    typeof p.masteredAt  === 'number' && p.masteredAt  > 0
                     ? p.masteredAt  : null,
  };
}

function sanitizeStats(raw: unknown): UserData['stats'] {
  const base = { ...DEFAULT_STATS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const s = raw as Record<string, unknown>;
  const safeNum = (v: unknown, fallback = 0) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
  return {
    totalAttempts:    safeNum(s.totalAttempts),
    totalCorrect:     safeNum(s.totalCorrect),
    totalIncorrect:   safeNum(s.totalIncorrect),
    studyStreakDays:  safeNum(s.studyStreakDays),
    lastStudyDate:    typeof s.lastStudyDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.lastStudyDate)
                        ? s.lastStudyDate : null,
    totalTimeMs:      safeNum(s.totalTimeMs),
    sessionsCompleted: safeNum(s.sessionsCompleted),
  };
}

function sanitizeSettings(raw: unknown): UserSettings {
  const base = { ...DEFAULT_SETTINGS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const s = raw as Record<string, unknown>;

  const safeBool = (v: unknown, fallback: boolean): boolean =>
    typeof v === 'boolean' ? v : fallback;

  const safeInt = (v: unknown, fallback: number, min: number, max: number): number => {
    if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(v)));
  };

  const sessionLimit =
    s.sessionLimit === null ? null :
    typeof s.sessionLimit === 'number' && s.sessionLimit > 0
      ? Math.floor(s.sessionLimit) : null;

  return {
    instantFeedback:   safeBool(s.instantFeedback,   base.instantFeedback),
    shuffleQuestions:  safeBool(s.shuffleQuestions,  base.shuffleQuestions),
    shuffleAnswers:    safeBool(s.shuffleAnswers,     base.shuffleAnswers),
    timedMode:         safeBool(s.timedMode,          base.timedMode),
    soundEnabled:      safeBool(s.soundEnabled,       base.soundEnabled),
    animationsEnabled: safeBool(s.animationsEnabled,  base.animationsEnabled),
    hapticsEnabled:    safeBool(s.hapticsEnabled,     base.hapticsEnabled),
    timerSeconds:      safeInt(s.timerSeconds,     base.timerSeconds,     5, 300),
    masteryThreshold:  safeInt(s.masteryThreshold, base.masteryThreshold, 1, 10),
    sessionLimit,
  };
}

function sanitizeQuestions(raw: unknown): Record<string, QuestionProgress> {
  const result: Record<string, QuestionProgress> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const clean = sanitizeQuestionProgress(val);
    if (clean) result[key] = clean;
  }
  return result;
}

// ─── User data ─────────────────────────────────────────────────────────────

export function loadUserData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_USER_DATA);

    const parsed = JSON.parse(raw) as Partial<UserData>;

    return {
      schemaVersion: SCHEMA_VERSION,
      theme: VALID_THEMES.has(parsed.theme as string)
        ? (parsed.theme as UserData['theme']) : 'system',
      activeLevel: VALID_LEVELS.has(parsed.activeLevel as string)
        ? (parsed.activeLevel as CDCLevel | 'both') : 'both',
      settings:  sanitizeSettings(parsed.settings),
      stats:     sanitizeStats(parsed.stats),
      questions: sanitizeQuestions(parsed.questions),
    };
  } catch {
    return structuredClone(DEFAULT_USER_DATA);
  }
}

export function saveUserData(data: UserData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('[storage] Failed to persist user data:', e);
    throw e; // BUG FIX #8: Re-throw so callers can surface the error to the UI
  }
}

// ─── Active (in-progress) session ─────────────────────────────────────────

export function saveSession(session: Session | null): void {
  try {
    if (session === null) {
      localStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    }
  } catch (e) {
    console.error('[storage] Failed to persist session:', e);
  }
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;

    // Never restore a completed session as an active session
    if (session.completedAt !== null) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    // Discard stale sessions older than 24 h
    if (!session.startedAt || Date.now() - session.startedAt > SESSION_MAX_AGE_MS) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    if (!Array.isArray(session.questions) || session.questions.length === 0) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    // Ensure each question has the timedOut field (backwards compat with older saved sessions)
    session.questions = session.questions.map(sq => ({ ...sq, timedOut: sq.timedOut ?? false }));

    // Clamp currentIndex into valid range
    const maxIndex = session.questions.length - 1;
    if (
      typeof session.currentIndex !== 'number' ||
      session.currentIndex < 0 ||
      session.currentIndex > maxIndex
    ) {
      session.currentIndex = Math.min(Math.max(0, session.currentIndex ?? 0), maxIndex);
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearPersistedSession(): void {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

// ─── Completed session (persists across refresh for results page) ──────────

/**
 * Save the last completed session so the results page survives a browser
 * refresh.  We only keep the most recent completed session.
 */
export function saveCompletedSession(session: Session): void {
  try {
    localStorage.setItem(COMPLETED_SESSION_KEY, JSON.stringify(session));
  } catch (e) {
    console.error('[storage] Failed to persist completed session:', e);
  }
}

export function loadLastCompletedSession(): Session | null {
  try {
    const raw = localStorage.getItem(COMPLETED_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session.completedAt) return null;
    // BUG FIX #7: Discard stale completed sessions so old results don't
    // resurface and appear current after a long absence.
    if (Date.now() - session.completedAt > COMPLETED_SESSION_MAX_AGE_MS) {
      localStorage.removeItem(COMPLETED_SESSION_KEY);
      return null;
    }
    // Ensure backwards compat for timedOut field
    session.questions = session.questions.map(sq => ({ ...sq, timedOut: sq.timedOut ?? false }));
    return session;
  } catch {
    return null;
  }
}

// ─── Export / Import ───────────────────────────────────────────────────────

export function exportUserData(data: UserData): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `cdc-quiz-progress-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importUserData(file: File): Promise<UserData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target?.result as string) as Record<string, unknown>;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new Error('Invalid progress file — expected a JSON object'));
          return;
        }
        const merged: UserData = {
          schemaVersion: SCHEMA_VERSION,
          theme: VALID_THEMES.has(parsed.theme as string)
            ? (parsed.theme as UserData['theme']) : 'system',
          activeLevel: VALID_LEVELS.has(parsed.activeLevel as string)
            ? (parsed.activeLevel as CDCLevel | 'both') : 'both',
          settings:  sanitizeSettings(parsed.settings),
          stats:     sanitizeStats(parsed.stats),
          questions: sanitizeQuestions(parsed.questions),
        };
        resolve(merged);
      } catch {
        reject(new Error('Invalid progress file — could not parse JSON'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ─── Study streak ──────────────────────────────────────────────────────────

function localDateString(): string {
  const d   = new Date();
  const y   = d.getFullYear();
  const m   = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function updateStreak(stats: UserData['stats']): UserData['stats'] {
  const today = localDateString();
  if (stats.lastStudyDate === today) return stats;

  const d2    = new Date();
  d2.setDate(d2.getDate() - 1);
  const y2    = d2.getFullYear();
  const m2    = String(d2.getMonth() + 1).padStart(2, '0');
  const day2  = String(d2.getDate()).padStart(2, '0');
  const yesterday = `${y2}-${m2}-${day2}`;

  const newStreak = stats.lastStudyDate === yesterday
    ? stats.studyStreakDays + 1
    : 1;

  return { ...stats, lastStudyDate: today, studyStreakDays: newStreak };
}
