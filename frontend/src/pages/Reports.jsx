import { useState } from 'react';
import api from '../services/api';
import Loader from '../components/Loader';
import { formatCurrency, formatDate, formatDateTime } from '../utils/helpers';
import { HiOutlineChartBar, HiOutlineDocumentText, HiOutlineCreditCard, HiOutlineExclamation } from 'react-icons/hi';

export default function Reports() {
  const [activeReport, setActiveReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const reports = [
    { key: 'bills', label: 'Bills Report', icon: HiOutlineDocumentText, desc: 'Date-wise bills summary' },
    { key: 'dues', label: 'Due Report', icon: HiOutlineExclamation, desc: 'All outstanding dues' },
    { key: 'payments', label: 'Payment Report', icon: HiOutlineCreditCard, desc: 'Payment collection summary' },
  ];

  const fetchReport = async (type) => {
    setLoading(true);
    setActiveReport(type);
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const { data: res } = await api.get(`/reports/${type}`, { params });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-100">Reports</h1>
        <p className="text-xs text-gray-500">Business analytics</p>
      </div>

      {/* Report selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {reports.map((r) => (
          <button
            key={r.key}
            onClick={() => fetchReport(r.key)}
            className={`card text-left hover:border-primary-500 transition-colors ${
              activeReport === r.key ? 'border-primary-500 bg-primary-600/5' : ''
            }`}
          >
            <r.icon className="w-8 h-8 text-primary-400 mb-2" />
            <h3 className="font-semibold text-gray-200">{r.label}</h3>
            <p className="text-xs text-gray-500 mt-1">{r.desc}</p>
          </button>
        ))}
      </div>

      {/* Date filter (for bills & payments) */}
      {activeReport && activeReport !== 'dues' && (
        <div className="card">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label">From</label>
              <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="label">To</label>
              <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <button onClick={() => fetchReport(activeReport)} className="btn-primary">Apply</button>
          </div>
        </div>
      )}

      {/* Report output */}
      {loading && <Loader text="Generating report..." />}

      {!loading && data && activeReport === 'bills' && (
        <div className="card">
          <h3 className="text-base font-semibold text-gray-100 mb-2">Bills Report</h3>
          <div className="flex flex-wrap gap-3 mb-4 text-xs sm:text-sm">
            <span className="text-gray-400">Billed: <span className="text-gray-200 font-semibold">{formatCurrency(data.summary?.totalBilled)}</span></span>
            <span className="text-gray-400">Paid: <span className="text-emerald-400 font-semibold">{formatCurrency(data.summary?.totalPaid)}</span></span>
            <span className="text-gray-400">Due: <span className="text-red-400 font-semibold">{formatCurrency(data.summary?.totalDue)}</span></span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.data?.map((b) => (
                  <tr key={b._id}>
                    <td className="text-primary-400 font-medium">{b.billNumber}</td>
                    <td>{b.customer?.name}</td>
                    <td>{formatDate(b.createdAt)}</td>
                    <td>{formatCurrency(b.grandTotal)}</td>
                    <td className="text-emerald-400">{formatCurrency(b.totalPaid)}</td>
                    <td className={b.dueAmount > 0 ? 'text-red-400 font-semibold' : ''}>{formatCurrency(b.dueAmount)}</td>
                    <td><span className={b.paymentStatus === 'PAID' ? 'badge-success' : b.paymentStatus === 'PARTIAL' ? 'badge-warning' : 'badge-danger'}>{b.paymentStatus}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-3">{data.count} bills found</p>
        </div>
      )}

      {!loading && data && activeReport === 'dues' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-100">Due Report</h3>
            <span className="text-lg font-bold text-red-400">Total: {formatCurrency(data.totalOutstanding)}</span>
          </div>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>WhatsApp No.</th>
                  <th>Total Billed</th>
                  <th>Total Paid</th>
                  <th>Due</th>
                  <th>Next Promise</th>
                </tr>
              </thead>
              <tbody>
                {data.data?.map((c) => (
                  <tr key={c._id}>
                    <td className="font-medium text-gray-200">{c.name}</td>
                    <td>{c.phone}</td>
                    <td>{formatCurrency(c.totalBilled)}</td>
                    <td className="text-emerald-400">{formatCurrency(c.totalPaid)}</td>
                    <td className="text-red-400 font-semibold">{formatCurrency(c.currentDue)}</td>
                    <td>
                      {c.nextPromiseDate ? (
                        <span className="text-xs">{formatDate(c.nextPromiseDate)} — {formatCurrency(c.nextPromiseAmount)}</span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-3">{data.count} customers with outstanding dues</p>
        </div>
      )}

      {!loading && data && activeReport === 'payments' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-100">Payment Report</h3>
            <span className="text-lg font-bold text-emerald-400">Collected: {formatCurrency(data.totalCollected)}</span>
          </div>
          {data.byMode && (
            <div className="flex flex-wrap gap-3 mb-4">
              {data.byMode.map((m) => (
                <div key={m._id} className="bg-dark-bg rounded-lg px-4 py-2 border border-dark-border">
                  <p className="text-xs text-gray-500">{m._id}</p>
                  <p className="text-sm font-semibold text-gray-200">{formatCurrency(m.total)} <span className="text-gray-500 font-normal">({m.count})</span></p>
                </div>
              ))}
            </div>
          )}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Bill #</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {data.data?.map((p) => (
                  <tr key={p._id}>
                    <td>{formatDateTime(p.createdAt)}</td>
                    <td>{p.customer?.name}</td>
                    <td className="text-primary-400">{p.bill?.billNumber}</td>
                    <td className="text-emerald-400 font-semibold">{formatCurrency(p.amount)}</td>
                    <td><span className="badge-info">{p.mode}</span></td>
                    <td className="text-gray-500">{p.receivedBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500 mt-3">{data.count} payments found</p>
        </div>
      )}
    </div>
  );
}
