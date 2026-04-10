import React from 'react';
import { clsx } from 'clsx';

// ─── Button ─────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', fullWidth, loading, className, children, disabled, ...props }, ref) => {
    const base = 'inline-flex items-center justify-center gap-2 font-display font-semibold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';
    const variants = {
      primary:   'bg-indigo-500 text-white hover:bg-indigo-600 focus-visible:ring-indigo-500 shadow-sm',
      secondary: 'bg-raised text-app border border-app hover:bg-slate-100 dark:hover:bg-slate-700 focus-visible:ring-indigo-400',
      ghost:     'text-muted hover:bg-raised hover:text-app focus-visible:ring-indigo-400',
      danger:    'bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-400 shadow-sm',
      success:   'bg-emerald-500 text-white hover:bg-emerald-600 focus-visible:ring-emerald-400 shadow-sm',
    };
    const sizes = { sm: 'h-8 px-3 text-sm', md: 'h-10 px-5 text-sm', lg: 'h-12 px-6 text-base' };

    return (
      <button
        ref={ref}
        className={clsx(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Spinner size="sm" /> : children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({ padded = true, hoverable, className, children, ...props }) => (
  <div
    className={clsx(
      'bg-surface rounded-2xl border border-app shadow-sm',
      padded && 'p-4',
      hoverable && 'transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

// ─── Badge ───────────────────────────────────────────────────────────────────

interface BadgeProps {
  variant?: 'default' | 'success' | 'error' | 'warning' | 'brand' | 'neutral' | 'level5' | 'level7';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className }) => {
  const variants: Record<string, string> = {
    default: 'bg-raised text-muted',
    success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    error:   'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    brand:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    level5:  'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    level7:  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400',
  };
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold font-display',
      variants[variant] ?? variants.default,
      className
    )}>
      {children}
    </span>
  );
};

// ─── Level Badge ─────────────────────────────────────────────────────────────

export const LevelBadge: React.FC<{ level: '5-level' | '7-level' | 'both'; className?: string }> = ({ level, className }) => {
  if (level === 'both') return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold font-display bg-gradient-to-r from-blue-100 to-violet-100 text-indigo-700 dark:from-blue-900/40 dark:to-violet-900/40 dark:text-indigo-300', className)}>
      5 + 7 Level
    </span>
  );
  return (
    <Badge variant={level === '5-level' ? 'level5' : 'level7'} className={className}>
      {level === '5-level' ? '5-Level' : '7-Level'}
    </Badge>
  );
};

// ─── Progress Bar ────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value: number;
  variant?: 'brand' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  animated?: boolean;
  className?: string;
  label?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value, variant = 'brand', size = 'sm', animated, className, label
}) => {
  const colors = {
    brand:   'bg-indigo-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error:   'bg-red-500',
  };
  const heights = { sm: 'h-1.5', md: 'h-2.5' };
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={clsx('w-full bg-raised rounded-full overflow-hidden', heights[size], className)}>
      <div
        className={clsx(colors[variant], heights[size], 'rounded-full transition-all duration-500', animated && 'progress-fill')}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `${clamped}%`}
      />
    </div>
  );
};

// ─── Spinner ─────────────────────────────────────────────────────────────────

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-8 w-8 border-[3px]' };
  return <div className={clsx('rounded-full border-current border-t-transparent animate-spin opacity-60', sizes[size])} role="status" aria-label="Loading" />;
};

// ─── Empty State ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in">
    <div className="w-16 h-16 rounded-2xl bg-raised flex items-center justify-center text-3xl mb-4">{icon}</div>
    <h3 className="font-display font-semibold text-lg text-app mb-1">{title}</h3>
    {description && <p className="text-muted text-sm max-w-xs">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
  sub?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color = 'text-indigo-500', sub }) => (
  <Card padded className="flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-muted text-xs font-display font-medium uppercase tracking-wide">{label}</span>
      {icon && <span className={clsx('text-xl', color)}>{icon}</span>}
    </div>
    <div className="font-display font-bold text-2xl text-app">{value}</div>
    {sub && <div className="text-subtle text-xs">{sub}</div>}
  </Card>
);

// ─── Toggle ──────────────────────────────────────────────────────────────────
// BUG FIX: replaced <label> wrapping <button> (invalid HTML — interactive element
// inside <label> causes double-fire in some browsers) with a <div> wrapper.
// The switch button carries its own aria-label so screen readers work correctly.

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description, disabled }) => (
  <div className={clsx('flex items-center justify-between gap-4 py-3', disabled && 'opacity-50')}>
    <div>
      <div className="text-app text-sm font-medium">{label}</div>
      {description && <div className="text-muted text-xs mt-0.5">{description}</div>}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={clsx(
        'relative w-11 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed',
        checked ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'
      )}
    >
      <span className={clsx(
        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200',
        checked && 'translate-x-5'
      )} />
    </button>
  </div>
);

// ─── Section Header ──────────────────────────────────────────────────────────

export const SectionHeader: React.FC<{ title: string; action?: React.ReactNode }> = ({ title, action }) => (
  <div className="flex items-center justify-between mb-3">
    <h2 className="font-display font-bold text-base text-app">{title}</h2>
    {action}
  </div>
);
