import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlineSave,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineClock,
} from 'react-icons/hi';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import MonthYearPicker from '../components/MonthYearPicker';
import { attendanceAPI } from '../services/workerApi';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WorkerAttendance() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [calendarData, setCalendarData] = useState([]);
  const [totalDays, setTotalDays] = useState(30);
  const [firstDayOfWeek, setFirstDayOfWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  // Daily edit modal state
  const [editModal, setEditModal] = useState(false);
  const [editDate, setEditDate] = useState(null);
  const [dailyRecords, setDailyRecords] = useState([]);
  const [saving, setSaving] = useState(false);

  // Worker detail modal state
  const [workerModal, setWorkerModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);

  const fetchCalendar = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await attendanceAPI.getCalendar(month, year);
      setCalendarData(data.data);
      setTotalDays(data.totalDays);
      setFirstDayOfWeek(data.firstDayOfWeek);
    } catch (err) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // ─── Cell color logic (heatmap) ───────────────────────────────────
  const getCellStyle = (workerData, day) => {
    const record = workerData.days[day];
    if (!record) {
      const cellDate = new Date(year, month - 1, day);
      const td = new Date();
      td.setHours(0, 0, 0, 0);
      if (cellDate > td) {
        return 'bg-dark-card/50 border-dark-border/30 text-gray-700 cursor-default';
      }
      return 'bg-gray-800/40 border-gray-700/40 text-gray-600 hover:border-gray-500 cursor-pointer';
    }
    if (record.status === 'Present') {
      if (record.overtimeHours > 0) {
        return 'bg-emerald-500/30 border-emerald-500/50 text-emerald-300 hover:border-emerald-400 cursor-pointer';
      }
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:border-emerald-400 cursor-pointer';
    }
    if (record.status === 'Absent') {
      return 'bg-red-500/15 border-red-500/30 text-red-400 hover:border-red-400 cursor-pointer';
    }
    return 'bg-dark-hover border-dark-border text-gray-500 cursor-pointer';
  };

  const getCellContent = (workerData, day) => {
    const record = workerData.days[day];
    if (!record) return '';
    if (record.status === 'Present') {
      if (record.overtimeHours > 0) return `P+${record.overtimeHours}`;
      return 'P';
    }
    return 'A';
  };

  // ─── Click on a DAY column header → edit all workers for that day ──
  const openDayEditor = (day) => {
    const cellDate = new Date(year, month - 1, day);
    const td = new Date();
    td.setHours(0, 0, 0, 0);
    if (cellDate > td) return;

    setEditDate(day);
    const records = calendarData.map((wd) => ({
      workerId: wd.worker._id,
      name: wd.worker.name,
      role: wd.worker.role,
      status: wd.days[day]?.status || '',
      overtimeHours: wd.days[day]?.overtimeHours || 0,
      note: wd.days[day]?.note || '',
    }));
    setDailyRecords(records);
    setEditModal(true);
  };

  // ─── Click on a single cell → edit that specific worker/day ────────
  const openCellEditor = (workerData, day) => {
    const cellDate = new Date(year, month - 1, day);
    const td = new Date();
    td.setHours(0, 0, 0, 0);
    if (cellDate > td) return;

    setEditDate(day);
    setDailyRecords([
      {
        workerId: workerData.worker._id,
        name: workerData.worker.name,
        role: workerData.worker.role,
        status: workerData.days[day]?.status || '',
        overtimeHours: workerData.days[day]?.overtimeHours || 0,
        note: workerData.days[day]?.note || '',
      },
    ]);
    setEditModal(true);
  };

  // ─── Click worker name → view their month details ──────────────────
  const openWorkerDetail = (workerData) => {
    setSelectedWorker(workerData);
    setWorkerModal(true);
  };

  // ─── Bulk quick-set buttons in the editor ──────────────────────────
  const setAllStatus = (status) => {
    setDailyRecords((prev) =>
      prev.map((r) => ({
        ...r,
        status,
        overtimeHours: status === 'Absent' ? 0 : r.overtimeHours,
      }))
    );
  };

  const updateDailyRecord = (index, field, value) => {
    setDailyRecords((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // ─── Save attendance from the edit modal ───────────────────────────
  const handleSaveDay = async () => {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(editDate).padStart(2, '0')}`;
    const records = dailyRecords
      .filter((r) => r.status)
      .map((r) => ({
        worker: r.workerId,
        status: r.status,
        overtimeHours: Number(r.overtimeHours) || 0,
        note: r.note,
      }));

    if (records.length === 0) {
      toast.error('Mark at least one worker');
      return;
    }

    setSaving(true);
    try {
      await attendanceAPI.markBulk({ date: dateStr, records });
      toast.success(`Saved attendance for ${records.length} worker${records.length > 1 ? 's' : ''}`);
      setEditModal(false);
      fetchCalendar();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ─── Summary stats ────────────────────────────────────────────────
  const totalPresent = calendarData.reduce((s, w) => s + w.summary.presentDays, 0);
  const totalAbsent = calendarData.reduce((s, w) => s + w.summary.absentDays, 0);
  const totalOT = calendarData.reduce((s, w) => s + w.summary.otHours, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const formatEditDate = () => {
    if (!editDate) return '';
    return new Date(year, month - 1, editDate).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-5">
      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Attendance Calendar</h1>
          <p className="text-sm text-gray-500 mt-1">
            Click any cell to edit · Click a date header to edit the full day
          </p>
        </div>
        <MonthYearPicker
          month={month}
          year={year}
          onChange={(m, y) => { setMonth(m); setYear(y); }}
        />
      </div>

      {/* ─── Summary cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card !p-3 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary-400/10">
            <HiOutlineCheckCircle className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Workers</p>
            <p className="text-lg font-bold text-gray-100">{calendarData.length}</p>
          </div>
        </div>
        <div className="card !p-3 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-400/10">
            <HiOutlineCheckCircle className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Total Present</p>
            <p className="text-lg font-bold text-emerald-400">{totalPresent}</p>
          </div>
        </div>
        <div className="card !p-3 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-red-400/10">
            <HiOutlineXCircle className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Total Absent</p>
            <p className="text-lg font-bold text-red-400">{totalAbsent}</p>
          </div>
        </div>
        <div className="card !p-3 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-400/10">
            <HiOutlineClock className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 uppercase">Overtime Hrs</p>
            <p className="text-lg font-bold text-amber-400">{totalOT}</p>
          </div>
        </div>
      </div>

      {/* ─── Legend ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded bg-emerald-500/15 border border-emerald-500/30" />
          Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded bg-emerald-500/30 border border-emerald-500/50" />
          Present + OT
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded bg-red-500/15 border border-red-500/30" />
          Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded bg-gray-800/40 border border-gray-700/40" />
          Unmarked
        </span>
      </div>

      {/* ─── Calendar Heatmap Grid ───────────────────────────────── */}
      {loading ? (
        <Loader text="Loading calendar data..." />
      ) : calendarData.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No active workers found</p>
          <p className="text-sm mt-1">Add workers first to mark attendance</p>
        </div>
      ) : (
        <div className="card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[700px]">
              {/* ── Day number headers ── */}
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-dark-card px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase border-b border-r border-dark-border min-w-[140px]">
                    Worker
                  </th>
                  {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                    const cellDate = new Date(year, month - 1, day);
                    const dayOfWeek = cellDate.getDay();
                    const isSunday = dayOfWeek === 0;
                    const isToday =
                      cellDate.getDate() === new Date().getDate() &&
                      cellDate.getMonth() === new Date().getMonth() &&
                      cellDate.getFullYear() === new Date().getFullYear();
                    const isFuture = cellDate > today;

                    return (
                      <th
                        key={day}
                        onClick={() => !isFuture && openDayEditor(day)}
                        className={`px-0 py-1.5 text-center border-b border-dark-border select-none transition-colors min-w-[38px] ${
                          isFuture
                            ? 'text-gray-700 cursor-default'
                            : 'cursor-pointer hover:bg-dark-hover'
                        } ${isToday ? 'bg-primary-600/10' : ''}`}
                      >
                        <span className={`block text-[9px] uppercase ${isSunday ? 'text-red-400/60' : 'text-gray-600'}`}>
                          {DAY_LABELS[dayOfWeek]}
                        </span>
                        <span
                          className={`block text-sm font-bold leading-none mt-0.5 ${
                            isToday
                              ? 'text-primary-400'
                              : isSunday
                              ? 'text-red-400/80'
                              : 'text-gray-300'
                          }`}
                        >
                          {day}
                        </span>
                      </th>
                    );
                  })}
                  {/* Summary columns */}
                  <th className="px-2 py-2 text-center border-b border-l border-dark-border text-[9px] font-semibold text-emerald-400 uppercase min-w-[32px]">P</th>
                  <th className="px-2 py-2 text-center border-b border-dark-border text-[9px] font-semibold text-red-400 uppercase min-w-[32px]">A</th>
                  <th className="px-2 py-2 text-center border-b border-dark-border text-[9px] font-semibold text-amber-400 uppercase min-w-[32px]">OT</th>
                </tr>
              </thead>

              {/* ── Worker rows ── */}
              <tbody>
                {calendarData.map((wd) => (
                  <tr key={wd.worker._id} className="group">
                    {/* Worker name — sticky left */}
                    <td
                      onClick={() => openWorkerDetail(wd)}
                      className="sticky left-0 z-10 bg-dark-card group-hover:bg-dark-hover px-3 py-1.5 border-b border-r border-dark-border cursor-pointer transition-colors"
                    >
                      <p className="text-sm font-medium text-gray-200 truncate max-w-[120px]">{wd.worker.name}</p>
                      <p className="text-[10px] text-gray-600">{wd.worker.role}</p>
                    </td>

                    {/* Day cells */}
                    {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                      const cellDate = new Date(year, month - 1, day);
                      const isToday =
                        cellDate.getDate() === new Date().getDate() &&
                        cellDate.getMonth() === new Date().getMonth() &&
                        cellDate.getFullYear() === new Date().getFullYear();

                      return (
                        <td
                          key={day}
                          onClick={() => openCellEditor(wd, day)}
                          className={`px-0 py-1 text-center border-b border-dark-border/50 transition-all ${
                            isToday ? 'ring-1 ring-inset ring-primary-500/30' : ''
                          }`}
                        >
                          <div
                            className={`mx-auto w-[30px] h-[26px] rounded flex items-center justify-center text-[10px] font-bold border transition-all ${getCellStyle(
                              wd,
                              day
                            )}`}
                          >
                            {getCellContent(wd, day)}
                          </div>
                        </td>
                      );
                    })}

                    {/* Summary cells */}
                    <td className="px-2 py-1.5 text-center border-b border-l border-dark-border text-xs font-bold text-emerald-400">
                      {wd.summary.presentDays}
                    </td>
                    <td className="px-2 py-1.5 text-center border-b border-dark-border text-xs font-bold text-red-400">
                      {wd.summary.absentDays}
                    </td>
                    <td className="px-2 py-1.5 text-center border-b border-dark-border text-xs font-bold text-amber-400">
                      {wd.summary.otHours || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          EDIT MODAL — mark attendance for selected worker(s) on a day
         ═══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title={`Attendance — ${formatEditDate()}`}
        size={dailyRecords.length > 1 ? 'xl' : 'md'}
      >
        <div className="space-y-4">
          {/* Quick actions (only when editing full day) */}
          {dailyRecords.length > 1 && (
            <div className="flex flex-wrap gap-2 pb-3 border-b border-dark-border">
              <button
                onClick={() => setAllStatus('Present')}
                className="btn-secondary text-xs flex items-center gap-1"
              >
                <HiOutlineCheckCircle className="w-4 h-4 text-emerald-400" /> All Present
              </button>
              <button
                onClick={() => setAllStatus('Absent')}
                className="btn-secondary text-xs flex items-center gap-1"
              >
                <HiOutlineXCircle className="w-4 h-4 text-red-400" /> All Absent
              </button>
            </div>
          )}

          {/* Worker rows */}
          <div className="max-h-[50vh] overflow-y-auto space-y-2">
            {dailyRecords.map((rec, idx) => (
              <div
                key={rec.workerId}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border transition-colors ${
                  rec.status === 'Present'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : rec.status === 'Absent'
                    ? 'bg-red-500/5 border-red-500/20'
                    : 'bg-dark-hover border-dark-border'
                }`}
              >
                {/* Name & role */}
                <div className="min-w-[140px]">
                  <p className="text-sm font-medium text-gray-200">{rec.name}</p>
                  <p className="text-[10px] text-gray-500">{rec.role}</p>
                </div>

                {/* Status buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateDailyRecord(idx, 'status', 'Present')}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      rec.status === 'Present'
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                        : 'bg-dark-card text-gray-400 hover:text-emerald-400 border border-dark-border hover:border-emerald-500/40'
                    }`}
                  >
                    Present
                  </button>
                  <button
                    onClick={() => {
                      updateDailyRecord(idx, 'status', 'Absent');
                      updateDailyRecord(idx, 'overtimeHours', 0);
                    }}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                      rec.status === 'Absent'
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                        : 'bg-dark-card text-gray-400 hover:text-red-400 border border-dark-border hover:border-red-500/40'
                    }`}
                  >
                    Absent
                  </button>
                </div>

                {/* OT hours */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">OT hrs:</label>
                  <input
                    type="number"
                    min="0"
                    max="12"
                    step="0.5"
                    value={rec.overtimeHours}
                    onChange={(e) => updateDailyRecord(idx, 'overtimeHours', e.target.value)}
                    disabled={rec.status !== 'Present'}
                    className="input w-20 text-sm text-center disabled:opacity-30"
                  />
                </div>

                {/* Note */}
                <div className="flex-1">
                  <input
                    type="text"
                    value={rec.note}
                    onChange={(e) => updateDailyRecord(idx, 'note', e.target.value)}
                    placeholder="Note..."
                    className="input w-full text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Save */}
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
            <button onClick={() => setEditModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleSaveDay}
              disabled={saving}
              className="btn-primary flex items-center gap-2"
            >
              <HiOutlineSave className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════
          WORKER DETAIL MODAL — month summary for a single worker
         ═══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={workerModal}
        onClose={() => setWorkerModal(false)}
        title={selectedWorker ? `${selectedWorker.worker.name} — Monthly View` : ''}
        size="lg"
      >
        {selectedWorker && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-emerald-500/10">
                <p className="text-lg font-bold text-emerald-400">{selectedWorker.summary.presentDays}</p>
                <p className="text-[10px] text-gray-500 uppercase">Present</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-red-500/10">
                <p className="text-lg font-bold text-red-400">{selectedWorker.summary.absentDays}</p>
                <p className="text-[10px] text-gray-500 uppercase">Absent</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-500/10">
                <p className="text-lg font-bold text-gray-400">{selectedWorker.summary.unmarked}</p>
                <p className="text-[10px] text-gray-500 uppercase">Unmarked</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-amber-500/10">
                <p className="text-lg font-bold text-amber-400">{selectedWorker.summary.otHours}</p>
                <p className="text-[10px] text-gray-500 uppercase">OT Hrs</p>
              </div>
            </div>

            {/* Mini calendar for the worker */}
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-600 uppercase py-1">
                  {d}
                </div>
              ))}
              {/* Empty cells for offset */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {/* Day cells */}
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((day) => {
                const record = selectedWorker.days[day];
                let bgClass = 'bg-gray-800/30 text-gray-600';
                if (record) {
                  if (record.status === 'Present') {
                    bgClass =
                      record.overtimeHours > 0
                        ? 'bg-emerald-500/35 text-emerald-200'
                        : 'bg-emerald-500/18 text-emerald-300';
                  } else {
                    bgClass = 'bg-red-500/18 text-red-300';
                  }
                }
                return (
                  <div
                    key={day}
                    onClick={() => {
                      setWorkerModal(false);
                      openCellEditor(selectedWorker, day);
                    }}
                    className={`rounded-lg text-center py-2 text-xs font-semibold cursor-pointer transition-all hover:ring-1 hover:ring-gray-500 ${bgClass}`}
                    title={
                      record
                        ? `${record.status}${record.overtimeHours ? ` +${record.overtimeHours}h OT` : ''}${record.note ? ` — ${record.note}` : ''}`
                        : 'Unmarked'
                    }
                  >
                    {day}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
