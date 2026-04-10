import React from 'react';
import { Bookmark, Star, Flag, HelpCircle, ShieldCheck, Clock } from 'lucide-react';
import { clsx } from 'clsx';
import type { Question, SessionQuestion, QuestionProgress, AnswerKey } from '../../types';
import { AnswerButton } from './AnswerButton';

interface QuestionCardProps {
  question:          Question;
  sessionQ:          SessionQuestion;
  progress:          QuestionProgress | null;
  groupLabel:        string;
  questionLabel:     string;
  revealed:          boolean;
  onAnswer:          (key: AnswerKey) => void;
  onToggleFavorite?: () => void;
  onToggleFlag?:     () => void;
  onToggleReview?:   () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question, sessionQ, progress, groupLabel, questionLabel,
  revealed, onAnswer, onToggleFavorite, onToggleFlag, onToggleReview,
}) => {
  // BUG FIX: hasAnswer must include timedOut — when a question times out,
  // selectedAnswer stays null but the question is "done" and choices must be
  // locked/disabled and feedback must be shown.
  const hasAnswer      = sessionQ.selectedAnswer !== null || sessionQ.timedOut;
  const isUnknown      = !question.isScorableQuestion;
  const choiceEntries  = sessionQ.choiceOrder
    .filter(k => question.choices[k] !== undefined)
    .map(k => [k, question.choices[k]!] as [AnswerKey, string]);

  return (
    <div className="flex flex-col gap-4 animate-slide-up">
      {/* Meta row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={clsx(
            'text-xs font-display font-semibold px-2.5 py-1 rounded-full',
            question.level === '5-level'
              ? 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30'
              : 'text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30'
          )}>
            {groupLabel}
          </span>
          <span className="text-xs text-muted font-medium">{questionLabel}</span>
          {question.verified && (
            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={11} /> Verified
            </span>
          )}
          {sessionQ.timedOut && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">
              <Clock size={10} /> Timed out
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onToggleFavorite && (
            <ActionIcon
              label={progress?.isFavorite ? 'Remove favorite' : 'Favorite'}
              active={progress?.isFavorite}
              onClick={onToggleFavorite}
              icon={<Star size={16} />}
              activeColor="text-amber-500"
            />
          )}
          {onToggleFlag && (
            <ActionIcon
              label={progress?.isFlagged ? 'Unflag' : 'Flag as confusing'}
              active={progress?.isFlagged}
              onClick={onToggleFlag}
              icon={<Flag size={16} />}
              activeColor="text-red-500"
            />
          )}
          {onToggleReview && (
            <ActionIcon
              label={progress?.isMarkedForReview ? 'Remove bookmark' : 'Bookmark'}
              active={progress?.isMarkedForReview}
              onClick={onToggleReview}
              icon={<Bookmark size={16} />}
              activeColor="text-indigo-500"
            />
          )}
        </div>
      </div>

      {/* Question text */}
      <div className="bg-surface rounded-2xl border border-app p-4 shadow-sm">
        {isUnknown && (
          <div className="flex items-center gap-1.5 mb-3 text-amber-600 dark:text-amber-400 text-xs font-medium">
            <HelpCircle size={13} />
            <span>Official correct answer not available for this question</span>
          </div>
        )}
        <p className="text-app text-[15px] leading-relaxed font-body">{question.text}</p>
        {question.sourcePageRange && (
          <p className="text-subtle text-xs mt-2">Ref: {question.sourcePageRange}</p>
        )}
      </div>

      {/* Answer choices */}
      <div className="flex flex-col gap-2.5" role="group" aria-label="Answer choices">
        {choiceEntries.map(([key, text]) => {
          const isCorrect = revealed && question.correctAnswer === key
            ? true
            : revealed && sessionQ.selectedAnswer === key && question.correctAnswer !== key
            ? false
            : null;

          return (
            <AnswerButton
              key={key}
              choiceKey={key}
              text={text}
              selected={sessionQ.selectedAnswer === key}
              correct={isCorrect}
              // Reveal choices when feedback is on AND the question is done (answered or timed out)
              revealed={revealed && hasAnswer}
              // Lock choices once the question is done (answered OR timed out)
              disabled={hasAnswer}
              onClick={onAnswer}
            />
          );
        })}
      </div>

      {/* Feedback panel — shown when feedback is on AND the question is done */}
      {revealed && hasAnswer && (
        <FeedbackPanel
          isCorrect={sessionQ.timedOut ? false : sessionQ.isCorrect}
          isUnknown={isUnknown}
          correctText={question.correctText}
          timedOut={sessionQ.timedOut}
        />
      )}
    </div>
  );
};

// ─── Action icon button ─────────────────────────────────────────────────────

const ActionIcon: React.FC<{
  label: string; active?: boolean; onClick: () => void;
  icon: React.ReactNode; activeColor: string;
}> = ({ label, active, onClick, icon, activeColor }) => (
  <button
    aria-label={label}
    onClick={onClick}
    className={clsx(
      'p-2 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
      active ? activeColor : 'text-subtle hover:text-muted hover:bg-raised'
    )}
  >
    {icon}
  </button>
);

// ─── Feedback panel ─────────────────────────────────────────────────────────

const FeedbackPanel: React.FC<{
  isCorrect: boolean | null;
  isUnknown: boolean;
  correctText: string | null;
  timedOut: boolean;
}> = ({ isCorrect, isUnknown, correctText, timedOut }) => {
  if (isUnknown) return (
    <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
      <p className="text-amber-800 dark:text-amber-300 text-sm font-medium">
        {timedOut
          ? 'Time expired — no official answer to compare against.'
          : 'Practice answer recorded — no official answer to compare against.'}
      </p>
    </div>
  );

  if (isCorrect === null) return null;

  return (
    <div className={clsx(
      'rounded-2xl border-2 p-4',
      isCorrect
        ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20'
        : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
    )}>
      <div className={clsx(
        'font-display font-semibold text-sm mb-1',
        isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
      )}>
        {timedOut ? '⏱ Time Expired' : isCorrect ? '✓ Correct!' : '✗ Incorrect'}
      </div>
      {!isCorrect && correctText && (
        <p className="text-sm text-red-800 dark:text-red-300">
          Correct answer: <strong>{correctText}</strong>
        </p>
      )}
    </div>
  );
};
