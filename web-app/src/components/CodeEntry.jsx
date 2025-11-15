import React, { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import ProgressBar from './ProgressBar.jsx';
import { ShieldCheck } from 'lucide-react';

const DIGIT_COUNT = 6;

const CodeEntry = ({
  onValidate,
  loading = false,
  error = '',
  countdown,
  isPortalMode = false,
}) => {
  const [values, setValues] = useState(Array(DIGIT_COUNT).fill(''));
  const inputRefs = useRef([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (idx, value) => {
    if (!/^[0-9]{0,1}$/.test(value)) {
      return;
    }

    const nextValues = [...values];
    nextValues[idx] = value;
    setValues(nextValues);

    if (value && idx < DIGIT_COUNT - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyDown = (idx, event) => {
    if (event.key === 'Backspace' && !values[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const code = useMemo(() => values.join(''), [values]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (code.length === DIGIT_COUNT && !loading) {
      onValidate?.(code);
    }
  };

  const reset = () => {
    setValues(Array(DIGIT_COUNT).fill(''));
    inputRefs.current[0]?.focus();
  };

  useEffect(() => {
    if (error) {
      reset();
    }
    // we only want to react when error toggles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  const remainingSeconds = countdown?.secondsRemaining ?? null;
  const percentRemaining = countdown ? countdown.percentRemaining : null;

  return (
    <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-800/80">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
          <ShieldCheck className="h-9 w-9" />
        </div>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
          Mark Your Attendance
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Enter the 6-digit code shared by your instructor.
        </p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-accent-500">
          Mode: {isPortalMode ? 'Captive Portal' : 'Cloud'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-center gap-3">
          {values.map((value, idx) => (
            <input
              key={idx}
              ref={(el) => {
                inputRefs.current[idx] = el;
              }}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              className={clsx(
                'code-input h-16 w-14 rounded-2xl border-2 text-center text-3xl font-semibold text-slate-800 transition focus:border-primary-500 focus:shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
                value ? 'border-primary-500 shadow-md dark:border-primary-400' : 'border-slate-200',
              )}
              value={value}
              onChange={(event) => handleChange(idx, event.target.value)}
              onKeyDown={(event) => handleKeyDown(idx, event)}
              aria-label={`Code digit ${idx + 1}`}
              disabled={loading}
            />
          ))}
        </div>

        {countdown ? (
          <ProgressBar
            percent={percentRemaining ?? 0}
            label={
              remainingSeconds !== null ? `Code expires in ${remainingSeconds}s` : 'Code active'
            }
          />
        ) : null}

        {error ? (
          <p className="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm font-medium text-error">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-2xl bg-primary-600 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:bg-primary-500/50"
          disabled={loading || code.length !== DIGIT_COUNT}
        >
          {loading ? 'Checking…' : 'Verify Code'}
        </button>
      </form>
    </div>
  );
};

export default CodeEntry;
