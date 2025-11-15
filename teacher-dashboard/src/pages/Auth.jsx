import { Tab } from '@headlessui/react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { GraduationCap, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../components/Toast.jsx';

const initialSignup = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  classId: '',
  department: ''
};

const Auth = () => {
  const { user, login, signup } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signupForm, setSignupForm] = useState(initialSignup);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });

  if (user) {
    return <Navigate to="/dashboard/home" replace />;
  }

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await login(loginForm.email.trim().toLowerCase(), loginForm.password.trim());
      showToast({ title: 'Welcome back', description: 'Authentication succeeded', tone: 'success' });
      navigate('/dashboard/home');
    } catch (error) {
      showToast({ title: 'Login failed', description: error.message, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignup = async (event) => {
    event.preventDefault();
    if (signupForm.password !== signupForm.confirmPassword) {
      showToast({ title: 'Passwords do not match', tone: 'error' });
      return;
    }
    setIsSubmitting(true);
    try {
      await signup({
        email: signupForm.email.trim().toLowerCase(),
        password: signupForm.password.trim(),
        name: signupForm.name.trim(),
        classId: signupForm.classId.trim(),
        department: signupForm.department.trim()
      });
      showToast({ title: 'Account created', description: 'You can now manage attendance', tone: 'success' });
      navigate('/dashboard/home');
    } catch (error) {
      showToast({ title: 'Signup failed', description: error.message, tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.18),_transparent_60%)] px-4">
      <div className="w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/70 shadow-2xl shadow-primary-500/10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,_0.9fr]">
          <div className="p-10">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-primary-400">SEST Platform</p>
                <h1 className="font-display text-2xl font-semibold text-white">Teacher Dashboard</h1>
              </div>
            </div>
            <Tab.Group>
              <Tab.List className="mb-8 grid grid-cols-2 gap-2 rounded-xl bg-slate-900/70 p-1">
                {['Login', 'Sign Up'].map((tab) => (
                  <Tab
                    key={tab}
                    className={({ selected }) =>
                      `rounded-lg px-4 py-2 text-sm font-medium transition ${
                        selected
                          ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                          : 'text-slate-400 hover:text-slate-200'
                      }`
                    }
                  >
                    {tab}
                  </Tab>
                ))}
              </Tab.List>
              <Tab.Panels>
                <Tab.Panel>
                  <form className="space-y-5" onSubmit={handleLogin}>
                    <div>
                      <label className="label" htmlFor="login-email">Email</label>
                      <input
                        id="login-email"
                        type="email"
                        required
                        className="input"
                        value={loginForm.email}
                        onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="login-password">Password</label>
                      <input
                        id="login-password"
                        type="password"
                        required
                        className="input"
                        value={loginForm.password}
                        onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Login'}
                    </button>
                  </form>
                </Tab.Panel>
                <Tab.Panel>
                  <form className="grid grid-cols-1 gap-5" onSubmit={handleSignup}>
                    <div className="grid gap-1.5">
                      <label className="label" htmlFor="signup-name">Full Name</label>
                      <input
                        id="signup-name"
                        type="text"
                        required
                        className="input"
                        value={signupForm.name}
                        onChange={(event) => setSignupForm((prev) => ({ ...prev, name: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="label" htmlFor="signup-email">University Email</label>
                      <input
                        id="signup-email"
                        type="email"
                        required
                        className="input"
                        value={signupForm.email}
                        onChange={(event) => setSignupForm((prev) => ({ ...prev, email: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="label" htmlFor="signup-class">Class ID</label>
                      <input
                        id="signup-class"
                        type="text"
                        required
                        className="input"
                        value={signupForm.classId}
                        onChange={(event) => setSignupForm((prev) => ({ ...prev, classId: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="label" htmlFor="signup-department">Department</label>
                      <input
                        id="signup-department"
                        type="text"
                        required
                        className="input"
                        value={signupForm.department}
                        onChange={(event) => setSignupForm((prev) => ({ ...prev, department: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="label" htmlFor="signup-password">Password</label>
                      <input
                        id="signup-password"
                        type="password"
                        required
                        className="input"
                        value={signupForm.password}
                        onChange={(event) => setSignupForm((prev) => ({ ...prev, password: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <label className="label" htmlFor="signup-confirm">Confirm Password</label>
                      <input
                        id="signup-confirm"
                        type="password"
                        required
                        className="input"
                        value={signupForm.confirmPassword}
                        onChange={(event) => setSignupForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
                      />
                    </div>
                    <button type="submit" className="btn btn-secondary w-full" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
                    </button>
                  </form>
                </Tab.Panel>
              </Tab.Panels>
            </Tab.Group>
          </div>
          <div className="hidden flex-col justify-between border-l border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 p-10 text-slate-200 lg:flex">
            <div>
              <h2 className="text-3xl font-bold">Keep your classes synchronized</h2>
              <p className="mt-4 text-sm text-slate-400">
                Secure attendance workflows, live code generation, and records designed for modern universities.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900/60 p-6 shadow-xl ring-1 ring-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">Live snapshot</p>
              <div className="mt-4 space-y-2">
                <p className="text-lg font-semibold">Next session: MT-101</p>
                <p className="text-sm text-slate-400">Sustainability Engineering • 12:00 - 13:00</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
