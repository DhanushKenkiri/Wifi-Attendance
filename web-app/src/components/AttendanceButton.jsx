import React from 'react';
import { CheckCircle2 } from 'lucide-react';

const AttendanceButton = ({ onMark, loading = false, codeData, student, countdown }) => {
  const subject = codeData?.subject ?? 'Class Session';
  const teacher = codeData?.teacherName ?? 'Instructor';

  return (
    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 text-center shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-800/80">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-200">
        <CheckCircle2 className="h-9 w-9" />
      </div>
      <h2 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Mark attendance</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        You&apos;re marking attendance for{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{subject}</span> with{' '}
        <span className="font-semibold text-slate-700 dark:text-slate-200">{teacher}</span>.
      </p>
      {countdown ? (
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-200">
          Code expires in {Math.max(0, countdown.secondsRemaining)}s
        </p>
      ) : null}

      {student ? (
        <div className="mt-5 grid gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-left text-sm dark:border-slate-700/70 dark:bg-slate-900/40">
          <div>
            <span className="text-xs uppercase text-slate-500 dark:text-slate-400">Student</span>
            <br />
            {student.name}
          </div>
          <div>
            <span className="text-xs uppercase text-slate-500 dark:text-slate-400">Email</span>
            <br />
            {student.email}
          </div>
          <div>
            <span className="text-xs uppercase text-slate-500 dark:text-slate-400">Department</span>
            <br />
            {student.department ?? '—'}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onMark}
        className="mt-6 w-full rounded-2xl bg-primary-600 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:bg-primary-500/60"
        disabled={loading}
      >
        {loading ? 'Recording…' : 'Confirm attendance'}
      </button>
    </div>
  );
};

export default AttendanceButton;
