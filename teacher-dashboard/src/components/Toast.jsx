import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { XCircle } from 'lucide-react';

const ToastContext = createContext();

let counter = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((items) => items.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((toast) => {
    counter += 1;
    const id = `${Date.now()}-${counter}`;
    const config = { id, duration: 4000, tone: 'info', ...toast };
    setToasts((items) => [...items, config]);
    if (config.duration !== null) {
      window.setTimeout(() => removeToast(id), config.duration);
    }
    return id;
  }, [removeToast]);

  const value = useMemo(() => ({ showToast, removeToast }), [showToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border p-4 shadow-lg backdrop-blur transition-all ${
              toast.tone === 'success'
                ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-200'
                : toast.tone === 'error'
                  ? 'border-red-600/30 bg-red-500/10 text-red-100'
                  : 'border-slate-600/30 bg-slate-800/80 text-slate-100'
            }`}
          >
            <div className="flex-1">
              {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
              {toast.description && <p className="mt-1 text-xs opacity-80">{toast.description}</p>}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="rounded-full bg-white/10 p-1 text-slate-100 transition hover:bg-white/20"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};
