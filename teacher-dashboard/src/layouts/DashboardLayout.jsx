import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar.jsx';
import Navbar from '../components/Navbar.jsx';

const titles = {
  '/dashboard/home': {
    title: 'Attendance Control Center',
    subtitle: 'Generate secure codes and monitor live sessions'
  },
  '/dashboard/timetable': {
    title: 'Timetable Manager',
    subtitle: 'Create and update your weekly teaching schedule'
  },
  '/dashboard/students': {
    title: 'Student Management',
    subtitle: 'Maintain your roster and keep credentials aligned'
  },
  '/dashboard/records': {
    title: 'Attendance Records',
    subtitle: 'Audit attendance logs and export data when needed'
  }
};

const DashboardLayout = () => {
  const location = useLocation();
  const { title, subtitle } = titles[location.pathname] || titles['/dashboard/home'];

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <div className="lg:pl-72">
        <Navbar title={title} subtitle={subtitle} />
        <main className="space-y-6 px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
