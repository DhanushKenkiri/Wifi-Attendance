import React, { useEffect } from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

const variants = {
  success: 'bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-200',
  error: 'bg-error/10 text-error dark:bg-error/20 dark:text-error',
  info: 'bg-accent-500/10 text-accent-600 dark:bg-accent-500/20 dark:text-accent-100',
  warning: 'bg-warning/10 text-warning dark:bg-warning/20 dark:text-warning',
};

const Toast = ({ message, type = 'info', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [message, onClose, duration]);

  if (!message) {
    return null;
  }

  return (
    <div
      className={clsx(
        'fixed bottom-6 left-1/2 z-50 flex w-[90%] max-w-md -translate-x-1/2 items-center justify-between rounded-2xl px-5 py-4 shadow-lg backdrop-blur',
        variants[type] ?? variants.info,
      )}
      role="alert"
    >
      <span className="pr-4 text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="rounded-full p-1 text-sm text-slate-500 transition hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700/50"
        aria-label="Close toast"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;
