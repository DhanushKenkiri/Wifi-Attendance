import React, { useEffect } from 'react';
import ConfettiEffect from './ConfettiEffect.jsx';
import { PartyPopper } from 'lucide-react';
import { format } from 'date-fns';

const AttendanceSuccess = ({ data, onReset, autoResetMs = 6000 }) => {
  useEffect(() => {
    if (!onReset) {
      return undefined;
    }

    const timer = setTimeout(() => {
      onReset();
    }, autoResetMs);

    return () => clearTimeout(timer);
  }, [onReset, autoResetMs]);

  const dateDisplay = data?.markedAt ? format(new Date(data.markedAt), 'PPpp') : 'Just now';

  return (
    <div className="relative flex w-full max-w-2xl flex-col items-center overflow-hidden rounded-3xl border border-primary-500/40 bg-white/95 p-10 text-center shadow-2xl backdrop-blur dark:border-primary-400/40 dark:bg-slate-800/90">
      <ConfettiEffect recycle={false} numberOfPieces={500} />
      <div className="relative z-10">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg">
          <PartyPopper className="h-10 w-10" />
        </div>
        <h2 className="text-4xl font-semibold text-primary-700 dark:text-primary-200">
          Attendance recorded!
        </h2>
        <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
          Thanks, {data?.name ?? 'student'}. Your attendance for {data?.subject ?? 'the session'}{' '}
          has been logged.
        </p>

        <div className="mt-6 grid w-full gap-3 rounded-2xl border border-primary-500/30 bg-primary-50/80 px-5 py-4 text-left text-sm text-primary-700 dark:border-primary-400/30 dark:bg-primary-500/10 dark:text-primary-100">
          <div>
            <span className="text-xs uppercase tracking-wide text-primary-500/80">Timestamp</span>
            <p className="font-semibold">{dateDisplay}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-primary-500/80">Marked via</span>
            <p className="font-semibold">{data?.markedVia ?? 'Web App'}</p>
          </div>
          <div>
            <span className="text-xs uppercase tracking-wide text-primary-500/80">Code</span>
            <p className="font-semibold">{data?.code ?? '—'}</p>
          </div>
        </div>

        <p className="mt-6 text-sm text-slate-500 dark:text-slate-300">
          You will be redirected to the code entry screen shortly.
        </p>
      </div>
    </div>
  );
};

export default AttendanceSuccess;
