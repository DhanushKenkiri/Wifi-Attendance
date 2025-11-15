import { Navigate, Route, Routes } from 'react-router-dom';
import Auth from './pages/Auth.jsx';
import Home from './pages/Home.jsx';
import Timetable from './pages/Timetable.jsx';
import StudentManagement from './pages/StudentManagement.jsx';
import Records from './pages/Records.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import { ToastProvider } from './components/Toast.jsx';

const App = () => (
  <ToastProvider>
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard/home" replace />} />
      <Route path="/auth" element={<Auth />} />
      <Route
        path="/dashboard"
        element={(
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        )}
      >
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<Home />} />
  <Route path="timetable" element={<Timetable />} />
  <Route path="students" element={<StudentManagement />} />
        <Route path="records" element={<Records />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard/home" replace />} />
    </Routes>
  </ToastProvider>
);

export default App;
