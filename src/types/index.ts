// ─── CDC Level ─────────────────────────────────────────────────────────────

export type CDCLevel = '5-level' | '7-level';

// ─── Merged pre-normalized JSON types (quiz-data.json v2) ──────────────────

export interface MergedQuestion {
  id:               string;
  level:            CDCLevel;
  groupNumber:      number;
  groupLabel:       'Module' | 'Lesson';
  questionNumber:   number;
  question:         string;
  choices:          Partial<Record<AnswerKey, string>>;
  correctAnswer:    AnswerKey | null;
  correctText:      string | null;
  isScorableQuestion: boolean;
  verified:         boolean;
  lesson:           string | null;
  sourcePageRange:  string | null;
}

export interface MergedDataset {
  course:         string;
  source:         string;
  totalQuestions: number;
  groupCount:     number;
  groupLabel:     'Module' | 'Lesson';
}

export interface MergedQuizData {
  schemaVersion:  number;
  app:            string;
  totalQuestions: number;
  datasets:       Record<CDCLevel, MergedDataset>;
  questions:      MergedQuestion[];
}

// ─── Normalized app Question (internal) ────────────────────────────────────

export type AnswerKey = 'a' | 'b' | 'c' | 'd';

export interface Question {
  id:               string;
  level:            CDCLevel;
  groupNumber:      number;
  groupLabel:       'Module' | 'Lesson';
  questionNumber:   number;
  text:             string;
  choices:          Partial<Record<AnswerKey, string>>;
  correctAnswer:    AnswerKey | null;
  correctText:      string | null;
  isScorableQuestion: boolean;
  verified:         boolean;
  lesson:           string | null;
  sourcePageRange:  string | null;
}

// ─── User Progress ─────────────────────────────────────────────────────────

export type QuestionStatus = 'unseen' | 'seen' | 'correct' | 'incorrect' | 'mastered';

export interface QuestionProgress {
  id:                string;
  status:            QuestionStatus;
  correctCount:      number;
  incorrectCount:    number;
  isFlagged:         boolean;
  isFavorite:        boolean;
  isMarkedForReview: boolean;
  lastAnsweredAt:    number | null;
  lastAnswer:        AnswerKey | null;
  nextReviewAt:      number | null;
  masteredAt:        number | null;
}

export interface GroupProgress {
  level:          CDCLevel;
  groupNumber:    number;
  groupLabel:     'Module' | 'Lesson';
  totalQuestions: number;
  seenCount:      number;
  correctCount:   number;
  incorrectCount: number;
  masteredCount:  number;
  lastStudiedAt:  number | null;
}

export interface AppStats {
  totalAttempts:    number;
  totalCorrect:     number;
  totalIncorrect:   number;
  studyStreakDays:  number;
  lastStudyDate:    string | null;
  totalTimeMs:      number;
  sessionsCompleted: number;
}

export interface UserData {
  schemaVersion: number;
  questions:     Record<string, QuestionProgress>;
  stats:         AppStats;
  activeLevel:   CDCLevel | 'both';
  theme:         'light' | 'dark' | 'system';
  settings:      UserSettings;
}

export interface UserSettings {
  instantFeedback:    boolean;
  shuffleQuestions:   boolean;
  shuffleAnswers:     boolean;
  timedMode:          boolean;
  timerSeconds:       number;
  /** Maximum questions per session. null means use all available. */
  sessionLimit:       number | null;
  soundEnabled:       boolean;
  animationsEnabled:  boolean;
  hapticsEnabled:     boolean;
  masteryThreshold:   number;
}

// ─── Session ────────────────────────────────────────────────────────────────

export type SessionMode =
  | 'quiz'
  | 'study'
  | 'missed'
  | 'favorites'
  | 'unseen'
  | 'random'
  | 'review';

export interface SessionQuestion {
  questionId:     string;
  choiceOrder:    AnswerKey[];
  selectedAnswer: AnswerKey | null;
  isCorrect:      boolean | null;
  timeSpentMs:    number | null;
  /** True when the question timer expired before the user answered. */
  timedOut:       boolean;
}

export interface Session {
  id:                  string;
  mode:                SessionMode;
  level:               CDCLevel | 'both';
  originalQuestionIds: string[];
  questions:           SessionQuestion[];
  currentIndex:        number;
  startedAt:           number;
  completedAt:         number | null;
  /**
   * Derived from mode at session creation:
   * - 'quiz' mode → false (no feedback until results)
   * - 'study' mode → true (always immediate feedback)
   * - all other modes → respects user's instantFeedback setting
   */
  showFeedback:        boolean;
  timedMode:           boolean;
}
