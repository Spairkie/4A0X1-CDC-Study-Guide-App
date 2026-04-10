import React, { useCallback } from 'react';
import { Check, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { AnswerKey } from '../../types';

interface AnswerButtonProps {
  choiceKey:  AnswerKey;
  text:       string;
  selected:   boolean;
  correct:    boolean | null;   // true=correct, false=wrong, null=unrevealed
  revealed:   boolean;
  disabled:   boolean;
  onClick:    (key: AnswerKey) => void;
}

const LABELS: Record<AnswerKey, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };

export const AnswerButton: React.FC<AnswerButtonProps> = ({
  choiceKey, text, selected, correct, revealed, disabled, onClick,
}) => {
  const handleClick = useCallback(() => {
    if (!disabled) onClick(choiceKey);
  }, [disabled, onClick, choiceKey]);

  const showCorrect = revealed && correct === true;
  const showWrong   = revealed && selected && correct === false;
  const isNeutral   = !revealed && !selected;
  const isSelected  = !revealed && selected;

  return (
    <button
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 text-left transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2',
        // BUG FIX: only apply active scale when not disabled — disabled buttons
        // should not animate on tap (confusing on touch devices)
        !disabled && 'cursor-pointer hover:shadow-sm active:scale-[0.98]',
        isNeutral   && 'border-app bg-surface hover:border-indigo-300 dark:hover:border-indigo-700',
        isSelected  && 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30',
        showCorrect && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30',
        showWrong   && 'border-red-400 bg-red-50 dark:bg-red-900/30',
        revealed && !selected && !showCorrect && 'opacity-50',
        disabled && 'cursor-not-allowed',
      )}
      onClick={handleClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={`${LABELS[choiceKey]}: ${text}`}
    >
      <span className={clsx(
        'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-display font-bold flex-shrink-0 transition-colors',
        isNeutral   && 'bg-raised text-muted',
        isSelected  && 'bg-indigo-500 text-white',
        showCorrect && 'bg-emerald-500 text-white',
        showWrong   && 'bg-red-500 text-white',
        revealed && !selected && !showCorrect && 'bg-raised text-subtle',
      )} aria-hidden>
        {revealed && selected && correct !== null
          ? correct
            ? <Check size={14} strokeWidth={3} />
            : <X     size={14} strokeWidth={3} />
          : LABELS[choiceKey]
        }
      </span>

      <span className={clsx(
        'text-sm font-body leading-snug',
        showCorrect ? 'text-emerald-800 dark:text-emerald-300 font-medium' :
        showWrong   ? 'text-red-800 dark:text-red-300' :
        isSelected  ? 'text-indigo-800 dark:text-indigo-300 font-medium' :
        'text-app'
      )}>
        {text}
      </span>

      {showCorrect && !selected && (
        <span className="ml-auto flex-shrink-0">
          <Check size={16} className="text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
        </span>
      )}
    </button>
  );
};
