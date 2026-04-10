import type {
  MergedQuizData,
  Question,
  AnswerKey,
  QuestionProgress,
  GroupProgress,
  UserData,
  Session,
  CDCLevel,
} from '../types';

// ─── Normalize merged JSON → internal Question[] ───────────────────────────

export function normalizeQuizData(raw: MergedQuizData): Question[] {
  return raw.questions.map(q => ({
    id:               q.id,
    level:            q.level,
    groupNumber:      q.groupNumber,
    groupLabel:       q.groupLabel,
    questionNumber:   q.questionNumber,
    text:             q.question,
    choices:          q.choices as Partial<Record<AnswerKey, string>>,
    correctAnswer:    q.correctAnswer as AnswerKey | null,
    correctText:      q.correctText,
    isScorableQuestion: q.isScorableQuestion,
    verified:         q.verified,
    lesson:           q.lesson,
    sourcePageRange:  q.sourcePageRange,
  }));
}

// ─── Level filter ──────────────────────────────────────────────────────────

export function filterByLevel(questions: Question[], level: CDCLevel | 'both'): Question[] {
  if (level === 'both') return questions;
  return questions.filter(q => q.level === level);
}

// ─── Selectors ─────────────────────────────────────────────────────────────

export function getQuestionsByGroup(
  questions: Question[], level: CDCLevel, groupNumber: number
): Question[] {
  return questions.filter(q => q.level === level && q.groupNumber === groupNumber);
}

export function getMissedQuestions(questions: Question[], userData: UserData): Question[] {
  return questions.filter(q => {
    const p = userData.questions[q.id];
    if (!p || p.status === 'unseen') return false;
    return (
      p.status === 'incorrect' ||
      (p.incorrectCount > 0 && p.incorrectCount >= p.correctCount && p.status !== 'mastered')
    );
  });
}

export function getMasteredQuestions(questions: Question[], userData: UserData): Question[] {
  return questions.filter(q => userData.questions[q.id]?.status === 'mastered');
}

export function getFavoriteQuestions(questions: Question[], userData: UserData): Question[] {
  return questions.filter(q => userData.questions[q.id]?.isFavorite);
}

export function getUnseenQuestions(questions: Question[], userData: UserData): Question[] {
  return questions.filter(q => {
    const p = userData.questions[q.id];
    return !p || p.status === 'unseen';
  });
}

export function getReviewQuestions(questions: Question[], userData: UserData): Question[] {
  return questions.filter(q => userData.questions[q.id]?.isMarkedForReview);
}

// ─── Group progress calculator ─────────────────────────────────────────────

export function calcGroupProgress(
  level: CDCLevel,
  groupNumber: number,
  questions: Question[],
  userData: UserData
): GroupProgress {
  const grpQs = getQuestionsByGroup(questions, level, groupNumber);
  let seenCount = 0, correctCount = 0, incorrectCount = 0, masteredCount = 0;
  let lastStudiedAt: number | null = null;

  for (const q of grpQs) {
    const p = userData.questions[q.id];
    if (!p || p.status === 'unseen') continue;
    seenCount++;
    if (p.status === 'mastered') { masteredCount++; correctCount++; }
    else if (p.status === 'correct') correctCount++;
    else if (p.status === 'incorrect') incorrectCount++;
    if (p.lastAnsweredAt && (!lastStudiedAt || p.lastAnsweredAt > lastStudiedAt)) {
      lastStudiedAt = p.lastAnsweredAt;
    }
  }

  return {
    level,
    groupNumber,
    groupLabel: grpQs[0]?.groupLabel ?? 'Module',
    totalQuestions: grpQs.length,
    seenCount,
    correctCount,
    incorrectCount,
    masteredCount,
    lastStudiedAt,
  };
}

// ─── Mastery helpers ───────────────────────────────────────────────────────

export function defaultProgress(id: string): QuestionProgress {
  return {
    id,
    status:            'unseen',
    correctCount:      0,
    incorrectCount:    0,
    isFlagged:         false,
    isFavorite:        false,
    isMarkedForReview: false,
    lastAnsweredAt:    null,
    lastAnswer:        null,
    nextReviewAt:      null,
    masteredAt:        null,
  };
}

export function calcNextReview(correctCount: number): number {
  const days = Math.pow(2, Math.min(correctCount - 1, 4));
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

// ─── Session scoring ───────────────────────────────────────────────────────

/**
 * Calculate session score.
 * - timedOut questions (answered = null but isCorrect = false) count as incorrect.
 * - questions with selectedAnswer = null and timedOut = false count as unanswered/skipped.
 */
export function calcSessionScore(
  session: Session,
  questionsOrMap: Question[] | Map<string, Question>
): {
  scored: number; correct: number; incorrect: number;
  unanswered: number; unscorableCount: number;
} {
  const map: Map<string, Question> =
    questionsOrMap instanceof Map
      ? questionsOrMap
      : new Map(questionsOrMap.map(q => [q.id, q]));

  let correct = 0, incorrect = 0, unanswered = 0, unscorableCount = 0;
  for (const sq of session.questions) {
    const q = map.get(sq.questionId);
    if (!q) continue;
    if (!q.isScorableQuestion) { unscorableCount++; continue; }
    if (sq.timedOut || (sq.selectedAnswer !== null && sq.isCorrect === false)) {
      incorrect++;
    } else if (sq.isCorrect === true) {
      correct++;
    } else {
      // selectedAnswer is null and not timedOut → genuinely unanswered/skipped
      unanswered++;
    }
  }
  return {
    scored: session.questions.length - unscorableCount,
    correct,
    incorrect,
    unanswered,
    unscorableCount,
  };
}

export function buildSessionQuestion(
  questionId: string,
  choiceKeys: AnswerKey[],
  shuffleAnswers: boolean
): import('../types').SessionQuestion {
  const choiceOrder: AnswerKey[] = shuffleAnswers ? shuffle(choiceKeys) : [...choiceKeys];
  return {
    questionId,
    choiceOrder,
    selectedAnswer: null,
    isCorrect:      null,
    timeSpentMs:    null,
    timedOut:       false,
  };
}

/** Fisher-Yates shuffle — unbiased and O(n). */
export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Format helpers ─────────────────────────────────────────────────────────

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function pct(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

// ─── Unique group numbers per level ────────────────────────────────────────

export function getGroupNumbers(questions: Question[], level: CDCLevel): number[] {
  return [...new Set(
    questions.filter(q => q.level === level).map(q => q.groupNumber)
  )].sort((a, b) => a - b);
}
