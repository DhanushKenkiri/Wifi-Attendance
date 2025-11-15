import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock4, Loader2, Pencil, Plus, Trash } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { useToast } from '../components/Toast.jsx';
import { apiRequest } from '../api/client.js';

const blankForm = {
  subject: '',
  day: 'monday',
  start_time: '',
  end_time: '',
  credits: 1
};

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

const Timetable = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const classId = useMemo(() => user?.classId ?? null, [user?.classId]);

  const refreshEntries = useCallback(async () => {
    if (!classId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest('/api/timetable');
      setEntries(response.entries ?? []);
    } catch (error) {
      if (error.status === 401) {
        showToast({ title: 'Session expired', description: 'Please sign in again.', tone: 'error' });
        await logout();
      } else {
        showToast({ title: 'Unable to load timetable', description: error.message, tone: 'error' });
      }
    } finally {
      setLoading(false);
    }
  }, [classId, logout, showToast]);

  useEffect(() => {
    refreshEntries();
  }, [refreshEntries]);

  const openModal = (entry = null) => {
    if (entry) {
      setForm({
        subject: entry.subject,
        day: entry.day,
        start_time: entry.start_time,
        end_time: entry.end_time,
        credits: entry.credits
      });
      setEditingId(entry.id);
    } else {
      setForm(blankForm);
      setEditingId(null);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setForm(blankForm);
    setEditingId(null);
    setSaving(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        subject: form.subject,
        day: form.day,
        start_time: form.start_time,
        end_time: form.end_time,
        credits: Number(form.credits)
      };
      if (editingId === null) {
        await apiRequest('/api/timetable', {
          method: 'POST',
          data: payload
        });
        await refreshEntries();
        showToast({ title: 'Timetable entry added', tone: 'success' });
      } else {
        await apiRequest(`/api/timetable/${editingId}`, {
          method: 'PUT',
          data: payload
        });
        await refreshEntries();
        showToast({ title: 'Timetable entry updated', tone: 'success' });
      }
      closeModal();
    } catch (error) {
      showToast({ title: 'Unable to save timetable', description: error.message, tone: 'error' });
      setSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    try {
  await apiRequest(`/api/timetable/${entry.id}`, { method: 'DELETE' });
      await refreshEntries();
      showToast({ title: 'Entry removed', tone: 'success' });
    } catch (error) {
      showToast({ title: 'Could not remove entry', description: error.message, tone: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Organize your sessions</p>
          <h2 className="text-xl font-semibold">Weekly timetable</h2>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => openModal()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Timetable
        </button>
      </div>
      {loading ? (
        <LoadingSpinner label="Loading timetable" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Day</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Subject</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Start</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">End</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Credits</th>
                <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">
                    No entries yet. Create your first timetable entry.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50">
                    <td className="px-4 py-3 capitalize">{entry.day}</td>
                    <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-200">{entry.subject}</td>
                    <td className="px-4 py-3">{entry.start_time}</td>
                    <td className="px-4 py-3">{entry.end_time}</td>
                    <td className="px-4 py-3">{entry.credits}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openModal(entry)}
                          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(entry)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-500 transition hover:bg-red-500/20"
                        >
                          <Trash className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Transition.Root show={modalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/70" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 translate-y-2"
                enterTo="opacity-100 translate-y-0"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-1"
              >
                <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
                  <Dialog.Title className="mb-1 flex items-center gap-2 text-lg font-semibold text-white">
                    <CalendarClock className="h-5 w-5" />
                    {editingId === null ? 'Add timetable entry' : 'Update timetable entry'}
                  </Dialog.Title>
                  <Dialog.Description className="mb-6 text-sm text-slate-400">
                    Define subject timings and credit weight for this class slot.
                  </Dialog.Description>
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                      <label className="label text-slate-300" htmlFor="subject">Subject</label>
                      <input
                        id="subject"
                        required
                        className="input"
                        value={form.subject}
                        onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="label text-slate-300" htmlFor="day">Day</label>
                        <select
                          id="day"
                          className="input"
                          value={form.day}
                          onChange={(event) => setForm((prev) => ({ ...prev, day: event.target.value }))}
                        >
                          {weekdays.map((day) => (
                            <option key={day} value={day} className="capitalize">
                              {day.charAt(0).toUpperCase() + day.slice(1)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label text-slate-300" htmlFor="credits">Credits</label>
                        <input
                          id="credits"
                          type="number"
                          min="0"
                          max="5"
                          required
                          className="input"
                          value={form.credits}
                          onChange={(event) => setForm((prev) => ({ ...prev, credits: event.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="label text-slate-300" htmlFor="start">Start time</label>
                        <input
                          id="start"
                          type="time"
                          required
                          className="input"
                          value={form.start_time}
                          onChange={(event) => setForm((prev) => ({ ...prev, start_time: event.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="label text-slate-300" htmlFor="end">End time</label>
                        <input
                          id="end"
                          type="time"
                          required
                          className="input"
                          value={form.end_time}
                          onChange={(event) => setForm((prev) => ({ ...prev, end_time: event.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="mt-6 flex justify-end gap-3">
                      <button type="button" className="btn btn-ghost" onClick={closeModal}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-secondary" disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock4 className="mr-2 h-4 w-4" />}
                        {editingId === null ? 'Create' : 'Save changes'}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </div>
  );
};

export default Timetable;
