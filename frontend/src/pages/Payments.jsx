import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import { formatCurrency, formatDateTime, formatDate, debounce } from '../utils/helpers';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch, HiOutlineCash } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [modeFilter, setModeFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Add / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ customer: '', amount: '', mode: 'Cash', referenceNumber: '', notes: '', lessAmount: '' });
  const [submitting, setSubmitting] = useState(false);

  // Customer search
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Less confirmation
  const [lessConfirm, setLessConfirm] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (modeFilter) params.mode = modeFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const { data } = await api.get('/payments', { params });
      setPayments(data.data);
      setTotalPages(data.totalPages);
      setTotalCount(data.total || 0);
      setTotalAmount(data.totalAmount || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, [page, modeFilter, startDate, endDate]);

  // Customer search with debounce
  const searchCustomers = useCallback(
    debounce(async (q) => {
      if (!q || q.length < 2) { setCustResults([]); return; }
      try {
        const { data } = await api.get('/customers', { params: { search: q } });
        setCustResults(data.data || []);
        setShowDropdown(true);
      } catch { setCustResults([]); }
    }, 300),
    []
  );

  const handleCustSearch = (val) => {
    setCustSearch(val);
    if (!val) { setSelectedCustomer(null); setShowDropdown(false); }
    searchCustomers(val);
  };

  const selectCustomer = (c) => {
    setSelectedCustomer(c);
    setCustSearch(c.name);
    setForm((f) => ({ ...f, customer: c._id }));
    setShowDropdown(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ customer: '', amount: '', mode: 'Cash', referenceNumber: '', notes: '', lessAmount: '' });
    setCustSearch('');
    setSelectedCustomer(null);
    setModalOpen(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      customer: p.customer?._id || '',
      amount: p.amount.toString(),
      mode: p.mode,
      referenceNumber: p.referenceNumber || '',
      notes: p.notes || '',
      lessAmount: p.lessAmount ? p.lessAmount.toString() : '',
    });
    setSelectedCustomer(p.customer);
    setCustSearch(p.customer?.name || '');
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const amt = parseFloat(form.amount) || 0;
    const lessAmt = parseFloat(form.lessAmount) || 0;
    if (amt <= 0 && lessAmt <= 0) { toast.error('Enter payment or less amount'); return; }

    if (!editing && !form.customer) { toast.error('Select a customer'); return; }

    // Show confirmation if less amount is entered
    if (lessAmt > 0) {
      setLessConfirm(true);
      return;
    }

    await actualSubmit();
  };

  const actualSubmit = async () => {
    const amt = parseFloat(form.amount) || 0;
    const lessAmt = parseFloat(form.lessAmount) || 0;
    setLessConfirm(false);
    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/payments/${editing._id}`, {
          customer: form.customer,
          amount: amt,
          mode: form.mode,
          referenceNumber: form.referenceNumber,
          notes: form.notes,
          lessAmount: lessAmt,
        });
        toast.success('Payment updated');
      } else {
        await api.post('/payments', {
          customer: form.customer,
          amount: amt,
          mode: form.mode,
          referenceNumber: form.referenceNumber,
          notes: form.notes,
          lessAmount: lessAmt,
        });
        toast.success(lessAmt > 0 ? `Payment recorded with ₹${lessAmt.toLocaleString('en-IN')} less` : 'Payment recorded');
      }
      setModalOpen(false);
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setSubmitting(true);
    try {
      await api.delete(`/payments/${deleteConfirm._id}`);
      toast.success('Payment deleted');
      setDeleteConfirm(null);
      fetchPayments();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Payments</h1>
          <p className="text-xs text-gray-500">All customer payment records</p>
        </div>
        <button onClick={openAdd} className="btn-success !py-2 !px-4 text-sm">
          <HiOutlinePlus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total Records</p>
          <p className="text-lg font-bold text-gray-100">{totalCount}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total Collected</p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1.5 flex-wrap flex-1 min-w-[200px]">
            {['', 'Cash', 'UPI', 'Bank', 'Cheque'].map((mode) => (
              <button
                key={mode}
                onClick={() => { setModeFilter(mode); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  modeFilter === mode ? 'bg-primary-600 text-white' : 'bg-dark-bg text-gray-400 hover:bg-dark-hover border border-dark-border'
                }`}
              >
                {mode || 'All'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="date" className="input !py-1.5 text-xs !w-auto" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
            <span className="text-gray-500 text-xs">to</span>
            <input type="date" className="input !py-1.5 text-xs !w-auto" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }} className="text-xs text-red-400 hover:text-red-300">Clear</button>
            )}
          </div>
        </div>
      </div>

      {loading ? <Loader /> : (
        <>
          {payments.length === 0 ? (
            <div className="card !p-8 text-center">
              <HiOutlineCash className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No payments found</p>
              <p className="text-xs text-gray-500 mt-1">Try adjusting filters or record a new payment</p>
            </div>
          ) : (
          <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {payments.map((p) => (
              <div key={p._id} className="card !p-3">
                <div className="flex items-center justify-between">
                  <Link to={`/customers/${p.customer?._id}/ledger`} className="text-gray-200 font-medium text-sm hover:text-primary-400 truncate max-w-[60%]">
                    {p.customer?.name}
                  </Link>
                  <span className="text-emerald-400 font-bold text-sm">{formatCurrency(p.amount)}</span>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex items-center gap-2">
                    <span className="badge-info text-[10px]">{p.mode}</span>
                    {p.lessAmount > 0 && <span className="badge-warning text-[10px]">Less {formatCurrency(p.lessAmount)}</span>}
                    {p.referenceNumber && <span className="text-xs text-gray-500">Ref: {p.referenceNumber}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(p)} className="text-gray-500 hover:text-gray-200 p-1"><HiOutlinePencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteConfirm(p)} className="text-gray-500 hover:text-red-400 p-1"><HiOutlineTrash className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
                  <span>{formatDate(p.createdAt)}</span>
                  <span>{p.receivedBy?.name}</span>
                </div>
                {p.notes && <p className="text-[10px] text-gray-600 mt-1 italic">{p.notes}</p>}
              </div>
            ))}
          </div>
          {/* Desktop table */}
          <div className="table-container hidden lg:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th>Received By</th>
                  <th className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td className="text-xs whitespace-nowrap">{formatDate(p.createdAt)}</td>
                    <td>
                      <Link to={`/customers/${p.customer?._id}/ledger`} className="text-gray-200 hover:text-primary-400 font-medium">
                        {p.customer?.name}
                      </Link>
                    </td>
                    <td className="text-emerald-400 font-bold">{formatCurrency(p.amount)}</td>
                    <td><span className="badge-info">{p.mode}</span>{p.lessAmount > 0 && <span className="badge-warning ml-1">Less {formatCurrency(p.lessAmount)}</span>}</td>
                    <td className="text-gray-500 text-xs">{p.referenceNumber || '-'}</td>
                    <td className="text-gray-500 text-xs max-w-[150px] truncate">{p.notes || '-'}</td>
                    <td className="text-gray-500 text-xs">{p.receivedBy?.name}</td>
                    <td>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(p)} className="text-gray-500 hover:text-gray-200 p-1 rounded hover:bg-dark-hover" title="Edit">
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(p)} className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-dark-hover" title="Delete">
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
          </>
          )}
        </>
      )}

      {/* Add / Edit Payment Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Payment' : 'Record Payment'}>
        <div className="space-y-4">
          {/* Customer search */}
          <div className="relative">
            <label className="label">Customer *</label>
            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                className="input !pl-9"
                value={custSearch}
                onChange={(e) => handleCustSearch(e.target.value)}
                placeholder="Search customer by name or phone..."
                autoFocus={!editing}
              />
            </div>
            {showDropdown && custResults.length > 0 && (
              <div className="absolute z-20 mt-1 w-full bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {custResults.map((c) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-4 py-2 hover:bg-dark-hover text-sm"
                  >
                    <span className="text-gray-200 font-medium">{c.name}</span>
                    <span className="text-gray-500 ml-2">📱 {c.phone}</span>
                    {c.currentDue > 0 && <span className="text-red-400 ml-2 text-xs">Due: {formatCurrency(c.currentDue)}</span>}
                    {c.advanceBalance > 0 && <span className="text-amber-400 ml-2 text-xs">Adv: {formatCurrency(c.advanceBalance)}</span>}
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="mt-2 p-2 bg-dark-bg rounded-lg border border-dark-border text-xs">
                <span className="text-gray-200 font-semibold">{selectedCustomer.name}</span>
                {selectedCustomer.currentDue > 0 && <span className="text-red-400 ml-3">Due: {formatCurrency(selectedCustomer.currentDue)}</span>}
                {selectedCustomer.advanceBalance > 0 && <span className="text-amber-400 ml-3">Advance: {formatCurrency(selectedCustomer.advanceBalance)}</span>}
              </div>
            )}
          </div>

          <div>
            <label className="label">Amount (₹) *</label>
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Enter payment amount"
              onWheel={(e) => e.target.blur()}
            />
          </div>

          {/* Less / Write-off amount */}
          {selectedCustomer && selectedCustomer.currentDue > 0 && (() => {
            const payAmt = parseFloat(form.amount) || 0;
            const remaining = Math.max(0, Math.round((selectedCustomer.currentDue - payAmt) * 100) / 100);
            return remaining > 0 ? (
              <div className={`p-3 rounded-lg border ${parseFloat(form.lessAmount) > 0 ? 'bg-amber-900/20 border-amber-700/40' : 'bg-dark-bg border-dark-border'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-xs font-semibold text-amber-400">Less / Write-off</p>
                    <p className="text-[10px] text-gray-500">Due: {formatCurrency(selectedCustomer.currentDue)} − Paying: {formatCurrency(payAmt)} = <span className="text-red-400 font-semibold">Remaining {formatCurrency(remaining)}</span></p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={remaining}
                    className="input !py-1.5 text-sm flex-1"
                    value={form.lessAmount}
                    onChange={(e) => setForm({ ...form, lessAmount: e.target.value })}
                    placeholder={`Max ${formatCurrency(remaining)}`}
                    onWheel={(e) => e.target.blur()}
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, lessAmount: remaining.toString() })}
                    className="btn-secondary !py-1.5 !px-3 text-xs whitespace-nowrap"
                  >
                    Full Remaining
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">This amount will be marked as "Less" and reduce customer due</p>
              </div>
            ) : null;
          })()}

          <div>
            <label className="label">Payment Mode</label>
            <select className="select" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="Bank">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          <div>
            <label className="label">Reference #</label>
            <input
              className="input"
              value={form.referenceNumber}
              onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
              placeholder="Cheque no, UPI ref, etc."
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              className="input"
              rows="2"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || (!form.amount && !form.lessAmount) || !form.customer}
              onClick={handleSubmit}
              className="btn-success w-full sm:w-auto justify-center"
            >
              {submitting ? 'Saving…' : editing ? 'Update Payment' : 'Record Payment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Payment"
        message={deleteConfirm ? `Delete payment of ${formatCurrency(deleteConfirm.amount)} from "${deleteConfirm.customer?.name}"? This will update customer balances.` : ''}
        confirmText="Delete"
        variant="danger"
        loading={submitting}
      />

      {/* Less / Write-off confirmation */}
      <ConfirmDialog
        isOpen={lessConfirm}
        onClose={() => setLessConfirm(false)}
        onConfirm={actualSubmit}
        title="Confirm Less / Write-off"
        message={
          <div className="space-y-2 text-left">
            <p className="text-sm text-gray-300 font-medium">{selectedCustomer?.name}</p>
            <div className="bg-dark-bg rounded-lg p-3 border border-dark-border space-y-1.5">
              {(parseFloat(form.amount) || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Payment Amount</span>
                  <span className="text-emerald-400 font-semibold">{formatCurrency(parseFloat(form.amount) || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Less (Write-off)</span>
                <span className="text-amber-400 font-semibold">{formatCurrency(parseFloat(form.lessAmount) || 0)}</span>
              </div>
              <hr className="border-dark-border" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Current Due</span>
                <span className="text-red-400">{formatCurrency(selectedCustomer?.currentDue || 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Due After</span>
                <span className="text-gray-100 font-bold">{formatCurrency(Math.max(0, (selectedCustomer?.currentDue || 0) - (parseFloat(form.amount) || 0) - (parseFloat(form.lessAmount) || 0)))}</span>
              </div>
            </div>
            <p className="text-[11px] text-amber-400/80">⚠ Less amount cannot be recovered. This will permanently reduce the customer's due.</p>
          </div>
        }
        confirmText={`Confirm ₹${(parseFloat(form.lessAmount) || 0).toLocaleString('en-IN')} Less`}
        variant="warning"
        loading={submitting}
      />
    </div>
  );
}
