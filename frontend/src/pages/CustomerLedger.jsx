import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Loader from '../components/Loader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency, formatDate, formatDateTime } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlinePrinter, HiOutlinePencil } from 'react-icons/hi';

export default function CustomerLedger() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', phone: '', altPhone: '', address: '', notes: '', openingBalance: '' });
  const [saving, setSaving] = useState(false);
  const [lessConfirm, setLessConfirm] = useState(false);

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
      lessAmount: '',
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.name || !editForm.phone || !editForm.address) {
      toast.error('Name, WhatsApp no., and address are required');
      return;
    }
    // If lessAmount > 0, show confirmation first
    const lessAmt = parseFloat(editForm.lessAmount) || 0;
    if (lessAmt > 0 && !lessConfirm) {
      setLessConfirm(true);
      return;
    }
    await actualEditSubmit();
  };

  const actualEditSubmit = async () => {
    setLessConfirm(false);
    setSaving(true);
    try {
      // If less amount entered, create a "less" payment first
      const lessAmt = parseFloat(editForm.lessAmount) || 0;
      if (lessAmt > 0) {
        await api.post('/payments', {
          customer: id,
          amount: 0,
          mode: 'Cash',
          notes: 'Customer Less / Write-off',
          lessAmount: lessAmt,
        });
      }

      await api.put(`/customers/${id}`, {
        name: editForm.name,
        phone: editForm.phone,
        altPhone: editForm.altPhone,
        address: editForm.address,
        notes: editForm.notes,
        openingBalance: editForm.openingBalance,
      });
      toast.success(lessAmt > 0 ? `Customer updated & ${formatCurrency(lessAmt)} marked as less` : 'Customer updated');
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
      {/* Print header — visible only on print */}
      <div className="print-header hidden">
        <h1 style={{ fontSize: '14px', fontWeight: 'bold', margin: 0 }}>M.M. Construction</h1>
        <p style={{ fontSize: '9px', margin: '1px 0', color: '#555' }}>Iron Fabrication & Installation</p>
        <hr style={{ margin: '4px 0', borderColor: '#333' }} />
        <div style={{ fontSize: '9px', marginTop: '2px' }}>
          <strong>Customer Ledger:</strong> {customer.name} | 📱 {customer.phone}
          {customer.address && <span> | {customer.address}</span>}
        </div>
        <div style={{ fontSize: '8px', marginTop: '2px', color: '#555' }}>
          Printed on: {new Date().toLocaleDateString('en-IN')}
        </div>
      </div>

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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
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
          <p className="stat-label">Customer Less</p>
          <p className={`stat-value ${summary.lessAmount > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
            {formatCurrency(summary.lessAmount)}
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
                    <span className="text-gray-100 font-semibold text-sm">{formatCurrency(bill.grandTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDate(bill.createdAt)}</span>
                    <span>{bill.createdBy?.name}</span>
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
                      <td className="font-semibold text-gray-100">{formatCurrency(bill.grandTotal)}</td>
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
                    <div className="flex items-center gap-1">
                      <span className="badge-info text-xs">{p.mode}</span>
                      {p.lessAmount > 0 && <span className="badge-warning text-xs">Less {formatCurrency(p.lessAmount)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{formatDateTime(p.createdAt)}</span>
                    <span>{p.receivedBy?.name}</span>
                  </div>
                  {p.referenceNumber && (
                    <div className="text-xs text-gray-500 mt-1">Ref: {p.referenceNumber}</div>
                  )}
                  {p.notes && (
                    <div className="text-xs text-gray-500 mt-1">{p.notes}</div>
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
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Ref</th>
                    <th>Notes</th>
                    <th>Received By</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td>{formatDateTime(p.createdAt)}</td>
                      <td className="text-emerald-400 font-semibold">{formatCurrency(p.amount)}</td>
                      <td><span className="badge-info">{p.mode}</span>{p.lessAmount > 0 && <span className="badge-warning ml-1">Less {formatCurrency(p.lessAmount)}</span>}</td>
                      <td className="text-gray-500">{p.referenceNumber || '-'}</td>
                      <td className="text-gray-500 text-xs max-w-[200px] truncate">{p.notes || '-'}</td>
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
            <label className="label">Name *</label>
            <input className="input" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone *</label>
              <input className="input" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} required />
            </div>
            <div>
              <label className="label">Alt Phone</label>
              <input className="input" value={editForm.altPhone} onChange={e => setEditForm(p => ({ ...p, altPhone: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={editForm.address} onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Opening Balance (₹)</label>
              <input type="number" min="0" className="input" value={editForm.openingBalance} onChange={e => setEditForm(p => ({ ...p, openingBalance: e.target.value }))} placeholder="Pre-existing due" onWheel={e => e.target.blur()} />
              <p className="text-[10px] text-gray-500 mt-0.5">Any due before using this system</p>
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input" rows="2" value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>

          {/* Make Due Zero — Less / Write-off */}
          {summary.currentDue > 0 && (
            <div className="p-3 bg-amber-900/20 rounded-lg border border-amber-700/40">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-xs font-semibold text-amber-400">Write-off Due (Less)</p>
                  <p className="text-[10px] text-gray-500">Current Due: <span className="text-red-400 font-semibold">{formatCurrency(summary.currentDue)}</span></p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={summary.currentDue}
                  className="input !py-1.5 text-sm flex-1"
                  value={editForm.lessAmount || ''}
                  onChange={e => setEditForm(p => ({ ...p, lessAmount: e.target.value }))}
                  placeholder={`Max ${formatCurrency(summary.currentDue)}`}
                  onWheel={e => e.target.blur()}
                />
                <button
                  type="button"
                  onClick={() => setEditForm(p => ({ ...p, lessAmount: summary.currentDue.toString() }))}
                  className="btn-secondary !py-1.5 !px-3 text-xs whitespace-nowrap"
                >
                  Full Due
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">This amount will be marked as "Customer Less" and due will reduce</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Less / Write-off confirmation */}
      <ConfirmDialog
        isOpen={lessConfirm}
        onClose={() => setLessConfirm(false)}
        onConfirm={actualEditSubmit}
        title="Confirm Less / Write-off"
        message={
          <div className="space-y-2 text-left">
            <p className="text-sm text-gray-300 font-medium">{customer.name}</p>
            <div className="bg-dark-bg rounded-lg p-3 border border-dark-border space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Less (Write-off)</span>
                <span className="text-amber-400 font-semibold">{formatCurrency(parseFloat(editForm.lessAmount) || 0)}</span>
              </div>
              <hr className="border-dark-border" />
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Current Due</span>
                <span className="text-red-400">{formatCurrency(summary.currentDue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Due After</span>
                <span className="text-gray-100 font-bold">{formatCurrency(Math.max(0, summary.currentDue - (parseFloat(editForm.lessAmount) || 0)))}</span>
              </div>
            </div>
            <p className="text-[11px] text-amber-400/80">⚠ Less amount cannot be recovered. This will permanently reduce the customer's due.</p>
          </div>
        }
        confirmText={`Confirm ₹${(parseFloat(editForm.lessAmount) || 0).toLocaleString('en-IN')} Less`}
        variant="warning"
        loading={saving}
      />

      {/* Print footer */}
      <div className="print-footer hidden" style={{ marginTop: '8px', fontSize: '8px', textAlign: 'center', color: '#888' }}>
        Thank you for your business! — M.M. Construction
      </div>
    </div>
  );
}
