import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users, UserPlus } from 'lucide-react';
import { useToast } from '../components/Toast.jsx';
import { apiRequest } from '../api/client.js';

const DEFAULT_PASSWORD = 'sest@2024';

const initialForm = {
  studentId: '',
  name: '',
  email: '',
  department: '',
  batch: ''
};

const StudentManagement = () => {
  const { showToast } = useToast();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [defaultPassword, setDefaultPassword] = useState(DEFAULT_PASSWORD);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest('/api/students');
      setStudents(response.students ?? []);
      if (response.defaultPassword) {
        setDefaultPassword(response.defaultPassword);
      }
    } catch (error) {
      showToast({ title: 'Unable to load students', description: error.message, tone: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => a.studentId.localeCompare(b.studentId));
  }, [students]);

  const handleChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedId = form.studentId.trim().toLowerCase();
    const trimmedName = form.name.trim();
    if (!trimmedId || !trimmedName) {
      showToast({ title: 'Provide student details', tone: 'error' });
      return;
    }

    setSaving(true);
    try {
      await apiRequest('/api/students', {
        method: 'POST',
        data: {
          studentId: trimmedId,
          name: trimmedName,
          email: form.email.trim() || undefined,
          department: form.department.trim() || undefined,
          batch: form.batch.trim() || undefined,
          // password is enforced in the backend, this is included for clarity
          password: defaultPassword
        }
      });
      showToast({ title: 'Student registered', description: `Password defaults to ${defaultPassword}`, tone: 'success' });
      setForm(initialForm);
      await fetchStudents();
    } catch (error) {
      showToast({ title: 'Unable to register student', description: error.message, tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Student Management</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Maintain your class roster. Every student shares the password <span className="font-semibold text-primary-600 dark:text-primary-400">{defaultPassword}</span> for captive portal login.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-900/40 dark:text-primary-200">
            <Users className="h-4 w-4" />
            <span>{sortedStudents.length} enrolled</span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold">Add a student</h3>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          This is typically a one-time setup at the start of the semester.
        </p>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-1">
            <label className="label" htmlFor="student-id">Student roll number</label>
            <input
              id="student-id"
              className="input"
              placeholder="24etim16"
              value={form.studentId}
              onChange={handleChange('studentId')}
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="label" htmlFor="student-name">Full name</label>
            <input
              id="student-name"
              className="input"
              placeholder="Dhanush Kumar"
              value={form.name}
              onChange={handleChange('name')}
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="label" htmlFor="student-email">Email (optional)</label>
            <input
              id="student-email"
              className="input"
              placeholder="student@example.edu"
              value={form.email}
              onChange={handleChange('email')}
              type="email"
            />
          </div>
          <div className="md:col-span-1">
            <label className="label" htmlFor="student-dept">Department</label>
            <input
              id="student-dept"
              className="input"
              placeholder="CSE"
              value={form.department}
              onChange={handleChange('department')}
            />
          </div>
          <div className="md:col-span-1">
            <label className="label" htmlFor="student-batch">Batch</label>
            <input
              id="student-batch"
              className="input"
              placeholder="2024"
              value={form.batch}
              onChange={handleChange('batch')}
            />
          </div>
          <div className="md:col-span-1">
            <label className="label">Portal password</label>
            <div className="flex h-10 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
              <span>{defaultPassword}</span>
              <span className="text-xs text-slate-500">Applied automatically</span>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-secondary md:col-span-2"
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}Register student
          </button>
        </form>
      </div>

      <div className="card">
        <h3 className="mb-4 text-lg font-semibold">Current roster</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading students...
          </div>
        ) : sortedStudents.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No students registered yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Roll number</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Name</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Department</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Batch</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {sortedStudents.map((student) => (
                  <tr key={student.studentId} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/60">
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{student.studentId}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{student.name || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{student.department || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{student.batch || '—'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{student.email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentManagement;
