import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sun, Moon, RefreshCcw } from 'lucide-react';
import { FLOW_STEPS, AUTO_RESET_DELAY_MS } from './utils/constants.js';
import { useAppState, AppStateActions } from './context/AppStateContext.jsx';
import { ThemeContext } from './context/ThemeContext.jsx';
import CodeEntry from './components/CodeEntry.jsx';
import StudentLogin from './components/StudentLogin.jsx';
import AttendanceButton from './components/AttendanceButton.jsx';
import AttendanceSuccess from './components/AttendanceSuccess.jsx';
import Toast from './components/Toast.jsx';
import LoadingSpinner from './components/LoadingSpinner.jsx';
import { useAttendance } from './hooks/useAttendance.js';
import { useAuth } from './hooks/useAuth.js';
import { useCountdown } from './hooks/useCountdown.js';
import { isValidAttendanceCode, isValidEmail, isStrongPassword } from './utils/validators.js';
import { ref, get } from 'firebase/database';
import { database } from './utils/firebase.js';

const App = () => {
  const { state, dispatch } = useAppState();
  const { step, codeData, attendanceResult, toast, authUser } = state;
  const { verifyCode, markAttendance, detectNetworkMode } = useAttendance();
  const { login, logout, loading: authLoading, error: authError, currentUser } = useAuth();
  const [codeError, setCodeError] = useState('');
  const [loginError, setLoginError] = useState('');
  const [marking, setMarking] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const [countdownTarget, setCountdownTarget] = useState(null);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const themeContext = React.useContext(ThemeContext);

  const showToast = useCallback(
    (message, type = 'info') => {
      dispatch({
        type: AppStateActions.SET_TOAST,
        payload: { message, type },
      });
    },
    [dispatch],
  );

  const clearToast = useCallback(() => {
    dispatch({ type: AppStateActions.SET_TOAST, payload: null });
  }, [dispatch]);

  const resetFlow = useCallback(() => {
    dispatch({ type: AppStateActions.RESET });
    setCodeError('');
    setLoginError('');
    setMarking(false);
    setStudentProfile(null);
    setCountdownTarget(null);
    setVerifyingCode(false);
    logout().catch(() => {});
  }, [dispatch, logout]);

  const countdown = useCountdown(countdownTarget, {
    onExpire: () => {
      showToast('Attendance code expired. Please request a new code.', 'warning');
      resetFlow();
    },
  });

  const isPortalMode = useMemo(() => detectNetworkMode(), [detectNetworkMode]);

  const handleVerifyCode = useCallback(
    async (code) => {
      if (!isValidAttendanceCode(code)) {
        setCodeError('Please enter a valid 6-digit code.');
        return;
      }

      setCodeError('');
      setVerifyingCode(true);
      let result;
      try {
        result = await verifyCode(code);
      } finally {
        setVerifyingCode(false);
      }
      if (!result.success) {
        setCodeError(result.error);
        return;
      }

      dispatch({ type: AppStateActions.SET_CODE_DATA, payload: result.data });
      dispatch({ type: AppStateActions.SET_STEP, payload: FLOW_STEPS.LOGIN });
      setCountdownTarget(result.data.expiryTime);
      showToast('Attendance code verified. Please sign in.', 'success');
    },
    [dispatch, verifyCode, showToast],
  );

  const handleLogin = useCallback(
    async ({ email, password }) => {
      if (!isValidEmail(email)) {
        setLoginError('Enter a valid university email address.');
        return;
      }

      if (!isStrongPassword(password)) {
        setLoginError('Password must be at least 6 characters long.');
        return;
      }

      setLoginError('');
      const result = await login(email.toLowerCase(), password);

      if (!result.success) {
        setLoginError('Invalid credentials. Please try again.');
        return;
      }

      const studentId = email.split('@')[0];
      try {
        const profileRef = ref(database, `students/${studentId}`);
        const profileSnap = await get(profileRef);
        if (profileSnap.exists()) {
          setStudentProfile(profileSnap.val());
        } else {
          setStudentProfile({ name: studentId, email });
        }
      } catch (error) {
        console.warn('Unable to load student profile', error);
        setStudentProfile({ name: studentId, email });
      }

      dispatch({
        type: AppStateActions.SET_AUTH_USER,
        payload: {
          email,
          studentId,
          uid: result.user?.uid ?? null,
        },
      });

      dispatch({ type: AppStateActions.SET_STEP, payload: FLOW_STEPS.MARK });
      showToast('Signed in successfully. Ready to mark attendance.', 'success');
    },
    [dispatch, login, showToast],
  );

  const handleMarkAttendance = useCallback(async () => {
    if (!codeData || !state.authUser) {
      return;
    }
    setMarking(true);
    const result = await markAttendance(state.authUser.studentId, codeData);

    if (!result.success) {
      setMarking(false);
      showToast(result.error, 'error');
      return;
    }

    dispatch({ type: AppStateActions.SET_ATTENDANCE_RESULT, payload: result.data });
    dispatch({ type: AppStateActions.SET_STEP, payload: FLOW_STEPS.SUCCESS });
    showToast('Attendance recorded successfully!', 'success');
    setMarking(false);
  }, [codeData, markAttendance, dispatch, state.authUser, showToast]);

  useEffect(() => {
    if (authError) {
      setLoginError(authError);
    }
  }, [authError]);

  const handleSuccessReset = useCallback(() => {
    resetFlow();
  }, [resetFlow]);

  const renderContent = () => {
    switch (step) {
      case FLOW_STEPS.CODE:
      default:
        return (
          <CodeEntry
            onValidate={handleVerifyCode}
            loading={verifyingCode}
            error={codeError}
            countdown={countdownTarget ? countdown : null}
            isPortalMode={isPortalMode}
          />
        );
      case FLOW_STEPS.LOGIN:
        return (
          <StudentLogin
            onSubmit={handleLogin}
            loading={authLoading}
            error={loginError}
            codeData={codeData}
            countdown={countdownTarget ? countdown : null}
          />
        );
      case FLOW_STEPS.MARK:
        if (!studentProfile) {
          return <LoadingSpinner label="Loading your profile…" />;
        }
        return (
          <AttendanceButton
            onMark={handleMarkAttendance}
            loading={marking}
            codeData={codeData}
            student={{
              ...studentProfile,
              email: studentProfile.email ?? authUser?.email,
              name: studentProfile.name ?? authUser?.studentId,
            }}
            countdown={countdownTarget ? countdown : null}
          />
        );
      case FLOW_STEPS.SUCCESS:
        return (
          <AttendanceSuccess
            data={attendanceResult}
            onReset={handleSuccessReset}
            autoResetMs={AUTO_RESET_DELAY_MS}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50 p-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6">
        <header className="flex w-full items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="Student Attendance" className="h-12 w-12" />
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Student Attendance
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isPortalMode ? 'Captive Portal Mode' : 'Cloud Mode'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser ? (
              <button
                type="button"
                onClick={resetFlow}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:border-primary-200 hover:text-primary-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <RefreshCcw className="h-4 w-4" />
                Reset
              </button>
            ) : null}

            <button
              type="button"
              onClick={themeContext.toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-accent-200 hover:text-accent-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              aria-label="Toggle theme"
            >
              {themeContext.theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </header>

        <main className="flex w-full flex-1 flex-col items-center justify-center py-10">
          {renderContent()}
        </main>
      </div>

      <Toast message={toast?.message} type={toast?.type} onClose={clearToast} />
    </div>
  );
};

export default App;
