import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import { formatCurrency, formatDate, formatDateTime, getStatusColor } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlinePrinter, HiOutlinePencil } from 'react-icons/hi';

export default function CustomerLedger() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', altPhone: '', address: '', notes: '', openingBalance: '' });
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    fetchLedger();
  }, [id]);

  const openEdit = () => {
    const c = data.customer;
    setEditForm({
      name: c.name,
      phone: c.phone,
      altPhone: c.altPhone || '',
      address: c.address || '',
      notes: c.notes || '',
      openingBalance: c.openingBalance || '',
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.phone || !editForm.address) {
      toast.error('Name, WhatsApp no., and address are required');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/customers/${id}`, editForm);
      toast.success('Customer updated');
      setEditOpen(false);
      setLoading(true);
      fetchLedger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

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
            <p className="text-xs text-gray-500 truncate">📱 {customer.phone}{customer.address ? ` • ${customer.address}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={openEdit} className="btn-secondary no-print !py-2 !px-3 text-sm">
            <HiOutlinePencil className="w-4 h-4" /> <span className="hidden sm:inline">Edit</span>
          </button>
          <button onClick={() => window.print()} className="btn-secondary no-print !py-2 !px-3 text-sm">
            <HiOutlinePrinter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="card text-center">
          <p className="stat-label">Total Billed</p>
          <p className="stat-value text-gray-100">{formatCurrency(summary.totalBilled)}</p>
          {summary.openingBalance > 0 && (
            <p className="text-[10px] text-gray-500 mt-0.5">incl. ₹{summary.openingBalance.toLocaleString('en-IN')} opening</p>
          )}
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
          <>
            {/* Mobile cards */}
            <div className="space-y-2 lg:hidden">
              {bills.map((bill) => (
                <Link key={bill._id} to={`/bills/${bill._id}`} className="block bg-dark-bg rounded-lg p-3 border border-dark-border hover:border-primary-600 transition-colors">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-primary-400 font-medium text-sm">{bill.billNumber}</span>
                    <span className={getStatusColor(bill.paymentStatus) + ' text-xs'}>{bill.paymentStatus}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{formatDate(bill.createdAt)}</span>
                    <span className="text-gray-100 font-medium">{formatCurrency(bill.grandTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-emerald-400">Paid: {formatCurrency(bill.totalPaid)}</span>
                    <span className={bill.dueAmount > 0 ? 'text-red-400 font-semibold' : 'text-gray-500'}>Due: {formatCurrency(bill.dueAmount)}</span>
                  </div>
                </Link>
              ))}
            </div>
            {/* Desktop table */}
            <div className="table-container hidden lg:block">
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
                      <td className={bill.dueAmount > 0 ? 'text-red-400 font-semibold' : ''}>{formatCurrency(bill.dueAmount)}</td>
                      <td><span className={getStatusColor(bill.paymentStatus)}>{bill.paymentStatus}</span></td>
                      <td className="text-gray-500">{bill.createdBy?.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">No bills yet.</p>
        )}
      </div>

      {/* Payments */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Payment History ({summary.totalPayments})</h3>
        {payments.length > 0 ? (
          <>
            {/* Mobile cards */}
            <div className="space-y-2 lg:hidden">
              {payments.map((p) => (
                <div key={p._id} className="bg-dark-bg rounded-lg p-3 border border-dark-border">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-emerald-400 font-semibold text-sm">{formatCurrency(p.amount)}</span>
                    <span className="badge-info text-xs">{p.mode}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDateTime(p.createdAt)}</span>
                    <span className="text-primary-400">{p.bill?.billNumber}</span>
                  </div>
                  {(p.referenceNumber || p.receivedBy?.name) && (
                    <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                      {p.referenceNumber && <span>Ref: {p.referenceNumber}</span>}
                      {p.receivedBy?.name && <span>By: {p.receivedBy.name}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="table-container hidden lg:block">
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
          </>
        ) : (
          <p className="text-sm text-gray-500">No payments recorded.</p>
        )}
      </div>
      {/* Edit Customer Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Customer">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="form-label">Name *</label>
            <input className="form-input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Phone *</label>
              <input className="form-input" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} required />
            </div>
            <div>
              <label className="form-label">Alt Phone</label>
              <input className="form-input" value={editForm.altPhone} onChange={e => setEditForm(p => ({ ...p, altPhone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="form-label">Address</label>
            <input className="form-input" value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Opening Balance (₹)</label>
              <input type="number" min="0" className="form-input" value={editForm.openingBalance} onChange={e => setEditForm(p => ({ ...p, openingBalance: e.target.value }))} placeholder="Pre-existing due" onWheel={e => e.target.blur()} />
              <p className="text-[10px] text-gray-500 mt-0.5">Any due before using this system</p>
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea className="form-input" rows="2" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
