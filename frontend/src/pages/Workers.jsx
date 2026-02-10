import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineEye,
  HiOutlineSearch,
  HiOutlineUserGroup,
} from 'react-icons/hi';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { workerAPI } from '../services/workerApi';
import { formatDate, formatCurrency } from '../utils/helpers';

const ROLES = ['Welder', 'Fitter', 'Helper', 'Painter', 'Mason', 'Electrician', 'Supervisor', 'Other'];

const initialForm = {
  name: '',
  phone: '',
  role: 'Helper',
  salaryType: 'Daily',
  dailyWage: '',
  monthlySalary: '',
  overtimeRate: '',
  joiningDate: new Date().toISOString().split('T')[0],
  effectiveFrom: new Date().toISOString().split('T')[0],
};

export default function Workers() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [showModal, setShowModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, worker: null });
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkers();
  }, [search, roleFilter, statusFilter]);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const { data } = await workerAPI.getAll({
        search,
        role: roleFilter,
        status: statusFilter,
        limit: 100,
      });
      setWorkers(data.data);
    } catch (err) {
      toast.error('Failed to load workers');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingWorker(null);
    setForm(initialForm);
    setShowModal(true);
  };

  const openEditModal = (worker) => {
    setEditingWorker(worker);
    setForm({
      name: worker.name,
      phone: worker.phone || '',
      role: worker.role,
      salaryType: worker.salaryType,
      dailyWage: worker.dailyWage || '',
      monthlySalary: worker.monthlySalary || '',
      overtimeRate: worker.overtimeRate || '',
      joiningDate: worker.joiningDate
        ? new Date(worker.joiningDate).toISOString().split('T')[0]
        : '',
      effectiveFrom: new Date().toISOString().split('T')[0],
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...form,
        dailyWage: Number(form.dailyWage) || 0,
        monthlySalary: Number(form.monthlySalary) || 0,
        overtimeRate: Number(form.overtimeRate) || 0,
      };

      if (editingWorker) {
        // Include effectiveFrom for rate change tracking
        payload.effectiveFrom = form.effectiveFrom;
        await workerAPI.update(editingWorker._id, payload);
        toast.success('Worker updated');
      } else {
        // Remove effectiveFrom for new workers (uses joiningDate)
        delete payload.effectiveFrom;
        await workerAPI.create(payload);
        toast.success('Worker added');
      }
      setShowModal(false);
      fetchWorkers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error saving worker');
    } finally {
      setSaving(false);
    }
  };

  const openToggleConfirm = (worker) => {
    setConfirmDialog({ open: true, worker });
  };

  const handleToggleStatus = async () => {
    const worker = confirmDialog.worker;
    if (!worker) return;
    try {
      await workerAPI.toggleStatus(worker._id);
      toast.success(`${worker.name} ${worker.isActive ? 'deactivated' : 'activated'}`);
      fetchWorkers();
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setConfirmDialog({ open: false, worker: null });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Workers</h1>
          <p className="text-sm text-gray-500 mt-1">{workers.length} workers found</p>
        </div>
        <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
          <HiOutlinePlus className="w-5 h-5" /> Add Worker
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="input w-full sm:w-40"
        >
          <option value="">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input w-full sm:w-36"
        >
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="">All</option>
        </select>
      </div>

      {/* Workers List */}
      {loading ? (
        <Loader />
      ) : workers.length === 0 ? (
        <EmptyState
          icon={HiOutlineUserGroup}
          title="No workers found"
          description="Add your first worker to get started"
          action={
            <button onClick={openAddModal} className="btn-primary">
              Add Worker
            </button>
          }
        />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {workers.map((w) => (
              <div key={w._id} className={`card !p-3 ${!w.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1" onClick={() => navigate(`/workers/${w._id}`)}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-200 truncate">{w.name}</p>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        w.isActive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
                      }`}>
                        {w.isActive ? 'Active' : 'Off'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{w.phone || 'No phone'}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-400/10 text-primary-400">{w.role}</span>
                    <p className="text-sm font-semibold text-gray-200 mt-1">
                      {w.salaryType === 'Daily' ? `${formatCurrency(w.dailyWage)}/day` : `${formatCurrency(w.monthlySalary)}/mo`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-dark-border">
                  <button
                    onClick={() => navigate(`/workers/${w._id}`)}
                    className="flex-1 text-center py-2 rounded-lg text-xs font-medium bg-primary-500/10 text-primary-400 active:bg-primary-500/20"
                  >
                    <HiOutlineEye className="w-3.5 h-3.5 inline mr-1" /> View
                  </button>
                  <button
                    onClick={() => openEditModal(w)}
                    className="flex-1 text-center py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 active:bg-amber-500/20"
                  >
                    <HiOutlinePencil className="w-3.5 h-3.5 inline mr-1" /> Edit
                  </button>
                  <button
                    onClick={() => openToggleConfirm(w)}
                    className={`flex-1 text-center py-2 rounded-lg text-xs font-medium ${
                      w.isActive
                        ? 'bg-red-500/10 text-red-400 active:bg-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 active:bg-emerald-500/20'
                    }`}
                  >
                    {w.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="overflow-x-auto hidden lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Phone</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Role</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Salary Type</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Rate</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-border">
                {workers.map((w) => (
                  <tr key={w._id} className="hover:bg-dark-hover transition-colors">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-gray-200">{w.name}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">{w.phone || '-'}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-400/10 text-primary-400">
                        {w.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-400">{w.salaryType}</td>
                    <td className="py-3 px-4 text-sm text-gray-200 text-right font-medium">
                      {w.salaryType === 'Daily'
                        ? formatCurrency(w.dailyWage) + '/day'
                        : formatCurrency(w.monthlySalary) + '/mo'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          w.isActive
                            ? 'bg-emerald-400/10 text-emerald-400'
                            : 'bg-red-400/10 text-red-400'
                        }`}
                      >
                        {w.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigate(`/workers/${w._id}`)}
                          className="p-1.5 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-primary-400 transition-colors"
                          title="View"
                        >
                          <HiOutlineEye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(w)}
                          className="p-1.5 rounded-lg hover:bg-dark-hover text-gray-400 hover:text-amber-400 transition-colors"
                          title="Edit"
                        >
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openToggleConfirm(w)}
                          className={`text-xs px-2 py-1 rounded-lg border transition-colors ${
                            w.isActive
                              ? 'border-red-500/30 text-red-400 hover:bg-red-400/10'
                              : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-400/10'
                          }`}
                        >
                          {w.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingWorker ? 'Edit Worker' : 'Add Worker'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Phone</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="input w-full"
                required
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Salary Type *</label>
              <select
                value={form.salaryType}
                onChange={(e) => setForm({ ...form, salaryType: e.target.value })}
                className="input w-full"
                required
              >
                <option value="Daily">Daily</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
            {form.salaryType === 'Daily' ? (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Daily Wage (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={form.dailyWage}
                  onChange={(e) => setForm({ ...form, dailyWage: e.target.value })}
                  className="input w-full"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Monthly Salary (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={form.monthlySalary}
                  onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })}
                  className="input w-full"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Overtime Rate (₹/hr)</label>
              <input
                type="number"
                min="0"
                value={form.overtimeRate}
                onChange={(e) => setForm({ ...form, overtimeRate: e.target.value })}
                className="input w-full"
              />
            </div>
            {editingWorker && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Rate Effective From *</label>
                <input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  className="input w-full"
                  required
                />
                <p className="text-[10px] text-amber-400 mt-1">Rate changes will apply from this date onward</p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Joining Date</label>
              <input
                type="date"
                value={form.joiningDate}
                onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
                className="input w-full"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-border">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving...' : editingWorker ? 'Update' : 'Add Worker'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm status toggle */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog({ open: false, worker: null })}
        onConfirm={handleToggleStatus}
        title={confirmDialog.worker?.isActive ? 'Deactivate Worker?' : 'Activate Worker?'}
        message={
          confirmDialog.worker?.isActive
            ? `"${confirmDialog.worker?.name}" will be marked inactive and won't appear in attendance or salary.`
            : `"${confirmDialog.worker?.name}" will be marked active again.`
        }
        confirmText={confirmDialog.worker?.isActive ? 'Deactivate' : 'Activate'}
        variant={confirmDialog.worker?.isActive ? 'danger' : 'success'}
      />
    </div>
  );
}
