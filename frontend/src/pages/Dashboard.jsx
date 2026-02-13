import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import StatCard from '../components/StatCard';
import Modal from '../components/Modal';
import Loader from '../components/Loader';
import { formatCurrency, formatDate, debounce } from '../utils/helpers';
import toast from 'react-hot-toast';
import {
  HiOutlineCurrencyRupee,
  HiOutlineDocumentText,
  HiOutlineExclamationCircle,
  HiOutlineTrendingUp,
  HiOutlineCreditCard,
  HiOutlineSearch,
  HiOutlineCash,
  HiOutlineArrowSmUp,
  HiOutlineArrowSmDown,
} from 'react-icons/hi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [overduePromises, setOverduePromises] = useState([]);
  const [loading, setLoading] = useState(true);

  // Quick-pay modal
  const [payModal, setPayModal] = useState(false);
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState([]);
  const [showCustDD, setShowCustDD] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'Cash', referenceNumber: '' });
  const [submitting, setSubmitting] = useState(false);

  // Chart state
  const [chartPeriod, setChartPeriod] = useState('daily');
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [statsRes, overdueRes] = await Promise.all([
        api.get('/bills/stats'),
        api.get('/promises/overdue'),
      ]);
      setStats(statsRes.data.data);
      setOverduePromises(overdueRes.data.data);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Fetch chart data
  const fetchChartData = async (period) => {
    try {
      setChartLoading(true);
      const { data } = await api.get('/bills/chart-data', { params: { period } });
      setChartData(data.data);
    } catch (err) {
      console.error('Chart fetch error:', err);
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => { fetchChartData(chartPeriod); }, [chartPeriod]);

  const searchCustomers = useCallback(
    debounce(async (term) => {
      if (!term) { setCustResults([]); return; }
      try {
        const { data } = await api.get('/customers', { params: { search: term, limit: 10 } });
        setCustResults(data.data);
        setShowCustDD(true);
      } catch (err) { console.error(err); }
    }, 300),
    []
  );

  const handleQuickPay = async (e) => {
    e.preventDefault();
    if (!selectedCustomer) { toast.error('Select a customer'); return; }
    if (!payForm.amount || parseFloat(payForm.amount) <= 0) { toast.error('Enter amount'); return; }
    setSubmitting(true);
    try {
      await api.post('/payments', {
        customer: selectedCustomer._id,
        amount: parseFloat(payForm.amount),
        mode: payForm.mode,
        referenceNumber: payForm.referenceNumber,
      });
      toast.success('Payment recorded!');
      setPayModal(false);
      setLoading(true);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openPayModal = () => {
    setPayModal(true);
    setSelectedCustomer(null);
    setCustSearch('');
    setCustResults([]);
    setPayForm({ amount: '', mode: 'Cash', referenceNumber: '' });
  };

  if (loading) return <Loader text="Loading dashboard..." />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openPayModal} className="btn-success !py-2 !px-3 text-sm">
            <HiOutlineCreditCard className="w-4 h-4" /> <span className="hidden sm:inline">Pay</span>
          </button>
          <Link to="/bills/create" className="btn-primary !py-2 !px-3 text-sm">
            + <span className="hidden sm:inline">Bill</span>
          </Link>
        </div>
      </div>

      {/* ═══════ Stat Cards ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={HiOutlineCurrencyRupee} label="Today's Billing" value={formatCurrency(stats?.today?.total || 0)} subtext={`${stats?.today?.count || 0} bills today`} color="green" />
        <StatCard icon={HiOutlineCash} label="Today's Collection" value={formatCurrency(stats?.todayCollection?.total || 0)} subtext={`${stats?.todayCollection?.count || 0} payments`} color="primary" />
        <StatCard icon={HiOutlineExclamationCircle} label="Total Outstanding" value={formatCurrency(stats?.outstanding?.totalDue || 0)} subtext={`${stats?.outstanding?.count || 0} customers`} color="red" />
        <StatCard icon={HiOutlineDocumentText} label="Overdue Follow-ups" value={overduePromises.length} subtext="Customers to follow" color="yellow" />
      </div>

      {/* ═══════ Monthly Summary Strip ═══════ */}
      <div className="card !p-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Monthly Summary ({new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })})
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500">Total Billing</p>
            <p className="text-lg font-bold text-emerald-400">{formatCurrency(stats?.monthly?.total || 0)}</p>
            <p className="text-[10px] text-gray-500">{stats?.monthly?.count || 0} bills</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Collection</p>
            <p className="text-lg font-bold text-primary-400">{formatCurrency(stats?.monthlyCollection?.total || 0)}</p>
            <p className="text-[10px] text-gray-500">{stats?.monthlyCollection?.count || 0} payments</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Net Due This Month</p>
            <p className="text-lg font-bold text-red-400">
              {formatCurrency(Math.max(0, (stats?.monthly?.total || 0) - (stats?.monthlyCollection?.total || 0)))}
            </p>
            <p className="text-[10px] text-gray-500">billing − collection</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Collection Rate</p>
            <p className="text-lg font-bold text-amber-400">
              {stats?.monthly?.total > 0
                ? `${Math.round(((stats?.monthlyCollection?.total || 0) / stats.monthly.total) * 100)}%`
                : '—'}
            </p>
            <p className="text-[10px] text-gray-500">of monthly billing</p>
          </div>
        </div>
      </div>

      {/* ─── Chart Section ─── */}
      <div className="card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-semibold text-gray-100">Business Overview</h3>
          <div className="flex gap-1.5 bg-dark-bg rounded-lg p-1 border border-dark-border">
            {[
              { key: 'daily', label: 'Day' },
              { key: 'monthly', label: 'Month' },
              { key: 'yearly', label: 'Year' },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setChartPeriod(p.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  chartPeriod === p.key
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-hover'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {chartLoading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader text="Loading chart..." />
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
                tickLine={{ stroke: '#475569' }}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={{ stroke: '#475569' }}
                tickLine={{ stroke: '#475569' }}
                tickFormatter={(v) => v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#e2e8f0',
                  fontSize: '12px',
                }}
                formatter={(value, name) => [formatCurrency(value), name]}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend
                wrapperStyle={{ fontSize: '12px' }}
                iconType="circle"
              />
              <Bar dataKey="billing" name="Billing" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="due" name="Due" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
            No data available for this period
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff-wise billing */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-100 mb-4">Staff-wise Billing (This Month)</h3>
          {stats?.staffWise?.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Bills</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.staffWise.map((s, i) => (
                    <tr key={i}>
                      <td className="font-medium text-gray-200">{s.staffName}</td>
                      <td>{s.billCount}</td>
                      <td className="text-emerald-400 font-semibold">{formatCurrency(s.totalBilling)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">No billing data this month.</p>
          )}
        </div>

        {/* Overdue promises */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-100">Overdue Follow-ups</h3>
            <Link to="/promises" className="text-sm text-primary-400 hover:text-primary-300">
              View all →
            </Link>
          </div>
          {overduePromises.length > 0 ? (
            <div className="space-y-3">
              {overduePromises.slice(0, 5).map((p) => (
                <div key={p._id} className="flex items-center justify-between p-3 rounded-lg bg-dark-bg border border-dark-border">
                  <div>
                    <p className="text-sm font-medium text-gray-200">{p.customer?.name}</p>
                    <p className="text-xs text-gray-500">{p.customer?.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-400">{formatCurrency(p.promisedAmount)}</p>
                    <p className="text-xs text-gray-500">Due: {formatDate(p.promiseDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No overdue follow-ups. All clear! ✅</p>
          )}
        </div>
      </div>

      {/* Quick Pay Modal */}
      <Modal isOpen={payModal} onClose={() => setPayModal(false)} title="Quick Payment">
        <form onSubmit={handleQuickPay} className="space-y-4">
          <div className="relative">
            <label className="label">Search Customer *</label>
            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                className="input pl-9"
                placeholder="Customer name or WhatsApp no..."
                value={custSearch}
                onChange={(e) => { setCustSearch(e.target.value); searchCustomers(e.target.value); }}
                onFocus={() => custResults.length > 0 && setShowCustDD(true)}
              />
            </div>
            {showCustDD && custResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-dark-card border border-dark-border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                {custResults.map((c) => (
                  <button key={c._id} type="button" onClick={() => { setSelectedCustomer(c); setCustSearch(`${c.name} — ${c.phone}`); setShowCustDD(false); setPayForm((prev) => ({ ...prev, amount: c.currentDue > 0 ? String(c.currentDue) : '' })); }} className="w-full text-left px-3 py-2 hover:bg-dark-hover border-b border-dark-border last:border-0">
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
            <div className="bg-dark-bg rounded-lg p-3 border border-dark-border text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Billed: <span className="text-gray-200 font-medium">{formatCurrency(selectedCustomer.totalBilled)}</span></span>
                <span className="text-gray-400">Paid: <span className="text-emerald-400">{formatCurrency(selectedCustomer.totalPaid)}</span></span>
              </div>
              {selectedCustomer.currentDue > 0 ? (
                <p className="mt-1"><span className="text-gray-400">Outstanding: </span><span className="text-red-400 font-semibold">{formatCurrency(selectedCustomer.currentDue)}</span></p>
              ) : (
                <p className="mt-1 text-xs text-amber-400">⚠ No dues. Payment will be recorded as advance.</p>
              )}
            </div>
          )}
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" step="0.01" className="input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Mode</label>
              <select className="select" value={payForm.mode} onChange={(e) => setPayForm({ ...payForm, mode: e.target.value })}>
                <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank">Bank</option><option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="label">Ref #</label>
              <input className="input" value={payForm.referenceNumber} onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })} placeholder="Optional" />
            </div>
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
