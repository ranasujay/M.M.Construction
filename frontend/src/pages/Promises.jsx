import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import { formatCurrency, formatDate, debounce } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineClock, HiOutlineExclamationCircle } from 'react-icons/hi';

export default function Promises() {
  const [promises, setPromises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('pending');
  const [modalOpen, setModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    customer: '',
    customerName: '',
    promiseDate: '',
    promisedAmount: '',
    notes: '',
  });

  const fetchPromises = async () => {
    try {
      setLoading(true);
      let endpoint = '/promises';
      if (tab === 'overdue') endpoint = '/promises/overdue';
      else if (tab !== 'all') endpoint = `/promises?status=${tab}`;

      const { data } = await api.get(endpoint);
      setPromises(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPromises(); }, [tab]);

  const searchCustomers = useCallback(
    debounce(async (term) => {
      if (!term) { setCustomers([]); return; }
      try {
        const { data } = await api.get('/customers', { params: { search: term, limit: 8 } });
        setCustomers(data.data);
        setShowDropdown(true);
      } catch (err) {
        console.error(err);
      }
    }, 300),
    []
  );

  const selectCustomer = (c) => {
    setForm((prev) => ({ ...prev, customer: c._id, customerName: c.name }));
    setCustomerSearch(`${c.name} — ${c.phone}`);
    setShowDropdown(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer || !form.promiseDate || !form.promisedAmount) {
      toast.error('Fill in all required fields');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/promises', {
        customer: form.customer,
        promiseDate: form.promiseDate,
        promisedAmount: parseFloat(form.promisedAmount),
        notes: form.notes,
      });
      toast.success('Promise recorded');
      setModalOpen(false);
      setForm({ customer: '', customerName: '', promiseDate: '', promisedAmount: '', notes: '' });
      setCustomerSearch('');
      fetchPromises();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.put(`/promises/${id}`, { status });
      toast.success(`Marked as ${status}`);
      fetchPromises();
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const tabs = [
    { key: 'pending', label: 'Pending' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'fulfilled', label: 'Fulfilled' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Follow-ups</h1>
          <p className="text-xs text-gray-500">Track payment promises</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary !py-2 !px-4 text-sm">
          <HiOutlinePlus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-primary-600 text-white' : 'bg-dark-card text-gray-400 hover:bg-dark-hover border border-dark-border'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <Loader /> : (
        <div className="space-y-3">
          {promises.length === 0 ? (
            <div className="card text-center py-12 text-gray-500">
              <HiOutlineClock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No promises found for this filter.</p>
            </div>
          ) : (
            promises.map((p) => (
              <div key={p._id} className={`card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                p.status === 'overdue' ? 'border-red-500/30' : ''
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${
                    p.status === 'overdue' ? 'bg-red-500/10 text-red-400' :
                    p.status === 'fulfilled' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-amber-500/10 text-amber-400'
                  }`}>
                    {p.status === 'overdue' ? <HiOutlineExclamationCircle className="w-6 h-6" /> : <HiOutlineClock className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="font-medium text-gray-200">{p.customer?.name}</p>
                    <p className="text-sm text-gray-500">{p.customer?.phone}</p>
                    {p.customer?.currentDue > 0 && (
                      <p className="text-xs text-red-400 mt-1">Total due: {formatCurrency(p.customer.currentDue)}</p>
                    )}
                    {p.notes && <p className="text-xs text-gray-500 mt-1">{p.notes}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary-400">{formatCurrency(p.promisedAmount)}</p>
                    <p className="text-xs text-gray-500">by {formatDate(p.promiseDate)}</p>
                    <span className={`text-xs ${
                      p.status === 'overdue' ? 'badge-danger' :
                      p.status === 'fulfilled' ? 'badge-success' :
                      p.status === 'broken' ? 'badge-danger' :
                      'badge-warning'
                    }`}>
                      {p.status}
                    </span>
                  </div>
                  {(p.status === 'pending' || p.status === 'overdue') && (
                    <div className="flex flex-col gap-1">
                      <button onClick={() => updateStatus(p._id, 'fulfilled')} className="text-xs text-emerald-400 hover:text-emerald-300">
                        ✓ Fulfilled
                      </button>
                      <button onClick={() => updateStatus(p._id, 'broken')} className="text-xs text-red-400 hover:text-red-300">
                        ✗ Broken
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Create promise modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Payment Promise">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="label">Customer *</label>
            <input
              className="input"
              placeholder="Search customer..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                searchCustomers(e.target.value);
              }}
            />
            {showDropdown && customers.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-40 overflow-y-auto">
                {customers.map((c) => (
                  <button key={c._id} type="button" onClick={() => selectCustomer(c)} className="w-full text-left px-3 py-2 hover:bg-dark-hover text-sm">
                    <span className="font-medium text-gray-200">{c.name}</span>
                    <span className="text-gray-500"> — {c.phone}</span>
                    {c.address && <span className="text-gray-600 text-xs block truncate">{c.address}</span>}
                    {c.currentDue > 0 && <span className="text-red-400 text-xs"> Due: {formatCurrency(c.currentDue)}</span>}
                  </button>
                ))}
              </div>
            )}
            {form.customer && <p className="text-xs text-emerald-400 mt-1">✓ {form.customerName}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Promise Date *</label>
              <input type="date" className="input" value={form.promiseDate} onChange={(e) => setForm({ ...form, promiseDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Promised Amount (₹) *</label>
              <input type="number" step="0.01" className="input" value={form.promisedAmount} onChange={(e) => setForm({ ...form, promisedAmount: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto justify-center">
              {submitting ? 'Saving...' : 'Save Promise'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
