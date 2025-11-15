import { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Loader2, ShieldCheck } from 'lucide-react';
import TimerSelect from '../components/TimerSelect.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { apiRequest } from '../api/client.js';

const formatTime = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
};

const Home = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [duration, setDuration] = useState(3);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activeCode, setActiveCode] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!user) {
      setTeacherProfile(null);
      setLoadingProfile(false);
      return;
    }
    setTeacherProfile(user);
    setLoadingProfile(false);
  }, [user]);

  useEffect(() => {
    if (!teacherProfile?.classId) {
      setActiveCode(null);
      return undefined;
    }

    let cancelled = false;

    const fetchActiveCode = async () => {
      try {
        const response = await apiRequest('/api/attendance-codes/active');
        if (!cancelled) {
          setActiveCode(response.code ?? null);
        }
      } catch (error) {
        if (!cancelled) {
          if (error.status === 401) {
            showToast({ title: 'Session expired', description: 'Please sign in again.', tone: 'error' });
            await logout();
          } else {
            showToast({ title: 'Unable to fetch code', description: error.message, tone: 'error' });
          }
        }
      }
    };

    fetchActiveCode();
    const interval = window.setInterval(fetchActiveCode, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [logout, showToast, teacherProfile?.classId]);

  useEffect(() => {
    if (!activeCode?.expiryTime || !teacherProfile?.classId) {
      setCountdown(0);
      return undefined;
    }

    const tick = () => {
      const diff = Math.max(0, Math.floor((activeCode.expiryTime - Date.now()) / 1000));
      setCountdown(diff);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [activeCode?.expiryTime, teacherProfile?.classId]);

  const handleGenerateCode = async () => {
    if (!teacherProfile?.classId) {
      showToast({ title: 'Class ID missing', description: 'Set your class details in profile', tone: 'error' });
      return;
    }
    setGenerating(true);
    try {
      const response = await apiRequest('/api/attendance-codes', {
        method: 'POST',
        data: { durationMinutes: duration }
      });
      setActiveCode(response.code);
      showToast({ title: 'Attendance code created', tone: 'success' });
    } catch (error) {
      if (error.status === 401) {
        showToast({ title: 'Session expired', description: 'Please sign in again.', tone: 'error' });
        await logout();
      } else {
        showToast({ title: 'Could not generate code', description: error.message, tone: 'error' });
      }
    } finally {
      setGenerating(false);
    }
  };

  const progress = useMemo(() => {
    if (!activeCode) {
      return 0;
    }
    const totalSeconds = activeCode.duration * 60;
    if (!totalSeconds) {
      return 0;
    }
    return Math.max(0, Math.min(100, ((totalSeconds - countdown) / totalSeconds) * 100));
  }, [activeCode, countdown]);

  if (loadingProfile) {
    return <LoadingSpinner label="Preparing your dashboard" className="min-h-[50vh]" />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr,_0.8fr]">
      <section className="card">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">Active class</p>
            <h2 className="text-2xl font-semibold">{teacherProfile?.classId ?? 'No class assigned'}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{teacherProfile?.department}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">Generate Attendance Code</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Choose duration and press generate to broadcast a secure one-time code.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <TimerSelect value={duration} onChange={setDuration} />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleGenerateCode}
                  disabled={generating}
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Code'}
                </button>
              </div>
            </div>
            {activeCode ? (
              <div className="mt-8 grid gap-4 rounded-2xl bg-slate-900/80 p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                    <ShieldCheck className="h-4 w-4" />
                    Live Attendance Session
                  </span>
                  <span className="text-xs uppercase tracking-wide text-slate-400">
                    Expires in {formatTime(Math.max(countdown, 0))}
                  </span>
                </div>
                <div className="text-5xl font-mono font-bold tracking-[0.3em]">{activeCode.code}</div>
                <div className="relative h-2 overflow-hidden rounded-full bg-white/20">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-400 transition-all" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  <span>Duration: {activeCode.duration} min</span>
                  <span>Class: {activeCode.classId}</span>
                  <span>Teacher: {activeCode.teacherName}</span>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex items-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white/40 p-6 text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                <ClipboardCheck className="h-10 w-10" />
                <div>
                  <p className="font-medium">No active session</p>
                  <p className="text-sm">Generate a code when you are ready to start attendance.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      <section className="card space-y-4">
        <h3 className="text-lg font-semibold">Class snapshot</h3>
        <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
            <span>Teacher</span>
            <span className="font-semibold">{teacherProfile?.name || user?.name || user?.email}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
            <span>Department</span>
            <span className="font-semibold">{teacherProfile?.department || 'Not set'}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-800">
            <span>Next session</span>
            <span className="font-semibold text-primary-600 dark:text-primary-400">Check timetable</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
