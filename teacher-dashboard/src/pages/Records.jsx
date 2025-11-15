import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Download, Loader2, UserPlus } from 'lucide-react';
import { saveAs } from 'file-saver';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { useToast } from '../components/Toast.jsx';
import { apiRequest, getAuthToken, getBaseUrl } from '../api/client.js';

const Records = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [records, setRecords] = useState([]);
  const [fetching, setFetching] = useState(true);
  const hasLoadedRef = useRef(false);
  const [filters, setFilters] = useState({ date: '', subject: '', search: '' });
  const [manualForm, setManualForm] = useState({ studentId: '', studentName: '', subject: '' });
  const [savingManual, setSavingManual] = useState(false);

  const classId = useMemo(() => user?.classId ?? null, [user?.classId]);

  const fetchRecords = useCallback(async () => {
    if (!classId) {
      setRecords([]);
      setFetching(false);
      return;
    }
    if (!hasLoadedRef.current) {
      setFetching(true);
    }
    try {
      const response = await apiRequest(`/api/attendance?classId=${classId}`);
      setRecords(response.records ?? []);
      hasLoadedRef.current = true;
    } catch (error) {
      if (error.status === 401) {
        showToast({ title: 'Session expired', description: 'Please sign in again.', tone: 'error' });
        await logout();
      } else {
        showToast({ title: 'Unable to load records', description: error.message, tone: 'error' });
      }
    } finally {
      setFetching(false);
    }
  }, [classId, logout, showToast]);

  useEffect(() => {
    hasLoadedRef.current = false;
    fetchRecords();
    const interval = window.setInterval(fetchRecords, 10000);
    return () => window.clearInterval(interval);
  }, [fetchRecords]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const dateMatch = filters.date ? record.date === filters.date : true;
      const subjectMatch = filters.subject ? record.subject?.toLowerCase().includes(filters.subject.toLowerCase()) : true;
      const searchMatch = filters.search
        ? record.name?.toLowerCase().includes(filters.search.toLowerCase()) || record.studentId?.includes(filters.search.toLowerCase())
        : true;
      return dateMatch && subjectMatch && searchMatch;
    });
  }, [filters.date, filters.search, filters.subject, records]);

  const handleExport = useCallback(async () => {
    if (!classId) {
      showToast({ title: 'Class not found', tone: 'error' });
      return;
    }

    if (filteredRecords.length === 0) {
      showToast({ title: 'Nothing to export', tone: 'error' });
      return;
    }

    try {
      const baseUrl = getBaseUrl();
      const headers = new Headers();
      const token = getAuthToken();
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      const response = await fetch(`${baseUrl}/api/attendance/export?classId=${classId}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (response.status === 401) {
        showToast({ title: 'Session expired', description: 'Please sign in again.', tone: 'error' });
        await logout();
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Unable to export CSV.');
      }

      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') ?? '';
      const filenameMatch = disposition.match(/filename=(?:"|')?([^"';]+)(?:"|')?/i);
      const fallbackName = `attendance-${classId}-${Date.now()}.csv`;
      const filename = filenameMatch?.[1] ? filenameMatch[1] : fallbackName;

      saveAs(blob, filename);
      showToast({ title: 'CSV exported', tone: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Please try again.';
      showToast({ title: 'Export failed', description: message, tone: 'error' });
    }
  }, [classId, filteredRecords.length, logout, showToast]);

  const handleManualMark = async (event) => {
    event.preventDefault();
    if (!classId) {
      showToast({ title: 'Class not found', tone: 'error' });
      return;
    }
    if (!manualForm.studentId || !manualForm.studentName) {
      showToast({ title: 'Provide student details', tone: 'error' });
      return;
    }
    setSavingManual(true);
    try {
      await apiRequest('/api/attendance/manual', {
        method: 'POST',
        data: {
          classId,
          studentId: manualForm.studentId.trim().toLowerCase(),
          studentName: manualForm.studentName.trim(),
          subject: manualForm.subject.trim() || undefined
        }
      });
      setManualForm({ studentId: '', studentName: '', subject: '' });
      showToast({ title: 'Attendance marked', tone: 'success' });
      fetchRecords();
    } catch (error) {
      if (error.status === 401) {
        showToast({ title: 'Session expired', description: 'Please sign in again.', tone: 'error' });
        await logout();
      } else {
        showToast({ title: 'Could not mark attendance', description: error.message, tone: 'error' });
      }
    } finally {
      setSavingManual(false);
    }
  };

  if (fetching && !classId) {
    return <LoadingSpinner label="Loading attendance records" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[2fr,_1fr]">
        <div className="card space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              className="input max-w-[180px]"
              value={filters.date}
              onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
            />
            <input
              type="text"
              placeholder="Filter by subject"
              className="input"
              value={filters.subject}
              onChange={(event) => setFilters((prev) => ({ ...prev, subject: event.target.value }))}
            />
            <input
              type="text"
              placeholder="Search name or ID"
              className="input"
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
            <button type="button" className="btn btn-ghost" onClick={() => setFilters({ date: '', subject: '', search: '' })}>
              Clear
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Student</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Subject</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Date</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Time</th>
                  <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                      No attendance records yet.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const timeValue = record.timestamp
                      ? new Date(record.timestamp)
                      : record.markedAt
                        ? new Date(record.markedAt)
                        : null;
                    return (
                      <tr key={record.id ?? `${record.studentId}-${record.date}-${record.timestamp}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">{record.name}</div>
                        <div className="text-xs text-slate-500">{record.studentId}</div>
                      </td>
                      <td className="px-4 py-3">{record.subject || 'N/A'}</td>
                      <td className="px-4 py-3">{record.date}</td>
                      <td className="px-4 py-3">{timeValue ? format(timeValue, 'HH:mm') : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          record.manualEntry
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                        >
                          {record.manualEntry ? 'Manual' : 'Auto'}
                        </span>
                      </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card space-y-5">
          <div>
            <h3 className="text-lg font-semibold">Quick actions</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Manage manual attendance and exports.</p>
          </div>
          <form className="space-y-3" onSubmit={handleManualMark}>
            <div>
              <label className="label" htmlFor="manual-id">Student ID</label>
              <input
                id="manual-id"
                className="input"
                value={manualForm.studentId}
                onChange={(event) => setManualForm((prev) => ({ ...prev, studentId: event.target.value.trim().toLowerCase() }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="manual-name">Student name</label>
              <input
                id="manual-name"
                className="input"
                value={manualForm.studentName}
                onChange={(event) => setManualForm((prev) => ({ ...prev, studentName: event.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="manual-subject">Subject</label>
              <input
                id="manual-subject"
                className="input"
                value={manualForm.subject}
                onChange={(event) => setManualForm((prev) => ({ ...prev, subject: event.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn-secondary w-full" disabled={savingManual}>
              {savingManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Mark Present
            </button>
          </form>
          <button type="button" className="btn btn-primary w-full" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};

export default Records;
