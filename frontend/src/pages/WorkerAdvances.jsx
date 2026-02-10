import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineCurrencyRupee,
} from 'react-icons/hi';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';
import MonthYearPicker from '../components/MonthYearPicker';
import { workerAPI, workerAdvanceAPI } from '../services/workerApi';
import { formatDate, formatCurrency } from '../utils/helpers';

export default function WorkerAdvances() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [advances, setAdvances] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    worker: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
  });

  useEffect(() => {
    fetchAdvances();
  }, [month, year]);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const { data } = await workerAPI.getAll({ status: 'active', limit: 200 });
      setWorkers(data.data);
    } catch {
      // silent
    }
  };

  const fetchAdvances = async () => {
    try {
      setLoading(true);
      const { data } = await workerAdvanceAPI.getAll({ month, year, limit: 200 });
      setAdvances(data.data);
    } catch (err) {
      toast.error('Failed to load advances');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.worker || !form.amount) {
      toast.error('Worker and amount are required');
      return;
    }
    setSaving(true);
    try {
      await workerAdvanceAPI.give({
        worker: form.worker,
        amount: Number(form.amount),
        date: form.date,
        note: form.note,
      });
      toast.success('Advance recorded');
      setShowModal(false);
      setForm({ worker: '', amount: '', date: new Date().toISOString().split('T')[0], note: '' });
      fetchAdvances();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save advance');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const id = deleteConfirm.id;
    if (!id) return;
    try {
      await workerAdvanceAPI.delete(id);
      toast.success('Advance deleted');
      setDeleteConfirm({ open: false, id: null });
      fetchAdvances();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const totalAmount = advances.reduce((sum, a) => sum + a.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Worker Advances</h1>
          <p className="text-sm text-gray-500 mt-1">
            {advances.length} entries — Total: {formatCurrency(totalAmount)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <HiOutlinePlus className="w-5 h-5" /> Give Advance
          </button>
        </div>
      </div>

      {/* Advances List */}
      {loading ? (
        <Loader />
      ) : advances.length === 0 ? (
        <EmptyState
          icon={HiOutlineCurrencyRupee}
          title="No advances this month"
          description="No advance payments recorded for this period"
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {advances.map((adv) => (
              <div key={adv._id} className="card !p-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-200 truncate">{adv.worker?.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{formatDate(adv.date)}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-primary-400/10 text-primary-400">{adv.worker?.role}</span>
                    </div>
                    {adv.note && <p className="text-xs text-gray-500 mt-1 truncate">{adv.note}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-sm font-bold text-red-400">{formatCurrency(adv.amount)}</span>
                    <button
                      onClick={() => setDeleteConfirm({ open: true, id: adv._id })}
                      className="p-2 rounded-lg active:bg-red-400/10 text-gray-400 active:text-red-400 transition-colors"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {adv.givenBy?.name && (
                  <p className="text-[10px] text-gray-600 mt-1">By: {adv.givenBy.name}</p>
                )}
              </div>
            ))}
            <div className="card !p-3 bg-dark-bg border-t-2 border-dark-border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-300">Total</span>
                <span className="text-sm font-bold text-red-400">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Desktop table */}
          <div className="overflow-x-auto hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Worker</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Note</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Given By</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {advances.map((adv) => (
                  <tr key={adv._id} className="hover:bg-dark-hover transition-colors">
                    <td className="py-3 px-4 text-sm text-gray-300">{formatDate(adv.date)}</td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-gray-200">{adv.worker?.name}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary-400/10 text-primary-400">
                        {adv.worker?.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm font-semibold text-red-400 text-right">
                      {formatCurrency(adv.amount)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{adv.note || '-'}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{adv.givenBy?.name}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setDeleteConfirm({ open: true, id: adv._id })}
                        className="p-1.5 rounded-lg hover:bg-red-400/10 text-gray-400 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <HiOutlineTrash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-dark-border">
                  <td colSpan={3} className="py-3 px-4 text-sm font-semibold text-gray-300">Total</td>
                  <td className="py-3 px-4 text-sm font-bold text-red-400 text-right">{formatCurrency(totalAmount)}</td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Give Advance Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Give Advance" size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Worker *</label>
            <select
              value={form.worker}
              onChange={(e) => setForm({ ...form, worker: e.target.value })}
              className="input w-full"
              required
            >
              <option value="">Select worker...</option>
              {workers.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} ({w.role})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Amount (₹) *</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="input w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Note</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Optional reason..."
              className="input w-full"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : 'Give Advance'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Advance?"
        message="Are you sure you want to delete this advance entry? This will affect the worker's salary calculation."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
}
