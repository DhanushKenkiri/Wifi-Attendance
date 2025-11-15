import React, { useState } from 'react';
import { LogIn } from 'lucide-react';

const StudentLogin = ({ onSubmit, loading = false, error = '', codeData, countdown }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit?.({ email, password });
  };

  return (
    <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white/90 p-8 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-800/80">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-50 text-accent-600 dark:bg-accent-500/10 dark:text-accent-100">
          <LogIn className="h-9 w-9" />
        </div>
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-slate-100">Welcome back</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Sign in with your university credentials to continue.
        </p>
        {codeData ? (
          <div className="mt-4 rounded-2xl border border-primary-500/30 bg-primary-500/10 px-4 py-3 text-sm text-primary-700 dark:border-primary-400/40 dark:bg-primary-500/10 dark:text-primary-200">
            <p className="font-semibold">{codeData.subject ?? 'Class Session'}</p>
            <p className="text-xs text-primary-600/80 dark:text-primary-100/80">
              Instructor: {codeData.teacherName ?? 'Unknown'} · Code: {codeData.code}
            </p>
            {countdown ? (
              <p className="mt-2 text-xs font-medium uppercase text-primary-600 dark:text-primary-200">
                Code expires in {Math.max(0, countdown.secondsRemaining)}s
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-left text-sm font-medium text-slate-700 dark:text-slate-300">
          University Email
          <input
            type="email"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition focus:border-accent-500 focus:ring-4 focus:ring-accent-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            placeholder="studentid@uohyd.ac.in"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block text-left text-sm font-medium text-slate-700 dark:text-slate-300">
          Password
          <input
            type="password"
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm transition focus:border-accent-500 focus:ring-4 focus:ring-accent-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>

        {error ? (
          <p className="rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm font-medium text-error">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          className="w-full rounded-2xl bg-accent-600 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-accent-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-300 disabled:cursor-not-allowed disabled:bg-accent-600/60"
          disabled={loading}
        >
          {loading ? 'Signing in…' : 'Sign in & Continue'}
        </button>
      </form>
    </div>
  );
};

export default StudentLogin;
