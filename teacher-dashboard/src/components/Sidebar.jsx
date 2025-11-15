import { useAuth } from '../context/AuthContext.jsx';
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  BookOpenCheck,
  CalendarClock,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Users
} from 'lucide-react';
import ThemeToggle from './ThemeToggle.jsx';

const navLinks = [
  { to: '/dashboard/home', label: 'Home', icon: Home },
  { to: '/dashboard/timetable', label: 'Timetable', icon: CalendarClock },
  { to: '/dashboard/students', label: 'Student Management', icon: Users },
  { to: '/dashboard/records', label: 'Records', icon: BookOpenCheck }
];

const Sidebar = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      <button
        type="button"
        className="fixed left-4 top-4 z-40 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 lg:hidden"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Menu className="h-5 w-5" />
      </button>
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-slate-200 bg-slate-50/90 px-4 py-6 shadow-lg backdrop-blur transition-transform dark:border-slate-800 dark:bg-slate-950/70 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Link to="/dashboard/home" className="mb-8 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">SEST</p>
            <p className="font-display text-lg font-semibold">Teacher Dashboard</p>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <NavLink
                key={to}
                to={to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900/70'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            );
          })}
        </nav>
        <div className="flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Signed in as</p>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {user?.name || user?.email}
              </p>
            </div>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn-ghost"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
