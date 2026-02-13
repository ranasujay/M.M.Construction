import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getSupplierLedger, paySupplier, updateSupplierPayment, deleteSupplierPayment } from '../services/stockApi';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Loader from '../components/Loader';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlineCreditCard, HiOutlinePencil, HiOutlineTrash, HiOutlineExternalLink } from 'react-icons/hi';

export default function SupplierLedger() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [payConfirm, setPayConfirm] = useState(false);

  // Edit payment state
  const [editPayOpen, setEditPayOpen] = useState(false);
  const [editPayForm, setEditPayForm] = useState({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
  const [editingPaymentId, setEditingPaymentId] = useState(null);
  const [editPayConfirm, setEditPayConfirm] = useState(false);

  // Delete payment state
  const [deletePayConfirm, setDeletePayConfirm] = useState(null);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const res = await getSupplierLedger(id);
      setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLedger(); }, [id]);

  const openPayModal = () => {
    setPayOpen(true);
    setPayForm({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
  };

  const handlePayConfirm = async () => {
    const amt = parseFloat(payForm.amount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }

    setSubmitting(true);
    try {
      await paySupplier(id, {
        amount: amt,
        mode: payForm.mode,
        referenceNumber: payForm.referenceNumber,
        notes: payForm.notes,
      });
      toast.success('Payment recorded');
      setPayConfirm(false);
      setPayOpen(false);
      setPayForm({ amount: '', mode: 'Cash', referenceNumber: '', notes: '' });
      fetchLedger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditPayment = (entry) => {
    setEditingPaymentId(entry.paymentId);
    setEditPayForm({
      amount: entry.amount.toString(),
      mode: entry.mode || 'Cash',
      referenceNumber: entry.referenceNumber || '',
      notes: entry.notes || '',
    });
    setEditPayOpen(true);
  };

  const handleEditPayConfirm = async () => {
    const amt = parseFloat(editPayForm.amount);
    if (!amt || amt <= 0) { toast.error('Enter valid amount'); return; }
    setSubmitting(true);
    try {
      await updateSupplierPayment(id, editingPaymentId, {
        amount: amt,
        mode: editPayForm.mode,
        referenceNumber: editPayForm.referenceNumber,
        notes: editPayForm.notes,
      });
      toast.success('Payment updated');
      setEditPayConfirm(false);
      setEditPayOpen(false);
      fetchLedger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePayment = async () => {
    if (!deletePayConfirm) return;
    setSubmitting(true);
    try {
      await deleteSupplierPayment(id, deletePayConfirm.paymentId);
      toast.success('Payment deleted');
      setDeletePayConfirm(null);
      fetchLedger();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader text="Loading supplier ledger..." />;
  if (!data) return <div className="text-center text-gray-400 py-12">Supplier not found</div>;

  const { supplier, ledger } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/suppliers" className="text-gray-400 hover:text-gray-200">
            <HiOutlineArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-100">{supplier.name}</h1>
            <p className="text-xs text-gray-500">Supplier Ledger</p>
          </div>
        </div>
        <button onClick={openPayModal} className="btn-success !py-2 !px-3 text-sm">
          <HiOutlineCreditCard className="w-4 h-4" /> <span className="hidden sm:inline">Pay</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total Purchased</p>
          <p className="text-lg font-bold text-gray-100">{formatCurrency(supplier.totalPurchased)}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Total Paid</p>
          <p className="text-lg font-bold text-emerald-400">{formatCurrency(supplier.totalPaid)}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Due</p>
          <p className={`text-lg font-bold ${supplier.currentDue > 0 ? 'text-red-400' : 'text-gray-400'}`}>{formatCurrency(supplier.currentDue)}</p>
        </div>
        <div className="card !p-3 text-center">
          <p className="text-[10px] text-gray-500 uppercase">Advance</p>
          <p className={`text-lg font-bold ${supplier.advanceBalance > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>{formatCurrency(supplier.advanceBalance)}</p>
        </div>
      </div>

      {/* Info */}
      {(supplier.phone || supplier.address) && (
        <div className="card !p-3">
          {supplier.phone && <p className="text-sm text-gray-400">Phone: <span className="text-gray-200">{supplier.phone}</span></p>}
          {supplier.address && <p className="text-sm text-gray-400 mt-1">Address: <span className="text-gray-200">{supplier.address}</span></p>}
          {supplier.notes && <p className="text-sm text-gray-400 mt-1">Notes: <span className="text-gray-200">{supplier.notes}</span></p>}
        </div>
      )}

      {/* Ledger timeline */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">Transaction History</h3>
        {ledger.length > 0 ? (
          <div className="space-y-2">
            {ledger.map((entry, i) => (
              <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${entry.type === 'PURCHASE' ? 'bg-red-500/5 border-red-500/20' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-200">
                      {entry.type === 'PURCHASE' ? (
                        <button
                          onClick={() => navigate(`/purchases/${entry.ref}/edit`)}
                          className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1"
                        >
                          Purchase {entry.billNumber} <HiOutlineExternalLink className="w-3 h-3" />
                        </button>
                      ) : (
                        entry.description
                      )}
                    </p>
                    {entry.type === 'PAYMENT' && (
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => openEditPayment(entry)} className="text-gray-500 hover:text-gray-200 p-0.5" title="Edit payment">
                          <HiOutlinePencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setDeletePayConfirm(entry)} className="text-gray-500 hover:text-red-400 p-0.5" title="Delete payment">
                          <HiOutlineTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{formatDateTime(entry.date)} • by {entry.by}</p>
                  {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                </div>
                <span className={`text-sm font-bold whitespace-nowrap ml-3 ${entry.type === 'PURCHASE' ? 'text-red-400' : 'text-emerald-400'}`}>
                  {entry.type === 'PURCHASE' ? '+' : '-'}{formatCurrency(entry.amount)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No transactions yet.</p>
        )}
      </div>

      {/* New Payment Modal */}
      <Modal isOpen={payOpen} onClose={() => setPayOpen(false)} title="Pay Supplier">
        <div className="space-y-4">
          <div className="bg-dark-bg rounded-lg p-3 border border-dark-border">
            <p className="text-sm text-gray-400">Supplier: <span className="text-gray-100 font-semibold">{supplier.name}</span></p>
            <p className="text-sm text-gray-400 mt-1">Due: <span className={`font-bold ${supplier.currentDue > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{formatCurrency(supplier.currentDue)}</span></p>
          </div>
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" step="0.01" className="input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} placeholder="Enter amount" autoFocus />
          </div>
          <div>
            <label className="label">Payment Mode</label>
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
      </Modal>

      {/* Edit Payment Modal */}
      <Modal isOpen={editPayOpen} onClose={() => setEditPayOpen(false)} title="Edit Payment">
        <div className="space-y-4">
          <div>
            <label className="label">Amount (₹) *</label>
            <input type="number" step="0.01" className="input" value={editPayForm.amount} onChange={(e) => setEditPayForm({ ...editPayForm, amount: e.target.value })} placeholder="Enter amount" autoFocus />
          </div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="select" value={editPayForm.mode} onChange={(e) => setEditPayForm({ ...editPayForm, mode: e.target.value })}>
              <option value="Cash">Cash</option><option value="UPI">UPI</option><option value="Bank">Bank Transfer</option><option value="Cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label className="label">Reference #</label>
            <input className="input" value={editPayForm.referenceNumber} onChange={(e) => setEditPayForm({ ...editPayForm, referenceNumber: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows="2" value={editPayForm.notes} onChange={(e) => setEditPayForm({ ...editPayForm, notes: e.target.value })} />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditPayOpen(false)} className="btn-secondary w-full sm:w-auto justify-center">Cancel</button>
            <button
              type="button"
              disabled={!editPayForm.amount || parseFloat(editPayForm.amount) <= 0}
              onClick={() => setEditPayConfirm(true)}
              className="btn-primary w-full sm:w-auto justify-center"
            >
              Update Payment
            </button>
          </div>
        </div>
      </Modal>

      {/* New payment confirmation */}
      <ConfirmDialog
        isOpen={payConfirm}
        onClose={() => setPayConfirm(false)}
        onConfirm={handlePayConfirm}
        title="Confirm Payment"
        message={`Pay ${formatCurrency(parseFloat(payForm.amount) || 0)} to "${supplier.name}" via ${payForm.mode}?`}
        confirmText="Confirm Payment"
        variant="info"
        loading={submitting}
      />

      {/* Edit payment confirmation */}
      <ConfirmDialog
        isOpen={editPayConfirm}
        onClose={() => setEditPayConfirm(false)}
        onConfirm={handleEditPayConfirm}
        title="Confirm Update"
        message={`Update payment amount to ${formatCurrency(parseFloat(editPayForm.amount) || 0)} via ${editPayForm.mode}?`}
        confirmText="Update"
        variant="info"
        loading={submitting}
      />

      {/* Delete payment confirmation */}
      <ConfirmDialog
        isOpen={!!deletePayConfirm}
        onClose={() => setDeletePayConfirm(null)}
        onConfirm={handleDeletePayment}
        title="Delete Payment"
        message={deletePayConfirm ? `Delete payment of ${formatCurrency(deletePayConfirm.amount)}? This will update supplier balances.` : ''}
        confirmText="Delete"
        variant="danger"
        loading={submitting}
      />
    </div>
  );
}
