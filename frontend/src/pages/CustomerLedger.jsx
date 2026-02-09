import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Loader from '../components/Loader';
import { formatCurrency, formatDate, formatDateTime, getStatusColor } from '../utils/helpers';
import { HiOutlineArrowLeft, HiOutlinePrinter } from 'react-icons/hi';

export default function CustomerLedger() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        const { data: res } = await api.get(`/customers/${id}/ledger`);
        setData(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLedger();
  }, [id]);

  if (loading) return <Loader text="Loading ledger..." />;
  if (!data) return <div className="text-center text-gray-400 py-12">Customer not found</div>;

  const { customer, bills, payments, summary } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/customers" className="text-gray-400 hover:text-gray-200 transition-colors flex-shrink-0">
            <HiOutlineArrowLeft className="w-5 h-5" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-100 truncate">{customer.name}</h1>
            <p className="text-xs text-gray-500 truncate">📱 {customer.phone}</p>
          </div>
        </div>
        <button onClick={() => window.print()} className="btn-secondary no-print !py-2 !px-3 text-sm flex-shrink-0">
          <HiOutlinePrinter className="w-4 h-4" />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="card text-center">
          <p className="stat-label">Total Billed</p>
          <p className="stat-value text-gray-100">{formatCurrency(summary.totalBilled)}</p>
        </div>
        <div className="card text-center">
          <p className="stat-label">Total Paid</p>
          <p className="stat-value text-emerald-400">{formatCurrency(summary.totalPaid)}</p>
        </div>
        <div className="card text-center">
          <p className="stat-label">Current Due</p>
          <p className={`stat-value ${summary.currentDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {formatCurrency(summary.currentDue)}
          </p>
        </div>
        <div className="card text-center">
          <p className="stat-label">Advance</p>
          <p className={`stat-value ${summary.advanceBalance > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
            {formatCurrency(summary.advanceBalance)}
          </p>
        </div>
      </div>

      {/* Bills */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Bills ({summary.totalBills})</h3>
        {bills.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Bill #</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill._id}>
                    <td>
                      <Link to={`/bills/${bill._id}`} className="text-primary-400 hover:text-primary-300 font-medium">
                        {bill.billNumber}
                      </Link>
                    </td>
                    <td>{formatDate(bill.createdAt)}</td>
                    <td>{formatCurrency(bill.grandTotal)}</td>
                    <td className="text-emerald-400">{formatCurrency(bill.totalPaid)}</td>
                    <td className={bill.dueAmount > 0 ? 'text-red-400' : ''}>{formatCurrency(bill.dueAmount)}</td>
                    <td><span className={getStatusColor(bill.paymentStatus)}>{bill.paymentStatus}</span></td>
                    <td className="text-gray-500">{bill.createdBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No bills yet.</p>
        )}
      </div>

      {/* Payments */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Payment History ({summary.totalPayments})</h3>
        {payments.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bill #</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Ref</th>
                  <th>Received By</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td>{formatDateTime(p.createdAt)}</td>
                    <td className="text-primary-400">{p.bill?.billNumber}</td>
                    <td className="text-emerald-400 font-semibold">{formatCurrency(p.amount)}</td>
                    <td><span className="badge-info">{p.mode}</span></td>
                    <td className="text-gray-500">{p.referenceNumber || '-'}</td>
                    <td className="text-gray-500">{p.receivedBy?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No payments recorded.</p>
        )}
      </div>
    </div>
  );
}
