import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSuppliers, createSupplier, updateSupplier, paySupplier } from '../services/stockApi';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Loader from '../components/Loader';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineCreditCard } from 'react-icons/hi';

const defaultForm = { name: '', phone: '', address: '', openingBalance: '0', notes: '', isActive: true };

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
  const [paySupplierObj, setPaySupplierObj] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [payConfirm, setPayConfirm] = useState(false);

  const fetchSuppliers = async () => {
    try {
      const params = {};
      if (search) params.search = search;
      const { data } = await getSuppliers(params);
      setSuppliers(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, [search]);

  const openCreate = () => {
    setForm(defaultForm);
    setEditingId(null);
    setModalOpen(true);
  };

  const openEdit = (s) => {
    setForm({
      name: s.name,
      phone: s.phone || '',
      address: s.address || '',
      openingBalance: s.openingBalance?.toString() || '0',
      notes: s.notes || '',
      isActive: s.isActive,
    });
    setEditingId(s._id);
    setModalOpen(true);
  };

  const openPay = (s) => {
    setPaySupplierObj(s);
    setPayForm({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
    setPayOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, openingBalance: parseFloat(form.openingBalance) || 0 };
      if (editingId) {
        await updateSupplier(editingId, payload);
        toast.success('Supplier updated');
      } else {
        await createSupplier(payload);
        toast.success('Supplier created');
      }
      setModalOpen(false);
      setLoading(true);
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayConfirm = async () => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    setSubmitting(true);
    try {
      await paySupplier(paySupplierObj._id, {
        amount: amt,
        mode: payForm.mode,
        referenceNumber: payForm.referenceNumber,
        notes: payForm.notes,
      });
      toast.success('Payment recorded');
      setPayConfirm(false);
      setPayOpen(false);
      setLoading(true);
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Suppliers</h1>
          <p className="text-xs text-gray-500">Manage supplier accounts & payments</p>
        </div>
        <button onClick={openCreate} className="btn-primary !py-2 !px-4 text-sm">
          <HiOutlinePlus className="w-4 h-4" /> Add
        </button>
      </div>

      <input className="input max-w-sm" placeholder="Search suppliers..." value={search} onChange={(e) => setSearch(e.target.value)} />

      {loading ? <Loader /> : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {suppliers.map((s) => (
              <div key={s._id} className={`card !p-3 ${!s.isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <Link to={`/suppliers/${s._id}/ledger`} className="text-sm font-semibold text-primary-400 hover:text-primary-300">
                      {s.name}
                    </Link>
                    {s.phone && <p className="text-xs text-gray-500">{s.phone}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openPay(s)} className="text-emerald-400 hover:text-emerald-300 p-1" title="Pay supplier">
                      <HiOutlineCreditCard className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-gray-200 p-1">
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Purchased</span>
                    <span className="text-sm font-semibold text-gray-200">{formatCurrency(s.totalPurchased)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">Paid</span>
                    <span className="text-sm font-semibold text-emerald-400">{formatCurrency(s.totalPaid)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 uppercase block">{s.advanceBalance > 0 ? 'Advance' : 'Due'}</span>
                    <span className={`text-sm font-bold ${s.currentDue > 0 ? 'text-red-400' : s.advanceBalance > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                      {s.advanceBalance > 0 ? formatCurrency(s.advanceBalance) : formatCurrency(s.currentDue)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="table-container hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Phone</th>
                  <th>Total Purchased</th>
                  <th>Total Paid</th>
                  <th>Due</th>
                  <th>Advance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s._id} className={!s.isActive ? 'opacity-50' : ''}>
                    <td>
                      <Link to={`/suppliers/${s._id}/ledger`} className="text-primary-400 hover:text-primary-300 font-medium">
                        {s.name}
                      </Link>
                    </td>
                    <td className="text-gray-400">{s.phone || '-'}</td>
                    <td className="font-semibold">{formatCurrency(s.totalPurchased)}</td>
                    <td className="text-emerald-400">{formatCurrency(s.totalPaid)}</td>
                    <td className={s.currentDue > 0 ? 'text-red-400 font-bold' : ''}>{formatCurrency(s.currentDue)}</td>
                    <td className={s.advanceBalance > 0 ? 'text-emerald-400 font-bold' : ''}>{formatCurrency(s.advanceBalance)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openPay(s)} className="text-emerald-400 hover:text-emerald-300 p-1" title="Pay supplier">
                          <HiOutlineCreditCard className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-gray-200 p-1" title="Edit">
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {suppliers.length === 0 && <p className="text-center text-gray-500 py-8">No suppliers found.</p>}
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Edit Supplier' : 'New Supplier'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Supplier Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Steel Traders" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <label className="label">{editingId ? 'Opening Balance' : 'Opening Balance (₹)'}</label>
              <input type="number" step="0.01" className="input" value={form.openingBalance} onChange={(e) => setForm({ ...form, openingBalance: e.target.value })} placeholder="0" />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input" rows="2" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </div>
          {editingId && (
            <div className="flex items-center gap-2">
              <input type="checkbox" id="supActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-4 h-4 rounded" />
              <label htmlFor="supActive" className="text-sm text-gray-400">Active</label>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto justify-center">
              {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal */}
      <Modal isOpen={payOpen} onClose={() => setPayOpen(false)} title="Pay Supplier">
        {paySupplierObj && (
          <div className="space-y-4">
            <div className="bg-dark-bg rounded-lg p-3 border border-dark-border">
              <p className="text-sm text-gray-400">Supplier: <span className="text-gray-100 font-semibold">{paySupplierObj.name}</span></p>
              <p className="text-sm text-gray-400 mt-1">
                Due: <span className={`font-bold ${paySupplierObj.currentDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(paySupplierObj.currentDue)}</span>
                {paySupplierObj.advanceBalance > 0 && <span className="ml-2">Advance: <span className="text-emerald-400 font-bold">{formatCurrency(paySupplierObj.advanceBalance)}</span></span>}
              </p>
            </div>
            <div>
              <label className="label">Amount (₹) *</label>
              <input type="number" step="0.01" className="input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Enter amount" autoFocus />
            </div>
            <div>
              <label className="label">Payment Mode</label>
              <select className="select" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                <option value="Cash">Cash</option>
                <option value="UPI">UPI</option>
                <option value="Bank">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="label">Reference #</label>
              <input className="input" value={payForm.referenceNumber} onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows="2" value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
              <button type="button" onClick={() => setPayOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
              <button
                type="button"
                disabled={!payForm.amount || parseFloat(payForm.amount) <= 0}
                onClick={() => setPayConfirm(true)}
                className="btn-success w-full sm:w-auto justify-center"
              >
                Pay {payForm.amount ? formatCurrency(parseFloat(payForm.amount)) : ''}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={payConfirm}
        onClose={() => setPayConfirm(false)}
        onConfirm={handlePayConfirm}
        title="Confirm Supplier Payment"
        message={paySupplierObj ? `Pay ${formatCurrency(parseFloat(payForm.amount) || 0)} to "${paySupplierObj.name}" via ${payForm.mode}?` : ''}
        confirmText="Confirm Payment"
        variant="info"
        loading={submitting}
      />
    </div>
  );
}
