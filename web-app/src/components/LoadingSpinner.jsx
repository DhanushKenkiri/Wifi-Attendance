import React from 'react';
import clsx from 'clsx';

const LoadingSpinner = ({ className = '', label = 'Loading…', size = 'md' }) => {
  const dimensions = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-12 w-12' : 'h-8 w-8';

  return (
    <div
      className={clsx('flex flex-col items-center justify-center gap-2 text-accent-600', className)}
    >
      <div
        className={clsx(
          'animate-spin rounded-full border-2 border-primary-200 border-t-primary-600',
          dimensions,
        )}
      />
      {label ? (
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</span>
      ) : null}
    </div>
  );
};

export default LoadingSpinner;
