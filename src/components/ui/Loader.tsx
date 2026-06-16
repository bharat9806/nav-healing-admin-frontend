'use client';

import s from './Loader.module.scss';

type SpinnerSize = 'sm' | 'md' | 'lg';

type LoaderProps = {
  /** Optional label rendered below the spinner. */
  label?: string;
  /** Spinner diameter. Defaults to 'md'. */
  size?: SpinnerSize;
  /** Fill and center within the parent container. Defaults to true. */
  fill?: boolean;
  className?: string;
};

/**
 * Shared loading spinner for the admin panel.
 * Use for full-area / inline loading states.
 * For table or list placeholders, prefer <SkeletonList />.
 */
export function Loader({ label, size = 'md', fill = true, className = '' }: LoaderProps) {
  return (
    <div
      className={`${fill ? s.fill : s.inline} ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className={`${s.spinner} ${s[size]}`} aria-hidden="true" />
      {label ? <span className={s.label}>{label}</span> : <span className={s.srOnly}>Loading</span>}
    </div>
  );
}

type SkeletonListProps = {
  /** Number of placeholder rows. Defaults to 5. */
  rows?: number;
  /** Height of each row (any CSS length). Defaults to 4rem. */
  rowHeight?: string;
  className?: string;
};

/**
 * Animated skeleton rows for table / list loading states.
 * Drop-in replacement for the per-page skeletonList/skeletonRow markup.
 */
export function SkeletonList({ rows = 5, rowHeight = '4rem', className = '' }: SkeletonListProps) {
  return (
    <div className={`${s.skeletonList} ${className}`} role="status" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={s.skeletonRow} style={{ height: rowHeight }} />
      ))}
      <span className={s.srOnly}>Loading</span>
    </div>
  );
}

export default Loader;
