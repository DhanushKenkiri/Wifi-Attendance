const LoadingSpinner = ({ label = 'Loading...', className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400 ${className}`}>
    <span className="inline-flex h-10 w-10 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
    <span>{label}</span>
  </div>
);

export default LoadingSpinner;
