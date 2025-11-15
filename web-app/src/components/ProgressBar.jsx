import React from 'react';
import clsx from 'clsx';

const ProgressBar = ({ percent = 0, label }) => {
  const clamped = Math.min(100, Math.max(0, percent));

  return (
    <div className="w-full">
      {label ? (
        <p className="mb-2 text-xs font-semibold uppercase text-slate-500">{label}</p>
      ) : null}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className={clsx(
            'absolute left-0 top-0 h-full rounded-full bg-primary-500 transition-all',
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
