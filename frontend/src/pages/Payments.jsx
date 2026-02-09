import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import Pagination from '../components/Pagination';
import { formatCurrency, formatDateTime, debounce } from '../utils/helpers';
import { HiOutlinePlus, HiOutlineSearch } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modeFilter, setModeFilter] = useState('');

  // Add payment modal
  const [payModal, setPayModal] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (modeFilter) params.mode = modeFilter;
      const { data } = await api.get('/payments', { params });
      setPayments(data.data);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, [page, modeFilter]);

  const searchCustomers = useCallback(
    debounce(async (term) => {
      if (!term) { setCustResults([]); return; }
      try {
        const { data } = await api.get('/customers', { params: { search: term, limit: 10 } });
        setCustResults(data.data);
        setShowCustDropdown(true);
      } catch (err) {
        console.error(err);
      }
    }, 300),
    []
  );

  const selectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustSearch(`${cust.name} — ${cust.phone}`);
    setShowCustDropdown(false);
    setPayForm((prev) => ({ ...prev, amount: cust.currentDue > 0 ? String(cust.currentDue) : '' }));
  };


  const openPayModal = () => {
    setPayModal(true);
    setSelectedCustomer(null);
    setCustSearch('');
    setCustResults([]);
    setPayForm({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
  };

  const handlePaySubmit = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) { toast.error('Select a customer first'); return; }
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSubmitting(true);
    try {
      await api.post('/payments', {
        customer: selectedCustomer._id,
        amount: parseFloat(payForm.amount),
        mode: payForm.mode,
        referenceNumber: payForm.referenceNumber,
        notes: payForm.notes,
      });
      toast.success('Payment recorded');
      setPayModal(false);
      fetchPayments();
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
          <h1 className="text-xl font-bold text-gray-100">Payments</h1>
          <p className="text-xs text-gray-500">All payment records</p>
        </div>
        <button onClick={openPayModal} className="btn-success !py-2 !px-4 text-sm">
          <HiOutlinePlus className="w-4 h-4" /> Add Payment
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'Cash', 'UPI', 'Bank', 'Cheque'].map((mode) => (
          <button
            key={mode}
            onClick={() => { setModeFilter(mode); setPage(1); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              modeFilter === mode ? 'bg-primary-600 text-white' : 'bg-dark-card text-gray-400 hover:bg-dark-hover border border-dark-border'
            }`}
          >
            {mode || 'All'}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <>
          {/* Mobile cards */}
          <div className="space-y-2 lg:hidden">
            {payments.map((p) => (
              <div key={p._id} className="card !p-3">
                <div className="flex items-center justify-between">
                  <Link to={`/customers/${p.customer?._id}/ledger`} className="text-gray-200 font-medium text-sm hover:text-primary-400">
                    {p.customer?.name}
                  </Link>
                  <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(p.amount)}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs">
                  {p.bill ? (
                    <Link to={`/bills/${p.bill._id}`} className="text-primary-400">{p.bill.billNumber}</Link>
                  ) : (
                    <span className="text-amber-400 text-[10px] font-semibold">Advance</span>
                  )}
                  <span className="badge-info text-[10px]">{p.mode}</span>
                </div>
                <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                  <span>{formatDateTime(p.createdAt)}</span>
                  <span>{p.receivedBy?.name}</span>
                </div>
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
                  <th>Bill #</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Received By</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td>{formatDateTime(p.createdAt)}</td>
                    <td>
                      <Link to={`/customers/${p.customer?._id}/ledger`} className="text-gray-200 hover:text-primary-400 font-medium">
                        {p.customer?.name}
                      </Link>
                    </td>
                    <td>
                      {p.bill ? (
                        <Link to={`/bills/${p.bill._id}`} className="text-primary-400 hover:text-primary-300">
                          {p.bill.billNumber}
                        </Link>
                      ) : (
                        <span className="badge-warning">Advance</span>
                      )}
                    </td>
                    <td className="text-emerald-400 font-semibold">{formatCurrency(p.amount)}</td>
                    <td><span className="badge-info">{p.mode}</span></td>
                    <td className="text-gray-500">{p.referenceNumber || '-'}</td>
                    <td className="text-gray-500">{p.receivedBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Add Payment Modal */}
      <Modal isOpen={payModal} onClose={() => setPayModal(false)} title="Record Payment">
        <form onSubmit={handlePaySubmit} className="space-y-4">
          {/* Customer search */}
          <div className="relative">
            <label className="label">Search Customer *</label>
            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                className="input pl-9"
                placeholder="Customer name or WhatsApp no..."
                value={custSearch}
                onChange={(e) => { setCustSearch(e.target.value); searchCustomers(e.target.value); }}
                onFocus={() => custResults.length > 0 && setShowCustDropdown(true)}
              />
            </div>
            {showCustDropdown && custResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                {custResults.map((c) => (
                  <button key={c._id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2 hover:bg-dark-hover border-b border-dark-border last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-200">{c.name}</span>
                      {c.currentDue > 0 ? (
                        <span className="text-xs font-semibold text-red-400">Due: {formatCurrency(c.currentDue)}</span>
                      ) : (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">No Dues</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{c.phone} {c.address ? `• ${c.address}` : ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedCustomer && (
            <div className="bg-dark-bg rounded-lg p-3 border border-dark-border">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Customer: <span className="text-gray-200 font-medium">{selectedCustomer.name}</span></span>
                <span className="text-gray-400">{selectedCustomer.phone}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-400">Total Billed: {formatCurrency(selectedCustomer.totalBilled)}</span>
                {selectedCustomer.currentDue > 0 ? (
                  <span className="text-red-400 font-semibold">Due: {formatCurrency(selectedCustomer.currentDue)}</span>
                ) : (
                  <span className="text-emerald-400 font-semibold">No Dues ✓</span>
                )}
              </div>
              {selectedCustomer.currentDue <= 0 && (
                <p className="text-xs text-amber-400 mt-1.5">⚠ No dues. Payment will be recorded as advance.</p>
              )}
            </div>
          )}
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" step="0.01" className="input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Enter amount" />
          </div>
          <div>
            <label className="label">Payment Mode *</label>
            <select className="select" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
              <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank">Bank Transfer</option><option value="Cheque">Cheque</option>
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
            <button type="button" onClick={() => setPayModal(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-success w-full sm:w-auto justify-center">
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
